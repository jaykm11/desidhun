import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Browsers that partition third-party storage (Firefox, Safari) lose the sign-in
 * result when the auth handler lives on another site, so serve it from the
 * Firebase Hosting domain the visitor is already on. Each of these must be an
 * authorised redirect URI (`https://<host>/__/auth/handler`) on the OAuth client.
 */
const SAME_SITE_AUTH_HOSTS = new Set(['desidhun.net', 'desidhun.web.app']);

export const isSameSiteAuth =
  typeof window !== 'undefined' && SAME_SITE_AUTH_HOSTS.has(window.location.hostname);

const authDomain = isSameSiteAuth ? window.location.hostname : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
);

const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const firebaseAuth = app ? getAuth(app) : null;
