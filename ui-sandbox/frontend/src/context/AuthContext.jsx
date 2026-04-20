'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  getCurrentAuthSnapshot,
  loginWithGoogle as loginWithGoogleAuth,
  loginWithAuth,
  logoutFromAuth,
  requestLoginOtp,
  verifyLoginOtp,
  registerWithAuth,
  subscribeToAuthState
} from '../services/authClient';
import { initializeMyPresence } from '../services/chatClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(null);
  const stopPresenceRef = useRef(() => undefined);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Persist non-Supabase auth (and also helps restore faster on refresh).
    try {
      if (typeof window === 'undefined') return;
      if (!token || !user) {
        window.localStorage.removeItem('d_lite_auth_snapshot');
        return;
      }
      window.localStorage.setItem('d_lite_auth_snapshot', JSON.stringify({ token, user }));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [token, user]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (authUser) => {
      try {
        stopPresenceRef.current();
        const snapshot = await getCurrentAuthSnapshot(authUser);
        setToken(snapshot.token);
        setUser(snapshot.user);
        if (snapshot.user?.id) {
          stopPresenceRef.current = initializeMyPresence(snapshot.user.id);
        } else {
          stopPresenceRef.current = () => undefined;
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      stopPresenceRef.current();
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const snapshot = await loginWithAuth({ email, password });
    setToken(snapshot.token);
    setUser(snapshot.user);
  };

  const loginWithGoogle = async () => {
    // OAuth redirects away; snapshot may be null at this moment.
    await loginWithGoogleAuth();
  };

  const register = async (username, email, password, extras = {}) => {
    const snapshot = await registerWithAuth({ username, email, password });
    setToken(snapshot.token);
    const mergedUser =
      snapshot.user && extras
        ? {
            ...snapshot.user,
            ...(extras.gender ? { gender: extras.gender } : null),
            ...(extras.photoURL ? { photoURL: extras.photoURL } : null)
          }
        : snapshot.user;
    setUser(mergedUser);
  };

  const logout = async () => {
    await logoutFromAuth();
    setToken(null);
    setUser(null);
  };

  const requestOtp = async (email) => {
    await requestLoginOtp(email);
  };

  const verifyOtp = async (email, code) => {
    const snapshot = await verifyLoginOtp({ email, token: code });
    setToken(snapshot.token);
    setUser(snapshot.user);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        loginWithGoogle,
        requestOtp,
        verifyOtp,
        register,
        logout,
        isAuthenticated: !!token,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

