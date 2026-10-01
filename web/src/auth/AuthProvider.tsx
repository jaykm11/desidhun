import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebaseAuth, isFirebaseConfigured, isSameSiteAuth } from '../lib/firebase';

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

/** Raised when the visitor dismissed the popup themselves — not worth reporting. */
export class SignInAbortedError extends Error {
  constructor() {
    super('Sign-in was cancelled.');
    this.name = 'SignInAbortedError';
  }
}

function describeAuthError(error: unknown): Error {
  const code = authErrorCode(error);
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return new SignInAbortedError();
    case 'auth/unauthorized-domain':
      return new Error(`This address is not authorised for sign-in. Open the site at https://desidhun.net and try again. (${code})`);
    case 'auth/network-request-failed':
      return new Error(`Google could not be reached. Check your connection or any ad/tracker blocker and try again. (${code})`);
    case 'auth/account-exists-with-different-credential':
      return new Error(`An account already exists for this email address with a password. Sign in with your email and password instead. (${code})`);
    case 'auth/operation-not-allowed':
      return new Error(`Google sign-in is switched off for this project. (${code})`);
    case 'auth/internal-error':
      return new Error(`Google sign-in failed unexpectedly. Please try again. (${code})`);
    default:
      return new Error(
        code
          ? `Google sign-in could not be completed. (${code})`
          : 'Google sign-in could not be completed. Please try again.',
      );
  }
}

/**
 * Some browsers refuse to open the popup at all — a blocker, an in-app webview,
 * or partitioned storage. Redirect is the only route left in those cases.
 */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/**
 * Firefox loses the popup's opener once Google's pages apply their opener policy,
 * so the SDK reports a closed popup even when the visitor finished signing in.
 * Redirect sign-in is reliable there as long as the auth handler is same-site.
 */
function prefersRedirectSignIn(): boolean {
  return isSameSiteAuth && typeof navigator !== 'undefined' && /firefox|fxios/i.test(navigator.userAgent);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsLoading(false);
      return;
    }

    // Finishes the leg of a redirect sign-in that started before this load.
    getRedirectResult(firebaseAuth).catch((error) => console.error('Google redirect sign-in failed', error));

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isFirebaseConfigured,
      isLoading,
      user,
      async signInWithGoogle() {
        if (!firebaseAuth) {
          throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values before enabling sign-in.');
        }
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        if (prefersRedirectSignIn()) {
          await signInWithRedirect(firebaseAuth, provider);
          return;
        }
        try {
          await signInWithPopup(firebaseAuth, provider);
        } catch (error) {
          if (REDIRECT_FALLBACK_CODES.has(authErrorCode(error))) {
            await signInWithRedirect(firebaseAuth, provider);
            return;
          }
          console.error('Google sign-in failed', error);
          throw describeAuthError(error);
        }
      },
      async signInWithEmail(email, password) {
        if (!firebaseAuth) {
          throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values before enabling sign-in.');
        }
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      async registerWithEmail(email, password) {
        if (!firebaseAuth) {
          throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* values before enabling sign-in.');
        }
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await sendEmailVerification(credential.user, {
          url: `${window.location.origin}/`,
          handleCodeInApp: false,
        });
      },
      async signOutUser() {
        if (firebaseAuth) await signOut(firebaseAuth);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
