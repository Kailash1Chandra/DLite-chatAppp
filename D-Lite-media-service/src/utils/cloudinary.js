import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env.js'

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
})

export const uploadToCloudinary = (file) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: env.cloudinary.folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          return reject(error)
        }

        return resolve(result)
      }
    )

    uploadStream.end(file.buffer)
  })

export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  })

  return result
}
