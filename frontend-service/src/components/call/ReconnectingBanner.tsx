"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type Props = {
  visible: boolean
  tone?: "warning" | "success"
  message: string
  className?: string
}

export function ReconnectingBanner({ visible, tone = "warning", message, className }: Props) {
  const reduce = useReducedMotion()
  const bg =
    tone === "success"
      ? "border-emerald-500/25 bg-emerald-500/15 text-emerald-50"
      : "border-amber-500/25 bg-amber-500/15 text-amber-50"

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className={cn(
            "pointer-events-none absolute left-0 right-0 top-0 z-30 flex justify-center px-4 pt-3",
            className
          )}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <div className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold backdrop-blur", bg)}>
            <span className="inline-flex items-center gap-1">
              <span>{message}</span>
              <span className="call-dots" aria-hidden="true">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

