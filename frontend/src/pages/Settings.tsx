import { useState, useEffect, useCallback } from 'react';
import { useSettings, useUpdateSettings, useDeleteSetting } from '../api/hooks/useSettings';
import { useVerifySlackToken, useTriggerSlackSync } from '../api/hooks/useSlackSync';
import { Toast } from '../components/common/Toast';
import type { SettingKey, SettingInput, SlackVerifyResponse } from '@pulse/shared';

interface FieldConfig {
  key: SettingKey;
  label: string;
  placeholder: string;
  type: 'password' | 'text';
}

const SLACK_FIELDS: FieldConfig[] = [
  { key: 'slack_bot_token', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
  { key: 'slack_signing_secret', label: 'Signing Secret', placeholder: 'Enter signing secret', type: 'password' },
];

const GITHUB_FIELDS: FieldConfig[] = [
  { key: 'github_token', label: 'Personal Access Token', placeholder: 'ghp_...', type: 'password' },
  { key: 'github_org', label: 'Organization', placeholder: 'my-org', type: 'text' },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function Settings() {
  const { data, isLoading, error } = useSettings();
  const updateMutation = useUpdateSettings();
  const deleteMutation = useDeleteSetting();
  const verifyMutation = useVerifySlackToken();
  const syncMutation = useTriggerSlackSync();

  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [verifyResult, setVerifyResult] = useState<SlackVerifyResponse | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const thirtyDaysAgo = formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const today = formatDate(new Date());
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    if (data?.settings) {
      const values: Record<string, string> = {};
      for (const s of data.settings) {
        values[s.key] = s.value ?? '';
      }
      setFormValues(values);
      setDirtyKeys(new Set());
    }
  }, [data]);

  // Auto-verify token when settings load and token is set
  useEffect(() => {
    if (data?.settings) {
      const tokenSetting = data.settings.find((s) => s.key === 'slack_bot_token');
      if (tokenSetting?.isSet && !verifyResult) {
        verifyMutation.mutate(undefined, {
          onSuccess: (result) => setVerifyResult(result),
        });
      }
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  }, []);

  const handleSave = useCallback(() => {
    const inputs: SettingInput[] = [];
    for (const key of dirtyKeys) {
      const value = formValues[key];
      if (value && value.length > 0) {
        inputs.push({ key: key as SettingKey, value });
      }
    }
    if (inputs.length > 0) {
      updateMutation.mutate(
        { settings: inputs },
        {
          onSuccess: () => {
            // If slack_bot_token was changed, re-verify
            if (dirtyKeys.has('slack_bot_token')) {
              setVerifyResult(null);
              verifyMutation.mutate(undefined, {
                onSuccess: (result) => setVerifyResult(result),
              });
            }
          },
        },
      );
    }
  }, [dirtyKeys, formValues, updateMutation, verifyMutation]);

  const handleDelete = useCallback(
    (key: SettingKey) => {
      deleteMutation.mutate(key, {
        onSuccess: () => {
          if (key === 'slack_bot_token') {
            setVerifyResult(null);
          }
        },
      });
    },
    [deleteMutation],
  );

  const handleSync = useCallback(() => {
    syncMutation.mutate(
      { startDate, endDate },
      {
        onSuccess: () => {
          setToast({
            message: 'Slack sync initiated — this may take a few minutes.',
            type: 'info',
          });
        },
        onError: (err) => {
          setToast({
            message: `Sync failed: ${err.message}`,
            type: 'error',
          });
        },
      },
    );
  }, [startDate, endDate, syncMutation]);

  const hasDirtyChanges = dirtyKeys.size > 0 && Array.from(dirtyKeys).some((k) => formValues[k]?.length > 0);
  const isTokenVerified = verifyResult?.ok === true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Failed to load settings: {error.message}</p>
      </div>
    );
  }

  const settingsMap = new Map(data?.settings.map((s) => [s.key, s]) ?? []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <button
          onClick={handleSave}
          disabled={!hasDirtyChanges || updateMutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {updateMutation.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">Failed to save: {updateMutation.error.message}</p>
        </div>
      )}

      {updateMutation.isSuccess && !hasDirtyChanges && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">Settings saved successfully.</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Slack Configuration</h2>
          <p className="text-sm text-gray-500 mb-4">
            Configure your Slack bot token and signing secret to enable Slack data sync.
          </p>

          {/* Token verification status */}
          {verifyMutation.isPending && (
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Verifying token...
            </div>
          )}

          {isTokenVerified && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
              <svg className="h-5 w-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-green-800">
                Connected to <strong>{verifyResult.teamName}</strong> ({verifyResult.teamId})
              </span>
            </div>
          )}

          {verifyResult && !verifyResult.ok && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-700">Token verification failed: {verifyResult.error}</span>
            </div>
          )}

          <div className="space-y-4">
            {SLACK_FIELDS.map((field) => {
              const setting = settingsMap.get(field.key);
              const isDirty = dirtyKeys.has(field.key);
              return (
                <div key={field.key}>
                  <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id={field.key}
                      type={field.type}
                      value={formValues[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={isDirty ? field.placeholder : setting?.isSet ? setting.value ?? '' : field.placeholder}
                      className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                        isDirty ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                      }`}
                    />
                    {setting?.isSet && (
                      <button
                        onClick={() => handleDelete(field.key)}
                        disabled={deleteMutation.isPending}
                        className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title={`Remove ${field.label}`}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {setting?.isSet && !isDirty && (
                    <p className="mt-1 text-xs text-gray-400">
                      Currently set{field.type === 'password' ? ` (${setting.value})` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Date range & sync button — only shown when token is verified */}
          {isTokenVerified && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Sync Data from Slack</h3>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label htmlFor="sync-start-date" className="block text-sm text-gray-600 mb-1">
                    Start Date
                  </label>
                  <input
                    id="sync-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="sync-end-date" className="block text-sm text-gray-600 mb-1">
                    End Date
                  </label>
                  <input
                    id="sync-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncMutation.isPending ? 'Starting sync...' : 'Sync Data with Slack'}
                </button>
              </div>
            </div>
          )}
        </div>

        <SettingsSection
          title="GitHub Configuration"
          description="Configure your GitHub token and organization to enable GitHub data sync."
          fields={GITHUB_FIELDS}
          settingsMap={settingsMap}
          formValues={formValues}
          dirtyKeys={dirtyKeys}
          onChange={handleChange}
          onDelete={handleDelete}
          isDeleting={deleteMutation.isPending}
        />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description: string;
  fields: FieldConfig[];
  settingsMap: Map<string, { key: string; value: string | null; isSet: boolean }>;
  formValues: Record<string, string>;
  dirtyKeys: Set<string>;
  onChange: (key: string, value: string) => void;
  onDelete: (key: SettingKey) => void;
  isDeleting: boolean;
}

function SettingsSection({
  title,
  description,
  fields,
  settingsMap,
  formValues,
  dirtyKeys,
  onChange,
  onDelete,
  isDeleting,
}: SettingsSectionProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <div className="space-y-4">
        {fields.map((field) => {
          const setting = settingsMap.get(field.key);
          const isDirty = dirtyKeys.has(field.key);
          return (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <div className="flex gap-2">
                <input
                  id={field.key}
                  type={field.type}
                  value={formValues[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={isDirty ? field.placeholder : setting?.isSet ? setting.value ?? '' : field.placeholder}
                  className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                    isDirty ? 'border-blue-300 bg-blue-50' : 'border-gray-300'
                  }`}
                />
                {setting?.isSet && (
                  <button
                    onClick={() => onDelete(field.key)}
                    disabled={isDeleting}
                    className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title={`Remove ${field.label}`}
                  >
                    Clear
                  </button>
                )}
              </div>
              {setting?.isSet && !isDirty && (
                <p className="mt-1 text-xs text-gray-400">Currently set{field.type === 'password' ? ` (${setting.value})` : ''}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
