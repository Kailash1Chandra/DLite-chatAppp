"use client"

export type CallQuality = "excellent" | "good" | "fair" | "poor"

export type CallQualitySnapshot = {
  quality: CallQuality
  rtt: number
  packetLoss: number
  fps: number
  bitrate: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toPct(loss: number, total: number) {
  if (!total) return 0
  return clamp((loss / total) * 100, 0, 100)
}

function scoreQuality({ rtt, packetLoss, fps }: { rtt: number; packetLoss: number; fps: number }): CallQuality {
  if (rtt < 100 && packetLoss < 1 && fps >= 24) return "excellent"
  if (rtt < 250 && packetLoss < 3 && fps >= 15) return "good"
  if (rtt < 500 && packetLoss < 7) return "fair"
  return "poor"
}

export function subscribeQuality(
  peerConnection: RTCPeerConnection | null,
  cb: (q: CallQualitySnapshot) => void,
  intervalMs = 2000
) {
  if (!peerConnection) return () => undefined
  let disposed = false
  let timer: any = null

  const tick = async () => {
    if (disposed) return
    try {
      const stats = await peerConnection.getStats()
      let rtt = 0
      let packetsLost = 0
      let packetsTotal = 0
      let fps = 0
      let bitrate = 0

      stats.forEach((report: any) => {
        if (report.type === "candidate-pair" && report.state === "succeeded") {
          if (typeof report.currentRoundTripTime === "number") rtt = report.currentRoundTripTime * 1000
        }
        if (report.type === "inbound-rtp" && report.kind === "video") {
          packetsLost += Number(report.packetsLost || 0)
          packetsTotal += Number(report.packetsReceived || 0) + Number(report.packetsLost || 0)
          fps = Math.max(fps, Number(report.framesPerSecond || 0))
          if (typeof report.bytesReceived === "number" && typeof report.timestamp === "number") {
            // bitrate: best-effort (needs delta; approximate using recent window)
            // Keep it simple: if available, use report.bitrateMean or similar.
            bitrate = Math.max(bitrate, Number(report.bitrateMean || 0))
          }
        }
      })

      const packetLoss = toPct(packetsLost, packetsTotal)
      const quality = scoreQuality({ rtt, packetLoss, fps })
      cb({ quality, rtt, packetLoss, fps, bitrate })
    } catch {
      cb({ quality: "poor", rtt: 999, packetLoss: 99, fps: 0, bitrate: 0 })
    }
  }

  timer = setInterval(tick, Math.max(500, intervalMs))
  tick()

  return () => {
    disposed = true
    if (timer) clearInterval(timer)
  }
}

