import { WebClient } from '@slack/web-api';
import { retry, handleAll, ExponentialBackoff } from 'cockatiel';
import type { SlackVerifyResponse } from '@pulse/shared';

const retryPolicy = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff(),
});

export async function verifySlackToken(token: string): Promise<SlackVerifyResponse> {
  try {
    const client = new WebClient(token);
    const result = await retryPolicy.execute(() => client.auth.test());

    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Unknown error' };
    }

    return {
      ok: true,
      teamName: result.team ?? undefined,
      teamId: result.team_id ?? undefined,
      botUserId: result.user_id ?? undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to verify token';
    return { ok: false, error: message };
  }
}
