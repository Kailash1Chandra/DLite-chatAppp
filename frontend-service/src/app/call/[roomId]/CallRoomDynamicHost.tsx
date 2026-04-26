"use client";

import dynamic from "next/dynamic";

const ZegoCallRoomPage = dynamic(() => import("./CallRoomClient").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center p-6 text-sm text-slate-600 dark:text-slate-300">
      Loading call…
    </div>
  ),
});

export default function CallRoomDynamicHost() {
  return <ZegoCallRoomPage />;
}
