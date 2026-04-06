import dotenv from 'dotenv'

dotenv.config()

const env = {
  port: Number(process.env.GATEWAY_PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.GATEWAY_CORS_ORIGIN || '*',
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  chatServiceUrl: process.env.CHAT_SERVICE_URL || 'http://localhost:4002',
  callServiceUrl: process.env.CALL_SERVICE_URL || 'http://localhost:4003',
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL || 'http://localhost:4004',
}

export default env
