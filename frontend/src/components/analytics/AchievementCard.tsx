interface AchievementCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
}

export function AchievementCard({ label, value, subtitle }: AchievementCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 relative overflow-hidden">
      <div className="absolute left-0 inset-y-0 w-1 bg-green-500 rounded-l-lg" />
      <p className="text-sm text-gray-500 pl-1">{label}</p>
      <p className="text-2xl font-semibold text-green-700 mt-1 pl-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1 pl-1">{subtitle}</p>}
    </div>
  );
}
