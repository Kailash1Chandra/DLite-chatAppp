import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { get, ref, set, update } from 'firebase/database'
import { createAuthConfigError, getAuthClient, getRealtimeDb, isAuthConfigured } from './appClient'

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function toProfile(authUser, profile = {}) {
  const username = profile.username || authUser.displayName || authUser.email?.split('@')[0] || 'User'
  return {
    id: authUser.uid,
    uid: authUser.uid,
    email: authUser.email || '',
    username,
    photoURL: profile.photoURL || '',
  }
}

async function ensureUserProfile({ realtimeDb, user, fallbackEmail, fallbackUsername }) {
  const profileRef = ref(realtimeDb, `users/${user.uid}`)
  const profileSnap = await get(profileRef)
  if (profileSnap.exists()) {
    const existing = profileSnap.val() || {}
    const existingUsername = existing.username || user.displayName || user.email?.split('@')[0] || 'User'
    const expectedLower = normalizeUsername(existingUsername)

    if (existing.usernameLower !== expectedLower) {
      try {
        await update(profileRef, { usernameLower: expectedLower })
      } catch {
        // best-effort
      }
    }
    return { ...existing, username: existingUsername, usernameLower: expectedLower }
  }

  const profile = {
    uid: user.uid,
    username: fallbackUsername || user.displayName || user.email?.split('@')[0] || 'User',
    usernameLower: normalizeUsername(fallbackUsername || user.displayName || user.email?.split('@')[0] || 'User'),
    email: fallbackEmail || user.email || '',
    photoURL: user.photoURL || '',
    createdAt: Date.now(),
  }
  await set(profileRef, profile)
  return profile
}

export async function registerWithAuth({ username, email, password }) {
  if (!isAuthConfigured()) throw createAuthConfigError()
  const auth = getAuthClient()
  const realtimeDb = getRealtimeDb()

  const credential = await createUserWithEmailAndPassword(auth, email, password)
  if (username) {
    await updateProfile(credential.user, { displayName: username })
  }

  const profile = await ensureUserProfile({
    realtimeDb,
    user: credential.user,
    fallbackEmail: email,
    fallbackUsername: username,
  })

  const token = await credential.user.getIdToken()
  return { token, user: toProfile(credential.user, profile) }
}

export async function loginWithAuth({ email, password }) {
  if (!isAuthConfigured()) throw createAuthConfigError()
  const auth = getAuthClient()
  const realtimeDb = getRealtimeDb()

  const credential = await signInWithEmailAndPassword(auth, email, password)
  const profile = await ensureUserProfile({ realtimeDb, user: credential.user, fallbackEmail: email })
  const token = await credential.user.getIdToken()
  return { token, user: toProfile(credential.user, profile || undefined) }
}

export async function loginWithGoogle() {
  if (!isAuthConfigured()) throw createAuthConfigError()
  const auth = getAuthClient()
  const realtimeDb = getRealtimeDb()

  const provider = new GoogleAuthProvider()
  const credential = await signInWithPopup(auth, provider)
  const profile = await ensureUserProfile({ realtimeDb, user: credential.user })
  const token = await credential.user.getIdToken()
  return { token, user: toProfile(credential.user, profile) }
}

export async function logoutFromAuth() {
  if (!isAuthConfigured()) return
  const auth = getAuthClient()
  const realtimeDb = getRealtimeDb()
  const current = auth.currentUser
  if (current) {
    try {
      await update(ref(realtimeDb, `presence/${current.uid}`), {
        online: false,
        lastSeen: Date.now(),
      })
    } catch {
      /* best-effort */
    }
  }
  await signOut(auth)
}

export async function getCurrentAuthSnapshot(authUser) {
  if (!authUser) return { token: null, user: null }
  if (!isAuthConfigured()) return { token: null, user: null }

  const realtimeDb = getRealtimeDb()
  const [token, profileSnap] = await Promise.all([
    authUser.getIdToken(),
    get(ref(realtimeDb, `users/${authUser.uid}`)),
  ])
  const profile = profileSnap.exists() ? profileSnap.val() : {}
  return { token, user: toProfile(authUser, profile) }
}

export function subscribeToAuthState(handler) {
  if (!isAuthConfigured()) {
    handler(null)
    return () => undefined
  }
  const auth = getAuthClient()
  return onAuthStateChanged(auth, handler)
}

