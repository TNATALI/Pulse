import { useState, useRef, useEffect, useMemo } from 'react';
import type { SlackAnalyticsParams, ChannelListItem } from '@pulse/shared';

interface FilterBarProps {
  filters: SlackAnalyticsParams;
  onFilterChange: (params: SlackAnalyticsParams) => void;
  channels: ChannelListItem[];
  contributors: { userId: string; displayName: string; avatarUrl: string | null }[];
}

const DATE_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function FilterBar({ filters, onFilterChange, channels, contributors }: FilterBarProps) {
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const channelRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (channelRef.current && !channelRef.current.contains(e.target as Node)) {
        setChannelDropdownOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredChannels = useMemo(() => {
    if (!channelSearch) return channels;
    const lower = channelSearch.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(lower));
  }, [channels, channelSearch]);

  const filteredContributors = useMemo(() => {
    if (!userSearch) return contributors;
    const lower = userSearch.toLowerCase();
    return contributors.filter((u) => u.displayName.toLowerCase().includes(lower));
  }, [contributors, userSearch]);

  const selectedChannelIds = new Set(filters.channelIds ?? []);

  function setDatePreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onFilterChange({ ...filters, startDate: formatDate(start), endDate: formatDate(end) });
  }

  function toggleChannel(id: string) {
    const current = new Set(filters.channelIds ?? []);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    const channelIds = current.size > 0 ? Array.from(current) : undefined;
    onFilterChange({ ...filters, channelIds });
  }

  function setUser(userId: string | undefined) {
    onFilterChange({ ...filters, userId });
    setUserDropdownOpen(false);
  }

  function resetFilters() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    onFilterChange({ startDate: formatDate(start), endDate: formatDate(end) });
  }

  const selectedUserName = contributors.find((u) => u.userId === filters.userId)?.displayName;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date presets */}
        <div className="flex items-center gap-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setDatePreset(preset.days)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={filters.startDate ?? ''}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={filters.endDate ?? ''}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md"
          />
        </div>

        {/* Channel multi-select */}
        <div className="relative" ref={channelRef}>
          <button
            onClick={() => setChannelDropdownOpen(!channelDropdownOpen)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 min-w-[140px] text-left"
          >
            {selectedChannelIds.size > 0
              ? `${selectedChannelIds.size} channel${selectedChannelIds.size > 1 ? 's' : ''}`
              : 'All channels'}
            <span className="float-right ml-2">&#9662;</span>
          </button>
          {channelDropdownOpen && (
            <div className="absolute z-20 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-64 max-h-64 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-48">
                {filteredChannels.map((ch) => (
                  <label
                    key={ch.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChannelIds.has(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 truncate">#{ch.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{ch.messageCount}</span>
                  </label>
                ))}
                {filteredChannels.length === 0 && (
                  <p className="text-sm text-gray-400 px-3 py-2">No channels found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User select */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700 min-w-[140px] text-left"
          >
            {selectedUserName ?? 'All users'}
            <span className="float-right ml-2">&#9662;</span>
          </button>
          {userDropdownOpen && (
            <div className="absolute z-20 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-64 max-h-64 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-48">
                <button
                  onClick={() => setUser(undefined)}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-sm text-gray-500"
                >
                  All users
                </button>
                {filteredContributors.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => setUser(u.userId)}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        {u.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-700 truncate">{u.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reset */}
        <button
          onClick={resetFilters}
          className="px-3 py-1.5 text-sm rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
