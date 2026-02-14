import { useNavigate } from 'react-router-dom';

interface InsightItem {
  label: string;
  value: string;
  trend?: number;
  linkTo?: string;
}

interface InsightCardProps {
  title: string;
  items: InsightItem[];
  emptyMessage?: string;
}

export function InsightCard({ title, items, emptyMessage = 'No data' }: InsightCardProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-800 truncate">{item.label}</span>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="font-medium text-gray-600">{item.value}</span>
                {item.trend !== undefined && item.trend !== 0 && (
                  <span
                    className={`text-xs font-medium ${item.trend > 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {item.trend > 0 ? '\u2191' : '\u2193'}
                    {Math.abs(item.trend)}%
                  </span>
                )}
                {item.linkTo && (
                  <button
                    onClick={() => navigate(item.linkTo!)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    View
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
