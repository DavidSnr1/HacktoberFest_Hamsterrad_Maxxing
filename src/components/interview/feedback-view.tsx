import { DumbbellIcon, QuoteIcon, ThumbsUpIcon, TrendingUpIcon } from "lucide-react";
import type { StoredScores } from "@/lib/schemas/feedback";
import { cn } from "@/lib/utils";

type FeedbackViewProps = {
  scores: StoredScores;
  strengths: string[];
  improvements: string[];
  exercise: string;
  summary: string;
};

const numberFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function scoreLabel(score: number) {
  if (score >= 4.5) return "Hervorragend";
  if (score >= 3.5) return "Gut";
  if (score >= 2.5) return "Solide Basis";
  if (score >= 1.5) return "Ausbaufähig";
  return "Am Anfang";
}

/** Structured interview feedback: overall score, rubric criteria and tips. */
export function FeedbackView({ scores, strengths, improvements, exercise, summary }: FeedbackViewProps) {
  return (
    <div className="flex flex-col gap-8">
      <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-[13rem_1fr]">
        <div className="flex flex-col items-center justify-center gap-1 bg-navy px-6 py-5 text-center text-white">
          <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-white/70 uppercase">
            Gesamtscore
          </span>
          {scores.overall !== null ? (
            <>
              <ScoreGauge score={scores.overall} />
              <span className="-mt-9 font-heading text-4xl leading-none font-semibold tabular-nums">
                {numberFormat.format(scores.overall)}
                <span className="ml-1 text-base font-normal text-white/60">/ 5</span>
              </span>
              <span className="mt-1.5 text-sm font-medium text-gold">{scoreLabel(scores.overall)}</span>
            </>
          ) : (
            <span className="text-sm text-white/80">Kein Gesamtscore</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-5">
          <h2 className="text-lg font-semibold">Gesamteinschätzung</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Bewertung nach Raster</h2>
        <ol className="divide-y rounded-lg border bg-card">
          {scores.criteria.map((criterion, index) => (
            <li key={criterion.id} className={cn("flex gap-4 p-4", scoreTone(criterion.score))}>
              <span className="w-5 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums" aria-hidden>
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">{criterion.title}</h3>
                  <span className="shrink-0 text-sm font-semibold text-(--tone) tabular-nums">
                    {criterion.score !== null ? (
                      <>
                        {criterion.score}
                        <span className="font-normal text-muted-foreground"> / 5</span>
                      </>
                    ) : (
                      <span className="font-normal text-muted-foreground">nicht bewertbar</span>
                    )}
                  </span>
                </div>
                <ScoreBar score={criterion.score} />
                <p className="text-sm leading-relaxed text-muted-foreground">{criterion.reasoning}</p>
                {criterion.quote && (
                  <blockquote className="flex gap-2 rounded-md bg-secondary px-3 py-2 font-heading text-sm italic">
                    <QuoteIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span>„{criterion.quote}“</span>
                  </blockquote>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <TipList title="Deine Stärken" icon={ThumbsUpIcon} tone="[--tone:var(--positive)]" items={strengths} />
        <TipList title="Das kannst du verbessern" icon={TrendingUpIcon} tone="[--tone:var(--finance)]" items={improvements} />
      </div>

      <section className="flex gap-3 rounded-lg bg-primary p-5 text-primary-foreground">
        <DumbbellIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Dein Übungsvorschlag</h2>
          <p className="text-sm leading-relaxed text-primary-foreground/85">{exercise}</p>
        </div>
      </section>
    </div>
  );
}

/** Traffic-light colour for a 1–5 score, exposed as --tone. */
function scoreTone(score: number | null) {
  if (score === null) return "[--tone:var(--muted-foreground)]";
  if (score >= 4) return "[--tone:var(--positive)]";
  if (score >= 3) return "[--tone:var(--finance)]";
  return "[--tone:var(--startup)]";
}

/** Half-circle gauge for the overall score (0–5). */
function ScoreGauge({ score }: { score: number }) {
  const percent = Math.max(0, Math.min(100, (score / 5) * 100));
  return (
    <svg viewBox="0 0 120 66" className="mt-2 w-36" aria-hidden>
      <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="oklch(1 0 0 / 0.15)" strokeWidth="9" pathLength={100} />
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="9"
        pathLength={100}
        strokeDasharray={`${percent} 100`}
      />
    </svg>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={cn("h-2 flex-1", score !== null && step <= score ? "bg-(--tone)" : "bg-muted")}
        />
      ))}
    </div>
  );
}

function TipList({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: typeof ThumbsUpIcon;
  tone: string;
  items: string[];
}) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-lg border bg-card", tone)}>
      <h2 className="flex items-center gap-2 border-b bg-(--tone)/12 px-4 py-2.5 font-semibold">
        <Icon className="size-4 text-(--tone)" aria-hidden />
        {title}
      </h2>
      <ol className="flex list-decimal flex-col gap-2 p-4 pl-9 text-sm leading-relaxed marker:font-semibold marker:text-(--tone)">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
