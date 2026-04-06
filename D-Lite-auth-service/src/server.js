import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import authRoutes from './routes/authRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js'
import { requestLogger } from './utils/logger.js'

const app = express()
const PORT = Number(process.env.PORT || 4001)
const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  })
)
app.use(express.json())
app.use(requestLogger)

app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'auth-service',
    message: 'Supabase auth service is running',
  })
})

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'auth-service',
    status: 'ok',
  })
})

// These routes are mounted at the root because the API gateway already forwards /auth here.
app.use('/', authRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`auth-service running on port ${PORT}`)
})
