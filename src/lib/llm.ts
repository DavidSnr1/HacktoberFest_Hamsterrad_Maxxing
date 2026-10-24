import "server-only";
import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

/**
 * The only module that talks to the LLM provider (Gemma 4 via the Gemini API).
 * Swap the provider here without touching the rest of the app.
 *
 * Tiers map to env vars so model names are never hardcoded:
 *   live    -> LLM_MODEL_LIVE    (fast, e.g. gemma-4-26b-a4b-it)
 *   quality -> LLM_MODEL_QUALITY (best, e.g. gemma-4-31b-it), falls back to
 *              LLM_MODEL_LIVE if the quality model fails or is too slow.
 */
export type ModelTier = "live" | "quality";

export type LlmUsage = { model: string; inputTokens: number; outputTokens: number };

export class LlmError extends Error {
  constructor(
    readonly code: "not_configured" | "unavailable" | "invalid_output",
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

type BaseOptions = {
  tier: ModelTier;
  system: string;
  prompt: string;
  /** Gemma is tuned for temperature 1.0; lower values made it loop in tests. */
  temperature?: number;
  /** Caps answer plus reasoning tokens, so a looping model cannot run forever. */
  maxOutputTokens?: number;
  /** Total time budget for the whole call, including retries and fallback. */
  deadlineMs?: number;
  /**
   * "minimal" switches Gemma's reasoning off (thinkingLevel MINIMAL). In tests
   * a resume took ~20 s instead of 70–110 s; enough for rewording tasks.
   */
  thinking?: "default" | "minimal";
};

const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const DEFAULT_DEADLINE_MS = 280_000;
/** Share of the budget the quality model gets before falling back. */
const QUALITY_SHARE = 0.6;
/** Backoff before each retry of a transient provider error (500/503/429). */
const TRANSIENT_RETRY_DELAYS_MS = [2_000, 5_000];
/** Do not start another attempt with less time left than this. */
const MIN_ATTEMPT_MS = 45_000;
/** Validation reason for unparseable output. */
const INVALID_JSON = "the response was not valid JSON.";
/** Same 2-30 characters repeated 12+ times at the end: the model is looping. */
const LOOP_PATTERN = /(.{2,30}?)\1{12,}$/s;

let client: GoogleGenAI | null = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new LlmError("not_configured", "GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Models to try in order, with their share of the time budget. */
function getModelChain(tier: ModelTier): { model: string; share: number }[] {
  const live = process.env.LLM_MODEL_LIVE;
  const quality = process.env.LLM_MODEL_QUALITY;
  if (tier === "live") {
    if (!live) throw new LlmError("not_configured", "LLM_MODEL_LIVE is not set");
    return [{ model: live, share: 1 }];
  }
  if (!quality) throw new LlmError("not_configured", "LLM_MODEL_QUALITY is not set");
  if (!live || live === quality) return [{ model: quality, share: 1 }];
  return [
    { model: quality, share: QUALITY_SHARE },
    { model: live, share: 1 },
  ];
}

function isTransient(error: unknown) {
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500;
  return error instanceof Error && /fetch failed|ECONNRESET|socket hang up/i.test(error.message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CallResult = {
  text: string;
  /** Why the model stopped; "LOOP" means we aborted a repeating output. */
  finishReason: FinishReason | "LOOP" | undefined;
  usage: LlmUsage;
};

type CallOptions = Omit<BaseOptions, "tier" | "deadlineMs"> & {
  model: string;
  deadline: number;
  json: boolean;
};

/**
 * One request to one model. Streams the answer so the deadline and the loop
 * detector can stop it, and retries transient provider errors while time is left.
 */
async function call(options: CallOptions): Promise<CallResult> {
  const ai = getClient();
  const { model, deadline } = options;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
    try {
      const stream = await ai.models.generateContentStream({
        model,
        contents: options.prompt,
        config: {
          systemInstruction: options.system,
          temperature: options.temperature ?? 1,
          maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          // Native JSON mode. A forced responseJsonSchema made Gemma 4 loop
          // in tests, so the schema goes into the prompt and Zod validates.
          responseMimeType: options.json ? "application/json" : undefined,
          thinkingConfig: options.thinking === "minimal" ? { thinkingLevel: ThinkingLevel.MINIMAL } : undefined,
          abortSignal: controller.signal,
        },
      });

      let text = "";
      let finishReason: CallResult["finishReason"];
      let usage: LlmUsage = { model, inputTokens: 0, outputTokens: 0 };
      for await (const chunk of stream) {
        text += chunk.text ?? "";
        finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
        if (chunk.usageMetadata) {
          usage = {
            model,
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens:
              (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0),
          };
        }
        if (LOOP_PATTERN.test(text.slice(-400))) {
          controller.abort();
          finishReason = "LOOP";
          break;
        }
      }
      return { text, finishReason, usage };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new LlmError("unavailable", `LLM request timed out (${model})`);
      }
      const delay = TRANSIENT_RETRY_DELAYS_MS[attempt];
      const timeLeft = deadline - Date.now() - (delay ?? 0);
      if (delay !== undefined && isTransient(error) && timeLeft > MIN_ATTEMPT_MS) {
        await sleep(delay);
        continue;
      }
      // Never log prompts or outputs: they contain personal data.
      const status = error instanceof ApiError ? error.status : "network";
      throw new LlmError("unavailable", `LLM request failed (${model}, status ${status})`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Explains an unusable finish reason to the model on retry, or null if fine. */
function finishProblem(reason: CallResult["finishReason"]): string | null {
  switch (reason) {
    case undefined:
    case FinishReason.STOP:
      return null;
    case "LOOP":
      return "the answer started repeating the same words. Write each text once, without repetitions.";
    case FinishReason.MAX_TOKENS:
      return "the answer was cut off because it was too long. Be more concise.";
    case FinishReason.RECITATION:
      return "the answer was blocked for reciting source text. Keep quotes very short (at most 12 words) or use null.";
    default:
      return `the answer was stopped (${reason}).`;
  }
}

/** Runs `attempt` on each model of the tier's chain until one succeeds. */
async function withFallback<T>(
  options: BaseOptions,
  attempt: (model: string, deadline: number) => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const budget = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const chain = getModelChain(options.tier);
  let lastError: unknown;

  for (const [index, { model, share }] of chain.entries()) {
    const deadline = start + budget * share;
    if (index > 0 && deadline - Date.now() < MIN_ATTEMPT_MS) break;
    try {
      return await attempt(model, deadline);
    } catch (error) {
      if (error instanceof LlmError && error.code === "not_configured") throw error;
      lastError = error;
      if (index < chain.length - 1) {
        console.warn(`llm: ${model} failed (${error instanceof LlmError ? error.code : "error"}), falling back`);
      }
    }
  }
  throw lastError instanceof LlmError ? lastError : new LlmError("unavailable", "All models failed");
}

/** Free-form text generation. */
export async function generateText(options: BaseOptions): Promise<{ text: string; usage: LlmUsage }> {
  return withFallback(options, async (model, deadline) => {
    const result = await call({ ...options, model, deadline, json: false });
    if (finishProblem(result.finishReason) || !result.text.trim()) {
      throw new LlmError("invalid_output", `LLM returned no usable text (${result.finishReason})`);
    }
    return { text: result.text, usage: result.usage };
  });
}

type JsonOptions<T> = BaseOptions & {
  /**
   * Extra checks beyond the schema (e.g. quotes must exist in the source).
   * Return a short English problem description, or null if the value is fine.
   */
  check?: (value: T) => string | null;
};

/**
 * Structured generation: native JSON mode, the Zod schema as JSON Schema in the
 * prompt, then validation with Zod (and `check`). Each model gets one retry
 * that tells it what was wrong; the quality tier then falls back to the live model.
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  options: JsonOptions<T>,
): Promise<{ data: T; usage: LlmUsage[] }> {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
  delete jsonSchema.$schema;
  const basePrompt = `${options.prompt}

Respond with a single JSON object that matches this JSON Schema exactly:
${JSON.stringify(jsonSchema)}`;

  const usage: LlmUsage[] = [];
  const data = await withFallback(options, async (model, deadline) => {
    let prompt = basePrompt;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0 && deadline - Date.now() < MIN_ATTEMPT_MS) break;

      const result = await call({ ...options, prompt, model, deadline, json: true });
      usage.push(result.usage);

      const problem = finishProblem(result.finishReason);
      const outcome = problem ? ({ ok: false, reason: problem } as const) : validate(schema, result.text, options.check);
      if (outcome.ok) return outcome.data;

      // The reason names fields and rules only, never content.
      console.warn(`llm: invalid output from ${model} (attempt ${attempt + 1}): ${outcome.reason}`);
      // Broken JSON is a random glitch: a fresh attempt takes ~20 s, while a
      // correction prompt made Gemma reason for over a minute in tests.
      if (outcome.reason === INVALID_JSON) continue;
      prompt = `${basePrompt}

Your previous answer was invalid: ${outcome.reason}
Answer again with valid JSON that follows the schema exactly.`;
    }
    throw new LlmError("invalid_output", `LLM output from ${model} failed validation`);
  });

  return { data, usage };
}

/** Extracts the JSON object even if the model wrapped it in a code fence. */
function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed);
}

function validate<T>(
  schema: z.ZodType<T>,
  text: string,
  check?: (value: T) => string | null,
): { ok: true; data: T } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch {
    return { ok: false, reason: INVALID_JSON };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, reason: issues };
  }
  const extra = check?.(parsed.data);
  if (extra) return { ok: false, reason: extra };
  return { ok: true, data: parsed.data };
}
