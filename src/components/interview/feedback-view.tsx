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
        <div className="flex flex-col justify-center gap-1 bg-primary px-6 py-5 text-primary-foreground">
          <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-primary-foreground/70 uppercase">
            Gesamtscore
          </span>
          {scores.overall !== null ? (
            <>
              <span className="font-heading text-5xl leading-none font-semibold tabular-nums">
                {numberFormat.format(scores.overall)}
                <span className="ml-1.5 text-lg font-normal text-primary-foreground/60">/ 5</span>
              </span>
              <span className="mt-1 text-sm font-medium text-gold">{scoreLabel(scores.overall)}</span>
            </>
          ) : (
            <span className="text-sm text-primary-foreground/80">Kein Gesamtscore</span>
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
            <li key={criterion.id} className="flex gap-4 p-4">
              <span className="w-5 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums" aria-hidden>
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">{criterion.title}</h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
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
        <TipList title="Deine Stärken" icon={ThumbsUpIcon} iconClassName="text-positive" items={strengths} />
        <TipList title="Das kannst du verbessern" icon={TrendingUpIcon} iconClassName="text-primary" items={improvements} />
      </div>

      <section className="flex gap-3 rounded-lg border bg-secondary p-4">
        <DumbbellIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Dein Übungsvorschlag</h2>
          <p className="text-sm leading-relaxed text-secondary-foreground">{exercise}</p>
        </div>
      </section>
    </div>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={cn("h-1.5 flex-1", score !== null && step <= score ? "bg-primary" : "bg-muted")}
        />
      ))}
    </div>
  );
}

function TipList({
  title,
  icon: Icon,
  iconClassName,
  items,
}: {
  title: string;
  icon: typeof ThumbsUpIcon;
  iconClassName?: string;
  items: string[];
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className={cn("size-4", iconClassName)} aria-hidden />
        {title}
      </h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
