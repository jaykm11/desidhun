import { useAuth } from './auth/AuthProvider';
import { CommunityRail } from './CommunitySongs';

export default function ExplorePage() {
  const { isLoading, user, signInWithGoogle } = useAuth();

  return (
    <main className="legal-page explore-page">
      <p className="workflow-step">EXPLORE</p>
      {isLoading ? (
        <p>Checking account…</p>
      ) : !user ? (
        <button className="google-button" onClick={() => void signInWithGoogle()}>
          Sign in to explore the repository
        </button>
      ) : (
        <CommunityRail user={user} />
      )}
    </main>
  );
}
