import { Router } from 'express'
import { uploadFile, deleteFile } from '../controllers/mediaController.js'
import { upload } from '../utils/multer.js'

const router = Router()

router.post('/upload', upload.single('file'), uploadFile)
router.delete('/delete', deleteFile)

export default router
