import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PrivateRoute } from "@/components/PrivateRoute";

const CallUI = dynamic(() => import("@/components/CallUI"), {
  loading: () => (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-center text-sm text-slate-600 dark:text-slate-400">
      Loading call…
    </div>
  ),
});

export default function WebRtcCallPage() {
  return (
    <PrivateRoute>
      <Suspense fallback={<div className="p-8 text-center text-slate-600">Loading…</div>}>
        <CallUI />
      </Suspense>
    </PrivateRoute>
  );
}
