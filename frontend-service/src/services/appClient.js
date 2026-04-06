import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const appConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']

function ensureClientRuntime() {
  if (typeof window === 'undefined') {
    throw new Error('Client SDK is only available in the browser runtime.')
  }
}

export function isAuthConfigured() {
  return requiredKeys.every((key) => Boolean(appConfig[key]))
}

export function createAuthConfigError() {
  const error = new Error('Authentication configuration is missing. Set required NEXT_PUBLIC_* environment variables.')
  error.code = 'auth/not-configured'
  return error
}

function ensureConfigured() {
  if (!isAuthConfigured()) {
    throw createAuthConfigError()
  }
}

function getClientApp() {
  ensureClientRuntime()
  ensureConfigured()
  return getApps().length ? getApp() : initializeApp(appConfig)
}

export function getAuthClient() {
  return getAuth(getClientApp())
}

export function getRealtimeDb() {
  return getDatabase(getClientApp())
}

export function getDocDb() {
  return getFirestore(getClientApp())
}

export function getBlobStore() {
  return getStorage(getClientApp())
}

