const parseOrigins = (value) => {
  const origins = (value || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return origins.length > 0 ? origins : ['*']
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT || '4003', 10),
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
}

export default env
