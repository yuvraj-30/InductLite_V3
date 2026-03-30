function SettingsLoadingCard() {
  return (
    <div className="surface-panel h-full p-4">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
        <div className="h-6 w-32 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
        <div className="h-12 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
      </div>
    </div>
  );
}

export default function AdminSettingsLoading() {
  return (
    <div className="space-y-6 p-3 sm:p-4">
      <section className="surface-panel-strong p-5 sm:p-6">
        <div className="space-y-3">
          <div className="h-4 w-20 animate-pulse rounded bg-[color:var(--bg-surface)]" />
          <div className="h-9 w-48 animate-pulse rounded bg-[color:var(--bg-surface)]" />
          <div className="h-5 max-w-2xl animate-pulse rounded bg-[color:var(--bg-surface)]" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SettingsLoadingCard key={index} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)] xl:items-start">
        <div className="space-y-6">
          <section className="surface-panel p-5">
            <div className="space-y-3">
              <div className="h-3 w-36 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="h-7 w-64 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="h-24 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]" />
            </div>
          </section>
          <section className="surface-panel p-5">
            <div className="space-y-3">
              <div className="h-3 w-32 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="h-7 w-56 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="h-24 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]" />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface-panel p-5">
            <div className="space-y-3">
              <div className="h-3 w-28 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="h-7 w-52 animate-pulse rounded bg-[color:var(--bg-surface-strong)]" />
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]"
                  />
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
