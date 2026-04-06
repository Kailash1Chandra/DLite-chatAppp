# D-Lite Media Service

This service handles file uploads and deletions using Node.js, Express, Multer, and Cloudinary. It stores files in Cloudinary and returns secure URLs. It does not store file records in a database.

## Features

- Runs on port `4004`
- Uploads files to Cloudinary
- Deletes files from Cloudinary
- Uses Multer memory storage for file handling
- Validates file type and file size before upload
- Returns the secure Cloudinary URL after upload

## Folder Structure

```text
src/
├── config/
│   └── env.js
├── controllers/
│   └── mediaController.js
├── middleware/
│   ├── error.js
│   └── logger.js
├── routes/
│   └── media.js
├── utils/
│   ├── cloudinary.js
│   └── multer.js
└── server.js
```

## API Endpoints

### `POST /upload`

Uploads one file to Cloudinary.

- Request type: `multipart/form-data`
- File field name: `file`

Response:

```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "publicId": "d-lite/media/example",
    "secureUrl": "https://res.cloudinary.com/...",
    "resourceType": "image",
    "format": "png",
    "bytes": 12345
  }
}
```

### `DELETE /delete`

Deletes a file from Cloudinary.

Request body:

```json
{
  "publicId": "d-lite/media/example",
  "resourceType": "image"
}
```

## File Validation

The service currently allows:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`
- `video/mp4`
- `video/webm`
- `video/quicktime`
- `application/pdf`

Maximum file size is controlled by `MAX_FILE_SIZE_MB`.

## Environment Variables

Create a `.env` file inside `D-Lite-media-service`:

```env
PORT=4004
CORS_ORIGINS=http://localhost:4000,http://localhost:3000,http://localhost:5173
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
CLOUDINARY_FOLDER=d-lite/media
MAX_FILE_SIZE_MB=10
```

## Run Locally

```bash
npm install
npm run dev
```

For production:

```bash
npm start
```

## Notes

- Files are uploaded directly to Cloudinary from server memory
- Only secure Cloudinary URLs are returned
- No database is used for storing media records
