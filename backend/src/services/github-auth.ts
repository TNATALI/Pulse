import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { settings } from '../db/schema/settings.js';
import { decrypt } from './encryption.js';

/**
 * Read a decrypted setting from the DB for the given workspace.
 */
async function getSetting(workspaceId: string, key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)));
  if (rows.length === 0) return null;
  return decrypt(rows[0].encryptedValue);
}

export interface GitHubAppCredentials {
  appId: number;
  privateKey: string;
  installationId: number;
}

/**
 * Load GitHub App credentials from the settings table.
 * Throws a descriptive error if any required field is missing.
 */
export async function loadGitHubAppCredentials(workspaceId: string): Promise<GitHubAppCredentials> {
  const [appIdRaw, privateKeyRaw, installationIdRaw] = await Promise.all([
    getSetting(workspaceId, 'github_app_id'),
    getSetting(workspaceId, 'github_app_private_key'),
    getSetting(workspaceId, 'github_app_installation_id'),
  ]);

  if (!appIdRaw) throw new Error('github_app_id is not configured in Settings');
  if (!privateKeyRaw) throw new Error('github_app_private_key is not configured in Settings');
  if (!installationIdRaw) throw new Error('github_app_installation_id is not configured in Settings');

  const appId = parseInt(appIdRaw, 10);
  const installationId = parseInt(installationIdRaw, 10);

  if (isNaN(appId)) throw new Error('github_app_id must be a numeric App ID');
  if (isNaN(installationId)) throw new Error('github_app_installation_id must be numeric');

  // Normalise PEM — users sometimes paste with literal \n instead of real newlines
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  return { appId, privateKey, installationId };
}

/**
 * Create an Octokit instance authenticated as a GitHub App installation.
 *
 * Authentication flow:
 *   1. Signs a short-lived JWT using the App's private key (RS256).
 *   2. Exchanges the JWT for an installation access token via
 *      POST /app/installations/{id}/access_tokens.
 *   3. All subsequent API calls use that installation token.
 *
 * @octokit/auth-app handles steps 1-2 automatically and refreshes the
 * token before it expires (tokens last 1 hour).
 */
export function createInstallationOctokit(creds: GitHubAppCredentials): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: creds.appId,
      privateKey: creds.privateKey,
      installationId: creds.installationId,
    },
  });
}

/**
 * Convenience: load credentials and return a ready-to-use Octokit instance.
 */
export async function getInstallationOctokit(workspaceId: string): Promise<Octokit> {
  const creds = await loadGitHubAppCredentials(workspaceId);
  return createInstallationOctokit(creds);
}
