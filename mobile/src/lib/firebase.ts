import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
);

/** Ships in the React Native build of firebase/auth but is missing from its web typings. */
const getReactNativePersistence = (firebaseAuth as unknown as {
  getReactNativePersistence?: (storage: unknown) => Persistence;
}).getReactNativePersistence;

function createAuth(): Auth | null {
  if (!isFirebaseConfigured) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  if (!getReactNativePersistence) return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // initializeAuth throws if it already ran for this app during a fast refresh.
    return getAuth(app);
  }
}

export const firebaseAuthInstance = createAuth();
