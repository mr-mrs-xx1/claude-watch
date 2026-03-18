import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { GitCommit, FileText, ChevronDown, ChevronRight, Clock, RefreshCw, History } from 'lucide-react';
import { DiffViewer } from './DiffViewer';

interface LogicChange {
  relativePath: string;
  hash: string;
  date: string;
  author: string;
  message: string;
  diff: string;
}

interface Props {
  projectId: string | null;
}

export function LogicHistory({ projectId }: Props) {
  const [changes, setChanges] = useState<LogicChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  const fetchHistory = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/brain/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setChanges(data.recent_changes || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [projectId]);

  const toggleChange = (key: string) => {
    setExpandedChanges(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 px-8">
        <History size={48} className="mb-4 text-slate-700" />
        <p className="text-lg font-medium">Select a project</p>
        <p className="text-sm mt-1 text-center">View how your project's logic, prompts, and rules have evolved over time</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading history...
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 px-8">
        <GitCommit size={48} className="mb-4 text-slate-700" />
        <p className="text-lg font-medium">No change history</p>
        <p className="text-sm mt-1 text-center">
          Changes to logic files will appear here once the project has git history.
          <br />Commit changes to your prompts, rules, and config to start tracking.
        </p>
      </div>
    );
  }

  // Group changes by date
  const grouped: Record<string, LogicChange[]> = {};
  for (const change of changes) {
    const dateKey = change.date.split('T')[0];
    (grouped[dateKey] ??= []).push(change);
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <History size={20} className="text-amber-400" />
            Logic History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {changes.length} change{changes.length !== 1 ? 's' : ''} to logic files tracked via git
          </p>
        </div>
        <button onClick={fetchHistory} className="p-2 text-slate-500 hover:text-slate-300 transition-colors" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([dateKey, dayChanges]) => (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-400">
                {format(new Date(dateKey), 'MMMM d, yyyy')}
              </span>
              <span className="text-xs text-slate-600">
                ({formatDistanceToNow(new Date(dateKey), { addSuffix: true })})
              </span>
            </div>

            <div className="space-y-2 ml-1 border-l-2 border-slate-800 pl-4">
              {dayChanges.map((change, i) => {
                const key = `${change.hash}-${change.relativePath}-${i}`;
                const isExpanded = expandedChanges.has(key);

                return (
                  <div key={key} className="card overflow-hidden">
                    <button
                      onClick={() => toggleChange(key)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText size={14} className="text-blue-400 shrink-0" />
                            <span className="text-sm font-medium text-slate-200">{change.relativePath}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <GitCommit size={12} />
                            <code className="text-slate-500">{change.hash}</code>
                            <span>&middot;</span>
                            <span>{change.message}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-600">
                            {format(new Date(change.date), 'h:mm a')}
                          </span>
                          {isExpanded
                            ? <ChevronDown size={14} className="text-slate-500" />
                            : <ChevronRight size={14} className="text-slate-500" />}
                        </div>
                      </div>

                      {/* Compact diff preview when collapsed */}
                      {!isExpanded && change.diff && (
                        <div className="mt-2 ml-5 text-xs font-mono max-h-12 overflow-hidden opacity-60">
                          {change.diff.split('\n')
                            .filter(l => l.startsWith('+') || l.startsWith('-'))
                            .filter(l => !l.startsWith('+++') && !l.startsWith('---'))
                            .slice(0, 3)
                            .map((line, j) => (
                              <div key={j} className={line.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}>
                                {line.slice(0, 100)}
                              </div>
                            ))}
                        </div>
                      )}
                    </button>

                    {isExpanded && change.diff && (
                      <div className="px-4 pb-4 border-t border-slate-800">
                        <DiffViewer diff={change.diff} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
