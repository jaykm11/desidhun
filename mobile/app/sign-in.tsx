import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { describeAuthError, useAuth } from '@/auth/AuthProvider';
import { Banner, Button, Caption, Heading, Input, Title, styles } from '@/components/ui';
import { isApiConfigured } from '@/lib/api';
import { colors, spacing } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

const googleClientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

const googleIsConfigured = Object.values(googleClientIds).some(Boolean);

export default function SignInScreen() {
  const router = useRouter();
  const { isConfigured, signInWithEmail, registerWithEmail, resetPassword, signInWithGoogleIdToken, user } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'register'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest(googleClientIds);

  useEffect(() => {
    if (user) router.replace('/(tabs)/create');
  }, [user, router]);

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) return;
    setBusy(true);
    void signInWithGoogleIdToken(idToken)
      .catch((cause) => setError(describeAuthError(cause)))
      .finally(() => setBusy(false));
  }, [googleResponse, signInWithGoogleIdToken]);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password);
        setNotice('Account created. Check your inbox to verify your email address.');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Enter your email address first, then tap Forgot password.');
      return;
    }
    try {
      await resetPassword(email);
      setNotice('A password reset link is on its way to your inbox.');
    } catch (cause) {
      setError(describeAuthError(cause));
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg }}
      >
        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Ionicons name="musical-notes" size={44} color={colors.accent} />
          <Title>Meri Bhi Suno</Title>
          <Caption>Make songs, film dialogue and voiceovers in your language.</Caption>
        </View>

        {!isConfigured ? (
          <Banner
            tone="error"
            message="Firebase is not configured. Copy mobile/.env.example to mobile/.env, fill in the EXPO_PUBLIC_FIREBASE_* values, then restart Expo."
          />
        ) : null}
        {isConfigured && !isApiConfigured() ? (
          <Banner tone="error" message="Set EXPO_PUBLIC_API_BASE_URL in mobile/.env so the app can reach the backend." />
        ) : null}
        {error ? <Banner tone="error" message={error} /> : null}
        {notice ? <Banner tone="success" message={notice} /> : null}

        <View style={[styles.card, { gap: spacing.md }]}>
          <Heading>{mode === 'sign-in' ? 'Sign in' : 'Create an account'}</Heading>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
          />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
          />
          <Button
            label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
            onPress={() => void submit()}
            busy={busy}
            disabled={!isConfigured}
          />
          {googleIsConfigured ? (
            <Button
              label="Continue with Google"
              variant="secondary"
              icon="logo-google"
              disabled={!isConfigured}
              onPress={() => void promptGoogle()}
            />
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setMode(mode === 'sign-in' ? 'register' : 'sign-in')} hitSlop={8}>
              <Text style={{ color: colors.accent, fontSize: 13 }}>
                {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
              </Text>
            </Pressable>
            {mode === 'sign-in' ? (
              <Pressable onPress={() => void forgotPassword()} hitSlop={8}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Forgot password</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Caption>
          Generated audio is original. Do not use it to imitate a real person or to copy an existing song.
        </Caption>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
