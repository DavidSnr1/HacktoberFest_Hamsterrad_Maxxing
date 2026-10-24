export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]" aria-busy="true" aria-label="Wird geladen">
      <div className="h-[32rem] animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
