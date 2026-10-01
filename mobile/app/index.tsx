import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { Loading, Screen } from '@/components/ui';

export default function Index() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Screen>
        <Loading label="Starting Meri Bhi Suno…" />
      </Screen>
    );
  }

  return <Redirect href={user ? '/(tabs)/create' : '/sign-in'} />;
}
