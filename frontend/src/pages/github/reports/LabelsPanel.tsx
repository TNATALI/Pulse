interface Props {
  labelBreakdown: { label: string; count: number }[];
}

export function LabelsPanel({ labelBreakdown }: Props) {
  if (labelBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-1">Labels</h3>
        <p className="text-sm text-gray-400">No labels detected on issues in this period.</p>
      </div>
    );
  }

  const max = labelBreakdown[0].count;
  const total = labelBreakdown.reduce((s, l) => s + l.count, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900">Labels</h3>
        <span className="text-xs text-gray-400">{total} label uses in period</span>
      </div>
      <div className="space-y-2.5">
        {labelBreakdown.map(({ label, count }) => {
          const barPct = max > 0 ? (count / max) * 100 : 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-gray-700 truncate max-w-[65%]">
                  {label}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-gray-400">{pct}%</span>
                  <span className="text-sm font-semibold text-gray-800 w-5 text-right">{count}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all duration-500"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
