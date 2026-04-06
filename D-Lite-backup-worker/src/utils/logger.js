export const logger = {
  info(message, data = {}) {
    console.log(JSON.stringify({ level: 'info', message, ...data, timestamp: new Date().toISOString() }))
  },
  warn(message, data = {}) {
    console.warn(JSON.stringify({ level: 'warn', message, ...data, timestamp: new Date().toISOString() }))
  },
  error(message, data = {}) {
    console.error(JSON.stringify({ level: 'error', message, ...data, timestamp: new Date().toISOString() }))
  },
}
