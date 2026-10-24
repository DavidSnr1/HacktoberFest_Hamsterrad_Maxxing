import "server-only";

import { generateJson } from "@/lib/llm";
import { buildResumeGeneratePrompt, RESUME_GENERATE_SYSTEM } from "@/lib/prompts/resume-generate";
import { buildResumeRevisePrompt, RESUME_REVISE_SYSTEM } from "@/lib/prompts/resume-revise";
import {
  resumeGenerationSchema,
  resumeRevisionSchema,
  type GenerateResumeInput,
  type LlmResumeDraft,
  type Resume,
  type ResumeProfile,
  type ResumeTrack,
} from "@/lib/schemas/resume";

import { aliasProfile, mapSourceRefs } from "./profile";
import { resolveResume } from "./resolve";
import { applyTrackTemplate, toLlmDraft } from "./tracks";
import { draftCheck, repairDraft } from "./validate";

/**
 * Contact data never goes to the model – the header is filled from the
 * profile and account in `resolveResume`.
 */
export function profileForPrompt(profile: ResumeProfile): ResumeProfile {
  return { ...profile, personal: { name: null, email: null, phone: null, location: null, links: [] } };
}

/**
 * Creates the resume for a track. The model tailors it to the track only; the
 * entered role is not part of the prompt, it just becomes the headline. That
 * way changing the role later never leaves content tailored to an old role.
 */
export async function generateResume(profile: ResumeProfile, input: GenerateResumeInput): Promise<Resume> {
  const aliases = aliasProfile(profile);
  const build = (draft: LlmResumeDraft) => repairDraft(applyTrackTemplate(draft, input.track, input.language), aliases.profile);
  const { data: result } = await generateJson(resumeGenerationSchema, {
    // 26B without reasoning: ~20 s instead of 1–2 min with 31B; repairDraft catches its slips.
    tier: "live",
    thinking: "minimal",
    deadlineMs: 120_000,
    system: RESUME_GENERATE_SYSTEM,
    prompt: buildResumeGeneratePrompt({
      profile: profileForPrompt(aliases.profile),
      track: input.track,
      language: input.language,
    }),
    check: draftCheck(aliases.profile, build),
  });
  const resume = resolveResume(build(result.resume), aliases.profile, {
    language: input.language,
    targetRole: input.targetRole,
    gaps: result.gaps,
  });
  return mapSourceRefs(resume, aliases.fromAlias);
}

export async function reviseResume(
  profile: ResumeProfile,
  current: Resume,
  input: { instruction: string; track: ResumeTrack },
): Promise<{ resume: Resume; note: string }> {
  const aliases = aliasProfile(profile);
  const build = (draft: LlmResumeDraft) => repairDraft(applyTrackTemplate(draft, input.track, current.language), aliases.profile);
  const { data: result } = await generateJson(resumeRevisionSchema, {
    // 26B without reasoning: ~20 s instead of 1–2 min with 31B; repairDraft catches its slips.
    tier: "live",
    thinking: "minimal",
    deadlineMs: 120_000,
    system: RESUME_REVISE_SYSTEM,
    prompt: buildResumeRevisePrompt({
      profile: profileForPrompt(aliases.profile),
      current: mapSourceRefs(toLlmDraft(current), aliases.toAlias),
      instruction: input.instruction,
      track: input.track,
      language: current.language,
    }),
    check: draftCheck(aliases.profile, build),
  });
  const resume = resolveResume(build(result.resume), aliases.profile, {
    language: current.language,
    targetRole: current.targetRole,
    gaps: current.gaps,
  });
  return { resume: mapSourceRefs(resume, aliases.fromAlias), note: result.note };
}
