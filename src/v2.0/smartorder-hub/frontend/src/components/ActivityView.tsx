import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { ActivityEvent } from '../types/order';
import { fetchActivity } from '../services/ordersApi';

const actionStyle: Record<string, string> = {
  message_received: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  message_extracted: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  order_created: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  order_analyzed: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  order_approved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  order_rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  info_requested:
    'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  purchase_draft_created:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
};

export const ActivityView: React.FC = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      setEvents(await fetchActivity());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load activity');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Activity log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Every import, extraction, analysis, approval and purchase draft is
            recorded with an actor and timestamp.
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading activity…
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <Clock className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No activity yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Import a message or reset the demo to seed the inbox.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[760px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(event.ts).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {event.actor}
                    </p>
                    <p className="text-[10px] text-slate-400">{event.role}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${actionStyle[event.action] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                      {event.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {event.entityType}:{event.entityId}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                    {event.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
