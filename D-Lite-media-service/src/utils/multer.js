import multer from 'multer'
import env from '../config/env.js'

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
]

const storage = multer.memoryStorage()

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error('Unsupported file type')
    error.status = 400
    return cb(error)
  }

  cb(null, true)
}

export const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
  },
  fileFilter,
})
