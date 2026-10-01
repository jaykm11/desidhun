import { GoogleAuth } from 'google-auth-library';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function projectId(): string {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'desidhun';
}

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

/**
 * Enqueues a durable, authenticated Cloud Tasks request. The task worker owns
 * the long-running Lyria request so the browser never has to hold it open.
 */
export async function enqueueSongRender(uid: string, songId: string): Promise<void> {
  const queue = requiredEnvironment('CLOUD_TASKS_SONG_RENDER_QUEUE');
  const taskTargetUrl = requiredEnvironment('CLOUD_RUN_TASK_URL').replace(/\/$/, '');
  const taskServiceAccount = requiredEnvironment('CLOUD_RUN_TASK_SERVICE_ACCOUNT');
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error('Could not authenticate to Cloud Tasks.');

  const response = await fetch(
    `https://cloudtasks.googleapis.com/v2/projects/${projectId()}/locations/us-central1/queues/${queue}/tasks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: {
          httpRequest: {
            httpMethod: 'POST',
            url: `${taskTargetUrl}/api/v1/internal/songs/${encodeURIComponent(uid)}/${encodeURIComponent(songId)}/render`,
            oidcToken: {
              serviceAccountEmail: taskServiceAccount,
              audience: taskTargetUrl,
            },
          },
        },
      }),
    },
  );
  const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'Could not queue the song render.');
}
