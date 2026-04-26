'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, prefersReducedMotion } from '@/lib/utils';

function useInViewOnce(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return () => undefined;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) {
          setInView(true);
          obs.disconnect();
        }
      },
      options || { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);

  return { ref, inView };
}

export default function AnimatedCounter({ value = 1000, durationMs = 900, format, className }) {
  const reduce = useMemo(() => prefersReducedMotion(), []);
  const { ref, inView } = useInViewOnce({ threshold: 0.25 });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return () => undefined;
    if (reduce) {
      setN(value);
      return () => undefined;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / Math.max(300, durationMs));
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value, durationMs]);

  const text = useMemo(() => {
    const v = Number.isFinite(n) ? n : 0;
    if (typeof format === 'function') return String(format(v));
    return v.toLocaleString();
  }, [n, format]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {text}
    </span>
  );
}

