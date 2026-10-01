import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebaseAuthInstance, isFirebaseConfigured } from '../lib/firebase';

interface AuthContextValue {
  isConfigured: boolean;
  isLoading: boolean;
  user: User | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

export function describeAuthError(error: unknown): string {
  switch (authErrorCode(error)) {
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/weak-password':
      return 'Choose a password of at least six characters.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email address. Sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email address and password do not match an account.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'The network could not be reached. Check your connection and try again.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Sign-in could not be completed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuthInstance) {
      setIsLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuthInstance, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const auth = firebaseAuthInstance;
    const requireAuth = () => {
      if (!auth) {
        throw new Error('Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* values to mobile/.env.');
      }
      return auth;
    };

    return {
      isConfigured: isFirebaseConfigured,
      isLoading,
      user,
      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
      },
      async registerWithEmail(email, password) {
        const credential = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
        await sendEmailVerification(credential.user).catch(() => undefined);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(requireAuth(), email.trim());
      },
      async signInWithGoogleIdToken(idToken) {
        await signInWithCredential(requireAuth(), GoogleAuthProvider.credential(idToken));
      },
      async signOutUser() {
        if (auth) await signOut(auth);
      },
    };
  }, [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

/** Throws a readable error instead of letting screens call the API without a user. */
export function useRequiredUser(): User | null {
  return useAuth().user;
}
