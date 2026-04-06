# D-Lite Auth Service

This service handles user authentication for the D-Lite microservices system using Supabase Auth. It runs on port `4001` and exposes simple endpoints for signup, login, and fetching the currently logged-in user.

## Features

- Built with Node.js and Express
- Uses ES modules
- Uses Supabase Auth for signup and login
- Validates Supabase JWTs for protected routes
- Keeps the folder structure simple and beginner-friendly

## Folder Structure

```text
src/
├── controllers/
│   └── authController.js
├── middleware/
│   ├── authMiddleware.js
│   ├── errorMiddleware.js
│   └── validateAuthBody.js
├── routes/
│   └── authRoutes.js
├── utils/
│   ├── logger.js
│   └── supabase.js
└── server.js
```

## API Endpoints

### `POST /signup`

Creates a new user in Supabase Auth.

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### `POST /login`

Logs in a user with email and password.

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### `GET /me`

Returns the current authenticated user.

Header:

```text
Authorization: Bearer <supabase-access-token>
```

## Environment Variables

Create a `.env` file inside `D-Lite-auth-service`:

```env
PORT=4001
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
CORS_ORIGINS=http://localhost:4000,http://localhost:3000,http://localhost:5173
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the service in development:

```bash
npm run dev
```

3. Or run it normally:

```bash
npm start
```

## How It Works

1. `POST /signup` calls `supabase.auth.signUp()`.
2. `POST /login` calls `supabase.auth.signInWithPassword()`.
3. `GET /me` checks the bearer token with `supabase.auth.getUser(token)`.
4. If the token is valid, the route returns the current user from Supabase.
