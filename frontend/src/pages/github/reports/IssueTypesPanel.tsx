interface Props {
  typeBreakdown: { type: string; count: number }[];
}

const TYPE_PALETTE: Record<string, { bg: string; text: string; bar: string }> = {
  bug:             { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',     bar: '#ef4444' },
  feature:         { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',    bar: '#3b82f6' },
  'feature request': { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700',    bar: '#3b82f6' },
  task:            { bg: 'bg-gray-50 border-gray-200',   text: 'text-gray-700',    bar: '#9ca3af' },
  enhancement:     { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', bar: '#a855f7' },
  epic:            { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', bar: '#6366f1' },
  story:           { bg: 'bg-teal-50 border-teal-200',   text: 'text-teal-700',    bar: '#14b8a6' },
  question:        { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', bar: '#f97316' },
};

function paletteFor(typeName: string) {
  return (
    TYPE_PALETTE[typeName.toLowerCase()] ?? {
      bg: 'bg-gray-50 border-gray-200',
      text: 'text-gray-700',
      bar: '#6b7280',
    }
  );
}

export function IssueTypesPanel({ typeBreakdown }: Props) {
  if (typeBreakdown.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-medium text-gray-900 mb-1">Issue Types</h3>
        <p className="text-sm text-gray-400 mb-2">
          No issue types found in this period.
        </p>
        <p className="text-xs text-gray-400">
          Issue Types are org-level classifications (Bug, Feature, Task) set natively in GitHub.
          Assign a type to issues in GitHub to see the breakdown here.
        </p>
      </div>
    );
  }

  const max = typeBreakdown[0].count;
  const total = typeBreakdown.reduce((s, t) => s + t.count, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900">Issue Types</h3>
        <span className="text-xs text-gray-400">{total} typed issues in period</span>
      </div>
      <div className="space-y-3">
        {typeBreakdown.map(({ type, count }) => {
          const { bg, text, bar } = paletteFor(type);
          const barPct = max > 0 ? (count / max) * 100 : 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${bg} ${text} shrink-0`}
                >
                  {type}
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs text-gray-400">{pct}%</span>
                  <span className="text-sm font-semibold text-gray-800 w-5 text-right">{count}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: bar }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
