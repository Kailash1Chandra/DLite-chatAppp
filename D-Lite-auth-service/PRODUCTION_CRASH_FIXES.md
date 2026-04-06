# Auth Service Production Crash Fixes

## Issues Fixed

### 1. **Debug Instrumentation Causing Crashes**
**Problem**: Debug fetch calls to `http://127.0.0.1:7243` were failing in production, causing ECONNREFUSED errors.

**Fix**: 
- Wrapped all debug instrumentation in `if (process.env.NODE_ENV === 'development')` checks
- Added try-catch blocks to silently ignore debug logging failures

### 2. **Database Connection Failures**
**Problem**: If MongoDB connection failed on startup, service would exit immediately without retry.

**Fix**:
- Added `connectDBWithRetry()` function with exponential backoff
- Retries up to 5 times with increasing delays (2s, 4s, 8s, 16s, 32s)
- Better error logging for each retry attempt
- Added MongoDB connection event handlers (error, disconnected, reconnected)

### 3. **Unhandled Promise Rejections**
**Problem**: Unhandled promise rejections were causing immediate process exit in production.

**Fix**:
- In production, unhandled rejections are logged but don't exit immediately
- Allows service to continue running despite minor async errors
- In development, still exits to catch issues early

### 4. **Missing Error Handling in Routes**
**Problem**: Some async route handlers weren't properly wrapped, causing uncaught errors.

**Fix**:
- Wrapped all async route handlers with `asyncHandler()` middleware
- Updated all controller functions to accept `next` parameter
- Changed all catch blocks to use `next(error)` instead of `res.status(500)`

### 5. **Server Error Handling**
**Problem**: Port binding errors and server errors weren't handled gracefully.

**Fix**:
- Added specific handling for `EADDRINUSE` errors
- Added delay before exit to allow logs to be written
- Better error messages for port conflicts

### 6. **Database Connection Configuration**
**Problem**: Database connection lacked proper timeout and retry configuration.

**Fix**:
- Added `serverSelectionTimeoutMS` (5s default)
- Added `socketTimeoutMS` (45s default)
- Added `connectTimeoutMS` (10s default)
- Added `retryWrites` and `retryReads` for better resilience
- Made pool sizes configurable via environment variables

## Changes Made

### Files Modified:
1. `src/server.js`
   - Removed production debug instrumentation
   - Added database connection retry logic
   - Improved unhandled rejection handling
   - Better server error handling

2. `src/config/database.js`
   - Enhanced connection configuration
   - Added connection event handlers
   - Better error handling and logging

3. `src/controllers/authController.js`
   - Added `next` parameter to all controller functions
   - Changed error handling to use `next(error)`

4. `src/routes/authRoutes.js`
   - Wrapped all routes with `asyncHandler()`

5. `src/routes/userRoutes.js`
   - Wrapped all routes with `asyncHandler()`
   - Removed duplicate error handling

## Environment Variables

New optional environment variables for database configuration:

```env
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=5
MONGODB_SERVER_SELECTION_TIMEOUT=5000
MONGODB_SOCKET_TIMEOUT=45000
MONGODB_CONNECT_TIMEOUT=10000
```

## Testing

To test the fixes:

1. **Database Connection Retry**:
   - Temporarily use invalid MongoDB URI
   - Service should retry 5 times before exiting

2. **Unhandled Rejections**:
   - In production, service should log but continue running
   - In development, service should exit

3. **Error Handling**:
   - All routes should return proper error responses
   - No uncaught exceptions should crash the service

## Production Deployment Checklist

- [ ] Ensure `NODE_ENV=production` is set
- [ ] Verify `MONGODB_URI` is correctly configured
- [ ] Verify `JWT_SECRET` is set and secure
- [ ] Check that port is available (or set custom PORT)
- [ ] Verify CORS_ORIGINS includes production frontend URL
- [ ] Monitor logs for any unhandled errors
- [ ] Set up process manager (PM2, systemd, etc.) for auto-restart

## Monitoring

Watch for these log patterns:
- "Database connection attempt X/5 failed" - Database connectivity issues
- "Unhandled promise rejection" - Async error handling issues
- "Port X is already in use" - Port conflict
- "Uncaught exception" - Programming errors (should be rare)
