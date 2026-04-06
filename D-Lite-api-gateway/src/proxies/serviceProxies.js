import { createProxyMiddleware } from 'http-proxy-middleware'

const buildProxyOptions = (target, serviceName) => ({
  target,
  changeOrigin: true,
  ws: true,

  // Strip the gateway prefix so each service receives routes from its own root.
  pathRewrite: (path) => path.replace(new RegExp(`^/${serviceName}`), ''),

  onError: (err, _req, res) => {
    console.error(`${serviceName} proxy error:`, err.message)

    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: `${serviceName} service is unavailable`,
      })
    }
  },
})

export const createServiceProxy = (target, serviceName) =>
  createProxyMiddleware(buildProxyOptions(target, serviceName))
