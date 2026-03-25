/**
 * Fetches OpenSSF Scorecard code scanning analyses for all synced repos
 * using the GitHub App installation token from the settings DB.
 *
 * Usage: npx tsx scripts/get-scorecard-analyses.ts
 */

import { eq } from 'drizzle-orm';
import { loadGitHubAppCredentials, createInstallationOctokit } from '../src/services/github-auth.js';
import { db } from '../src/db/connection.js';
import { workspaces, repositories } from '../src/db/schema/index.js';

async function main() {
  // ── 1. Load workspace ───────────────────────────────────────────────────────
  const [workspace] = await db.select().from(workspaces).limit(1);
  if (!workspace) {
    console.error('No workspace found. Configure GitHub App in Settings first.');
    process.exit(1);
  }

  // ── 2. Build authenticated Octokit ─────────────────────────────────────────
  const creds = await loadGitHubAppCredentials(workspace.id);
  const octokit = createInstallationOctokit(creds);

  // ── 3. Get installation token (for curl display) ───────────────────────────
  const { token } = await octokit.auth({ type: 'installation' }) as { token: string };
  console.log('\n══════════════════════════════════════════');
  console.log('INSTALLATION ACCESS TOKEN (valid 1 hour):');
  console.log(token);
  console.log('══════════════════════════════════════════\n');

  // ── 4. Load synced repos ───────────────────────────────────────────────────
  const repos = await db
    .select({ owner: repositories.owner, name: repositories.name, fullName: repositories.fullName })
    .from(repositories)
    .where(eq(repositories.workspaceId, workspace.id));

  if (repos.length === 0) {
    console.log('No repositories synced. Trying cross-media-measurement directly...');
    repos.push({ owner: 'world-federation-of-advertisers', name: 'cross-media-measurement', fullName: 'world-federation-of-advertisers/cross-media-measurement' });
  }

  // ── 5. Fetch code scanning analyses for each repo ─────────────────────────
  for (const repo of repos) {
    console.log(`\n── Repo: ${repo.fullName} ──────────────────────────────────────`);

    try {
      // List all analyses, filtered to Scorecard tool
      const { data: analyses } = await octokit.request(
        'GET /repos/{owner}/{repo}/code-scanning/analyses',
        {
          owner: repo.owner,
          repo: repo.name,
          tool_name: 'OpenSSF Scorecard',
          per_page: 10,
        }
      );

      if (analyses.length === 0) {
        console.log('  No Scorecard analyses found for this repo.');
        continue;
      }

      console.log(`  Found ${analyses.length} Scorecard analyses:\n`);

      for (const analysis of analyses) {
        console.log(`  [${analysis.created_at}]`);
        console.log(`    ID          : ${analysis.id}`);
        console.log(`    Ref         : ${analysis.ref}`);
        console.log(`    Commit SHA  : ${analysis.commit_sha}`);
        console.log(`    Tool        : ${analysis.tool.name} v${analysis.tool.version ?? 'unknown'}`);
        console.log(`    Results     : ${analysis.results_count} findings`);
        console.log(`    Errors      : ${analysis.error || 'none'}`);
        console.log(`    SARIF URL   : GET /repos/${repo.owner}/${repo.name}/code-scanning/analyses/${analysis.id}`);
        console.log('');
      }

      // ── 6. Fetch SARIF detail for latest analysis ──────────────────────────
      const latest = analyses[0];
      console.log(`  Fetching SARIF detail for latest analysis (ID: ${latest.id})...`);

      const { data: sarifDetail } = await octokit.request(
        'GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}',
        {
          owner: repo.owner,
          repo: repo.name,
          analysis_id: latest.id,
          headers: { accept: 'application/sarif+json' },
        }
      );

      // SARIF is a large JSON — extract just the Scorecard rules/results
      const sarif = typeof sarifDetail === 'string' ? JSON.parse(sarifDetail) : sarifDetail;
      const run = sarif?.runs?.[0];

      if (run) {
        console.log('\n  ── SARIF Run Summary ────────────────────────────────');
        console.log(`  Tool     : ${run.tool?.driver?.name} v${run.tool?.driver?.version}`);
        console.log(`  Rules    : ${run.tool?.driver?.rules?.length ?? 0}`);
        console.log(`  Results  : ${run.results?.length ?? 0}`);

        console.log('\n  ── Rules (Scorecard Checks) ─────────────────────────');
        for (const rule of (run.tool?.driver?.rules ?? [])) {
          const score = rule.properties?.['security-severity'] ?? rule.defaultConfiguration?.level ?? '?';
          console.log(`  [${String(rule.id).padEnd(40)}] ${rule.shortDescription?.text ?? ''}`);
          console.log(`    severity: ${score}  |  ${rule.fullDescription?.text?.slice(0, 80) ?? ''}`);
        }

        console.log('\n  ── Results (Findings) ───────────────────────────────');
        for (const result of (run.results ?? []).slice(0, 20)) {
          const loc = result.locations?.[0]?.physicalLocation;
          console.log(`  [${result.ruleId?.padEnd(40)}] level=${result.level}`);
          console.log(`    msg: ${result.message?.text?.slice(0, 100) ?? ''}`);
          if (loc?.artifactLocation?.uri) {
            console.log(`    at : ${loc.artifactLocation.uri}:${loc.region?.startLine ?? ''}`);
          }
        }
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;
      console.error(`  ERROR (HTTP ${status ?? '?'}): ${msg}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
