import { createAppAuth } from '@octokit/auth-app';
import { loadGitHubAppCredentials } from '../src/services/github-auth.js';
import { db } from '../src/db/connection.js';
import { workspaces } from '../src/db/schema/index.js';

async function main() {
  const [workspace] = await db.select().from(workspaces).limit(1);
  const creds = await loadGitHubAppCredentials(workspace.id);

  const auth = createAppAuth({ appId: creds.appId, privateKey: creds.privateKey });
  const { token: jwt } = await auth({ type: 'app' }) as { token: string };

  const resp = await fetch(`https://api.github.com/app/installations/${creds.installationId}`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json' },
  });
  const data = await resp.json() as Record<string, unknown>;

  console.log('\n── Installation permissions (what the app currently has) ──');
  console.log(JSON.stringify(data.permissions, null, 2));
  console.log('\n── App info ─────────────────────────────────────────────');
  console.log('Account  :', (data.account as Record<string, unknown>)?.login);
  console.log('App ID   :', creds.appId);
  console.log('Install  :', creds.installationId);
  console.log('Suspended:', data.suspended_at ?? 'no');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
