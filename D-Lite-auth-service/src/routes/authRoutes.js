import express from 'express'
import { signup, login, getCurrentUser } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { validateAuthBody } from '../middleware/validateAuthBody.js'

const router = express.Router()

router.post('/signup', validateAuthBody, signup)
router.post('/login', validateAuthBody, login)
router.get('/me', requireAuth, getCurrentUser)

export default router
