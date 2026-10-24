"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlertIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/onboarding/steps";
import { completeOnboarding, saveOnboardingAnswer, skipOnboarding } from "@/lib/profile/actions";
import { onboardingPersona as persona } from "@/lib/prompts/onboarding-persona";
import { cn } from "@/lib/utils";
import { PersonaAvatar } from "./persona-avatar";
import { StepInputView } from "./step-inputs";

type Message = { id: number; from: "bot" | "user"; text: string; muted?: boolean };

type Phase =
  | { kind: "typing" }
  | { kind: "asking"; index: number }
  | { kind: "saving"; index: number }
  | { kind: "done" }
  | { kind: "leaving" };

const TYPING_MS = 650;
const AFTER_DONE_PATH = "/interviews";

export function OnboardingChat({ prefill }: { prefill: Partial<Record<OnboardingStepId, unknown>> }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "typing" });
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Whether the current conversation run is still active; old runs (e.g. StrictMode re-mount) stop writing. */
  const isActiveRef = useRef<() => boolean>(() => false);

  const push = useCallback((from: Message["from"], text: string, muted?: boolean) => {
    setMessages((current) => [...current, { id: nextId.current++, from, text, muted }]);
  }, []);

  /** Shows the typing indicator, then each line as a bot bubble. Returns false if the run was superseded. */
  const say = useCallback(
    async (lines: readonly string[], isActive: () => boolean) => {
      for (const line of lines) {
        if (!isActive()) return false;
        setPhase({ kind: "typing" });
        await new Promise((resolve) => setTimeout(resolve, TYPING_MS));
        if (!isActive()) return false;
        push("bot", line);
      }
      return true;
    },
    [push],
  );

  const ask = useCallback(
    async (index: number, isActive: () => boolean, lead: readonly string[] = []) => {
      const step = ONBOARDING_STEPS[index];
      if (!step) {
        if (await say([...lead, ...persona.outro], isActive)) setPhase({ kind: "done" });
        return;
      }
      if (await say([...lead, persona.questions[step.id]], isActive)) setPhase({ kind: "asking", index });
    },
    [say],
  );

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    isActiveRef.current = isActive;
    void (async () => {
      if (await say(persona.intro, isActive)) await ask(0, isActive);
    })();
    return () => {
      // Stop this run (unmount or StrictMode re-run).
      active = false;
    };
  }, [ask, say]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  async function answer(index: number, value: unknown, display: string) {
    const step = ONBOARDING_STEPS[index];
    setError(null);
    setPhase({ kind: "saving", index });
    try {
      const result = await saveOnboardingAnswer(step.id, value);
      if (!result.ok) {
        setError(result.error);
        setPhase({ kind: "asking", index });
        return;
      }
    } catch {
      setError("Keine Verbindung zum Server. Bitte versuche es erneut.");
      setPhase({ kind: "asking", index });
      return;
    }
    push("user", display);
    await ask(index + 1, isActiveRef.current, [persona.acknowledgements[index % persona.acknowledgements.length]]);
  }

  async function skipQuestion(index: number) {
    setError(null);
    push("user", "Überspringen", true);
    await ask(index + 1, isActiveRef.current, [persona.skipped]);
  }

  async function leave(action: typeof completeOnboarding) {
    setError(null);
    setPhase({ kind: "leaving" });
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        setPhase({ kind: "done" });
        return;
      }
      router.replace(AFTER_DONE_PATH);
    } catch {
      setError("Keine Verbindung zum Server. Bitte versuche es erneut.");
      setPhase({ kind: "done" });
    }
  }

  const activeIndex = phase.kind === "asking" || phase.kind === "saving" ? phase.index : -1;
  const activeStep = ONBOARDING_STEPS[activeIndex];
  const progress = phase.kind === "done" || phase.kind === "leaving" ? 1 : Math.max(0, activeIndex) / ONBOARDING_STEPS.length;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <PersonaAvatar className="size-10 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{persona.name}</span>
          <span className="truncate text-xs text-muted-foreground">{persona.role}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void leave(skipOnboarding)}
          disabled={phase.kind === "leaving"}
        >
          Später
        </Button>
      </header>
      <div className="h-1 bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
        <ol className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id} className={cn("flex", message.from === "user" ? "justify-end" : "justify-start")}>
              <p
                className={cn(
                  "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                  message.from === "bot" && "rounded-tl-sm bg-muted",
                  message.from === "user" && !message.muted && "rounded-tr-sm bg-primary text-primary-foreground",
                  message.muted && "rounded-tr-sm border border-dashed text-muted-foreground italic",
                )}
              >
                {message.text}
              </p>
            </li>
          ))}
          {phase.kind === "typing" && (
            <li className="flex" aria-label={`${persona.name} schreibt`}>
              <span className="flex gap-1 rounded-lg rounded-tl-sm bg-muted px-3.5 py-3.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </li>
          )}
        </ol>
      </div>

      {/* Answer area */}
      <div className="border-t bg-background px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && (
          <p className="mb-3 flex gap-2 text-sm text-destructive" role="alert">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {activeStep && (
          <div className="flex flex-col gap-3">
            <StepInputView
              key={activeStep.id}
              input={activeStep.input}
              initial={prefill[activeStep.id]}
              disabled={phase.kind === "saving"}
              onSubmit={(value, display) => void answer(activeIndex, value, display)}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Frage {activeIndex + 1} von {ONBOARDING_STEPS.length}
              </span>
              {phase.kind === "saving" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                  Wird gespeichert …
                </span>
              ) : (
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => void skipQuestion(activeIndex)}>
                  Frage überspringen
                </button>
              )}
            </div>
          </div>
        )}
        {(phase.kind === "done" || phase.kind === "leaving") && (
          <Button
            size="lg"
            className="h-11 w-full"
            onClick={() => void leave(completeOnboarding)}
            disabled={phase.kind === "leaving"}
          >
            {phase.kind === "leaving" && <Loader2Icon className="animate-spin" aria-hidden />}
            Los geht&apos;s
          </Button>
        )}
        {phase.kind === "typing" && <div className="h-10" aria-hidden />}
      </div>
    </div>
  );
}
