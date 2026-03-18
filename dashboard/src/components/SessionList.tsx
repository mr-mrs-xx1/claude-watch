import { formatDistanceToNow, format } from 'date-fns';
import { Clock, Activity, CheckCircle2 } from 'lucide-react';
import type { Session } from '../types';

interface Props {
  sessions: Session[];
}

export function SessionList({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Clock size={48} className="mb-4 text-slate-700" />
        <p className="text-lg font-medium">No sessions</p>
        <p className="text-sm mt-1">Sessions are created when Claude Code starts working</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      {sessions.map(session => (
        <div key={session.id} className="card p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {session.status === 'active' ? (
                <div className="relative">
                  <Activity size={20} className="text-emerald-400" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                </div>
              ) : (
                <CheckCircle2 size={20} className="text-slate-500" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {session.project_name || 'Unknown Project'}
                  </span>
                  <span className={`badge ${session.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                    {session.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Started {format(new Date(session.started_at), 'MMM d, h:mm a')}
                  {session.ended_at && (
                    <> — ended {formatDistanceToNow(new Date(session.ended_at), { addSuffix: true })}</>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-slate-300">
                {session.event_count ?? 0} events
              </div>
              <div className="text-xs text-slate-600">
                {formatDistanceToNow(new Date(session.started_at), { addSuffix: true })}
              </div>
            </div>
          </div>

          {session.summary && (
            <div className="mt-3 px-3 py-2 bg-slate-800/50 rounded text-xs text-slate-400 font-mono">
              {session.summary}
            </div>
          )}

          {/* Session ID for debugging */}
          <div className="mt-2 text-xs text-slate-700 font-mono truncate">
            {session.id}
          </div>
        </div>
      ))}
    </div>
  );
}
