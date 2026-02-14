import { eq, and } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { settings } from '../db/schema/settings.js';
import { workspaces } from '../db/schema/workspaces.js';
import { encrypt, decrypt } from './encryption.js';
import {
  SETTING_KEYS,
  SENSITIVE_SETTING_KEYS,
  type SettingKey,
  type SettingResponse,
  type SettingInput,
} from '@pulse/shared';

const DEFAULT_WORKSPACE_NAME = 'Default';

async function ensureDefaultWorkspace(): Promise<string> {
  const existing = await db.select().from(workspaces).limit(1);
  if (existing.length > 0) {
    return existing[0].id;
  }
  const [created] = await db
    .insert(workspaces)
    .values({ name: DEFAULT_WORKSPACE_NAME })
    .returning({ id: workspaces.id });
  return created.id;
}

function maskValue(value: string): string {
  if (value.length <= 4) return '••••';
  return '••••' + value.slice(-4);
}

function toResponse(key: SettingKey, decryptedValue: string | null): SettingResponse {
  if (decryptedValue === null) {
    return { key, value: null, isSet: false };
  }
  const isSensitive = (SENSITIVE_SETTING_KEYS as readonly string[]).includes(key);
  return {
    key,
    value: isSensitive ? maskValue(decryptedValue) : decryptedValue,
    isSet: true,
  };
}

export async function getAllSettings(): Promise<SettingResponse[]> {
  const workspaceId = await ensureDefaultWorkspace();
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.workspaceId, workspaceId));

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, decrypt(row.encryptedValue));
  }

  return SETTING_KEYS.map((key) => toResponse(key, map.get(key) ?? null));
}

export async function upsertSettings(inputs: SettingInput[]): Promise<SettingResponse[]> {
  const workspaceId = await ensureDefaultWorkspace();

  for (const { key, value } of inputs) {
    const encryptedValue = encrypt(value);
    const now = new Date();
    await db
      .insert(settings)
      .values({ workspaceId, key, encryptedValue, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [settings.workspaceId, settings.key],
        set: { encryptedValue, updatedAt: now },
        setWhere: and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)),
      });
  }

  return getAllSettings();
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  const workspaceId = await ensureDefaultWorkspace();
  await db
    .delete(settings)
    .where(and(eq(settings.workspaceId, workspaceId), eq(settings.key, key)));
}
