import dynamic from 'next/dynamic';

const LandingPage = dynamic(() => import('@/views/LandingPage'), {
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#F3F4F6] text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      Loading…
    </div>
  ),
});

export default function Home() {
  return <LandingPage />;
}
