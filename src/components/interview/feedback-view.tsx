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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-muted px-6 py-4 text-center">
          {scores.overall !== null ? (
            <>
              <span className="text-4xl font-semibold tabular-nums">{numberFormat.format(scores.overall)}</span>
              <span className="text-xs text-muted-foreground">von 5</span>
              <span className="mt-1 text-sm font-medium">{scoreLabel(scores.overall)}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Kein Gesamtscore</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Gesamteinschätzung</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Bewertung nach Raster</h2>
        <ul className="flex flex-col gap-3">
          {scores.criteria.map((criterion) => (
            <li key={criterion.id} className="flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">{criterion.title}</h3>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {criterion.score !== null ? `${criterion.score} / 5` : "nicht bewertbar"}
                </span>
              </div>
              <ScoreBar score={criterion.score} />
              <p className="text-sm leading-relaxed text-muted-foreground">{criterion.reasoning}</p>
              {criterion.quote && (
                <blockquote className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm italic">
                  <QuoteIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>„{criterion.quote}“</span>
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <TipList title="Deine Stärken" icon={ThumbsUpIcon} items={strengths} />
        <TipList title="Das kannst du verbessern" icon={TrendingUpIcon} items={improvements} />
      </div>

      <section className="flex gap-3 rounded-xl border bg-muted/40 p-4">
        <DumbbellIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Dein Übungsvorschlag</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{exercise}</p>
        </div>
      </section>
    </div>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            score !== null && step <= score ? "bg-primary" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function TipList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof ThumbsUpIcon;
  items: string[];
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4" aria-hidden />
        {title}
      </h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
