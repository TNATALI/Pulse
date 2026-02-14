interface MentionPair {
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  count: number;
}

interface MentionTableProps {
  data: MentionPair[];
  onUserSelect: (userId: string) => void;
}

export function MentionTable({ data, onUserSelect }: MentionTableProps) {
  if (data.length === 0) {
    return <p className="text-gray-400 text-sm">No mention data available</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 pr-4 font-medium text-gray-500">From</th>
            <th className="text-left py-2 pr-4 font-medium text-gray-500">To</th>
            <th className="text-right py-2 font-medium text-gray-500">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((pair, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4">
                <button
                  onClick={() => onUserSelect(pair.fromUserId)}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {pair.fromDisplayName}
                </button>
              </td>
              <td className="py-2 pr-4">
                <button
                  onClick={() => onUserSelect(pair.toUserId)}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {pair.toDisplayName}
                </button>
              </td>
              <td className="py-2 text-right font-medium text-gray-700">
                {pair.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
