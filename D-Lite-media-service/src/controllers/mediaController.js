import { deleteFromCloudinary, uploadToCloudinary } from '../utils/cloudinary.js'

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      })
    }

    const result = await uploadToCloudinary(req.file)

    // We only return the uploaded URL and useful file metadata. No database storage is used here.
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        resourceType: result.resource_type,
        format: result.format,
        bytes: result.bytes,
      },
    })
  } catch (error) {
    next(error)
  }
}

export const deleteFile = async (req, res, next) => {
  try {
    const { publicId, resourceType } = req.body

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: 'publicId is required',
      })
    }

    const result = await deleteFromCloudinary(publicId, resourceType)

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}
