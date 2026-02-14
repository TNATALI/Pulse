import { useHealth } from '../api/hooks/useDashboard';

export function Dashboard() {
  const { data: health, isLoading } = useHealth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">API Status</h3>
          <p className="mt-2 text-lg font-semibold">
            {isLoading ? 'Checking...' : health?.status === 'ok' ? 'Connected' : 'Disconnected'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Messages</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Open PRs</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Channels</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Avg PR Merge Time</h3>
          <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
        </div>
      </div>
    </div>
  );
}
