import 'dotenv/config'
import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import messageRoutes from './routes/messageRoutes.js'
import { registerChatHandlers } from './sockets/chatSocket.js'

const app = express()
const server = http.createServer(app)
const PORT = Number(process.env.PORT || 4002)
const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const io = new Server(server, {
  cors: {
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
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
    service: 'chat-service',
    message: 'Chat service is running',
  })
})

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'chat-service',
    status: 'ok',
  })
})

app.use('/', messageRoutes)

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  })
})

app.use((err, _req, res, _next) => {
  console.error('chat-service error:', err.message)

  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
  })
})

registerChatHandlers(io)

server.listen(PORT, () => {
  console.log(`chat-service running on port ${PORT}`)
})
