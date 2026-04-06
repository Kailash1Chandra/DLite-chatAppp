import express from 'express'
import cors from 'cors'
import env from './config/env.js'
import mediaRoutes from './routes/media.js'
import { requestLogger } from './middleware/logger.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

const app = express()

app.use(
  cors({
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    credentials: true,
  })
)
app.use(express.json())
app.use(requestLogger)

app.get('/', (_req, res) => {
  res.json({
    success: true,
    service: 'media-service',
    message: 'Media service is running',
  })
})

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'media-service',
    status: 'ok',
  })
})

app.use('/', mediaRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  console.log(`media-service running on port ${env.port}`)
})
