export default function Loading() {
  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center bg-ui-canvas p-6">
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-ui-border bg-ui-panel px-6 py-5 shadow-xl shadow-black/5 dark:shadow-black/35">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-r from-ui-grad-from to-ui-grad-to" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Loading…</p>
      </div>
    </div>
  );
}

