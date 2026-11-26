export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="space-y-6">
      <div className="h-10 w-2/3 max-w-md animate-pulse rounded-2xl bg-sand" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-sand" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-[4/5] animate-pulse bg-sand" />
            <div className="h-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
