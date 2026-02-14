interface StatCardProps {
  label: string;
  value: number | string;
  trend?: number;
  subtitle?: string;
}

export function StatCard({ label, value, trend, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <p className="text-2xl font-semibold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {trend !== undefined && trend !== 0 && (
          <span
            className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {trend > 0 ? '\u2191' : '\u2193'}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
