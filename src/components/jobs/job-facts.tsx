import type { JobInsights } from "@/lib/schemas/job-posting";
import { formatDate, formatSalary } from "./labels";

// Facts from the posting itself (start date, salary, listing expiry, application hints).
export function JobFacts({ insights }: { insights: JobInsights }) {
  const items = [
    { label: "Start", value: formatDate(insights.startDate) },
    { label: "Gehalt", value: formatSalary(insights.salary) },
    { label: "Anzeige online bis", value: formatDate(insights.validThrough) },
    { label: "Bewerbung", value: applicationNotes(insights) },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  if (items.length === 0) return null;
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function applicationNotes(insights: JobInsights): string | null {
  const notes = [
    insights.noCoverLetter ? "Anschreiben nicht nötig" : null,
    insights.quickApply ? "Schnellbewerbung möglich" : null,
  ].filter(Boolean);
  return notes.length ? notes.join(" · ") : null;
}
