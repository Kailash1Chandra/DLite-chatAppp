import { isSupabaseConfigured, supabase } from '../utils/supabase.js'

export const requireAuth = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        message: 'Auth service is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)',
      })
    }

    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required',
      })
    }

    // Supabase validates the JWT and returns the matching user if the token is valid.
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      })
    }

    req.user = data.user
    next()
  } catch (error) {
    next(error)
  }
}
