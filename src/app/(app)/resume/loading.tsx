export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Wird geladen">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
