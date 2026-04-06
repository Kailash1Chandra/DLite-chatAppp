import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import { env } from './config/env.js'
import { registerCallHandlers } from './sockets/callSocket.js'

const app = express()
const httpServer = http.createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

app.use(
  cors({
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    credentials: true,
  })
)
app.use(express.json())

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`)
  next()
})

app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'call-service',
    message: 'WebRTC signaling service is running',
  })
})

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'call-service',
    status: 'ok',
  })
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  })
})

app.use((err, _req, res, _next) => {
  console.error('call-service error:', err.message)

  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  })
})

registerCallHandlers(io)

httpServer.listen(env.port, () => {
  console.log(`call-service running on port ${env.port}`)
})
