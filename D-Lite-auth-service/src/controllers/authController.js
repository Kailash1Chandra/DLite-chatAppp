import { isSupabaseConfigured, supabase } from '../utils/supabase.js'

const formatAuthResponse = (authData) => ({
  accessToken: authData.session?.access_token || null,
  refreshToken: authData.session?.refresh_token || null,
  expiresIn: authData.session?.expires_in || null,
  tokenType: authData.session?.token_type || null,
  user: authData.user || null,
})

export const signup = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        message: 'Auth service is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)',
      })
    }

    const { email, password } = req.body

    // Supabase creates the user and returns the authenticated session when allowed.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      error.status = 400
      throw error
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful',
      data: formatAuthResponse(data),
    })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        success: false,
        message: 'Auth service is not configured (missing SUPABASE_URL / SUPABASE_ANON_KEY)',
      })
    }

    const { email, password } = req.body

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      error.status = 401
      throw error
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: formatAuthResponse(data),
    })
  } catch (error) {
    next(error)
  }
}

export const getCurrentUser = async (req, res) => {
  res.json({
    success: true,
    message: 'Current user fetched successfully',
    data: {
      user: req.user,
    },
  })
}
