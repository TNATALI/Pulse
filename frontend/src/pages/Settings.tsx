export function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Slack Configuration</h2>
          <p className="text-sm text-gray-500">
            Configure your Slack bot token and signing secret to enable Slack data sync.
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">GitHub Configuration</h2>
          <p className="text-sm text-gray-500">
            Configure your GitHub token and organization to enable GitHub data sync.
          </p>
        </div>
      </div>
    </div>
  );
}
