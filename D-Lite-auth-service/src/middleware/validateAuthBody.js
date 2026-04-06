const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value)

export const validateAuthBody = (req, res, next) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address',
    })
  }

  if (String(password).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long',
    })
  }

  next()
}
