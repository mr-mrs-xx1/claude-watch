import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  FileText, Terminal, Pen, Zap, MessageSquare, Filter,
  AlertTriangle, BookOpen
} from 'lucide-react';
import type { CWEvent } from '../types';

interface Props {
  events: CWEvent[];
  onSelectEvent: (event: CWEvent) => void;
  selectedEventId?: number;
}

type FilterMode = 'meaningful' | 'all';

// These are the tools that actually change things or produce important output
const MEANINGFUL_TOOLS = new Set(['Edit', 'Write', 'Bash', 'Agent', 'NotebookEdit']);
const NOISE_TOOLS = new Set(['Read', 'Glob', 'Grep', 'Skill', 'ToolSearch']);

// Events that touch instruction files are always important
function isInstructionFile(path: string | null): boolean {
  if (!path) return false;
  return path.includes('CLAUDE.md') ||
    path.includes('.claude/settings') ||
    path.includes('/memory/') ||
    path.endsWith('.claude.md');
}

function isImportant(event: CWEvent): boolean {
  if (event.type === 'notification' || event.type === 'session_end') return true;
  if (isInstructionFile(event.file_path)) return true;
  if (event.tool_name && MEANINGFUL_TOOLS.has(event.tool_name)) return true;
  return false;
}

const TOOL_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  Edit: { icon: <Pen size={15} />, label: 'Edited', color: 'text-blue-400 border-blue-500/30' },
  Write: { icon: <FileText size={15} />, label: 'Created', color: 'text-emerald-400 border-emerald-500/30' },
  Bash: { icon: <Terminal size={15} />, label: 'Ran', color: 'text-amber-400 border-amber-500/30' },
  Agent: { icon: <Zap size={15} />, label: 'Agent', color: 'text-yellow-400 border-yellow-500/30' },
  notification: { icon: <MessageSquare size={15} />, label: 'Notice', color: 'text-cyan-400 border-cyan-500/30' },
};

function getEventDisplay(event: CWEvent) {
  const config = TOOL_CONFIG[event.tool_name || ''] || TOOL_CONFIG[event.type] || {
    icon: <FileText size={15} />,
    label: event.tool_name || event.type,
    color: 'text-slate-400 border-slate-700/30',
  };

  let title = '';
  let detail = '';
  const isInstruction = isInstructionFile(event.file_path);

  if (event.file_path) {
    const parts = event.file_path.split('/');
    title = parts.slice(-2).join('/'); // last 2 segments
    detail = event.tool_name === 'Write' ? 'New file' : 'Modified';
  }

  if (event.tool_name === 'Bash') {
    try {
      const input = JSON.parse(event.input_data || '{}');
      title = input.command || 'command';
      detail = input.description || '';
      if (title.length > 100) title = title.slice(0, 100) + '...';
    } catch {
      title = 'command';
    }
  }

  if (event.tool_name === 'Agent') {
    try {
      const input = JSON.parse(event.input_data || '{}');
      title = input.description || 'Sub-agent';
      detail = input.subagent_type || '';
    } catch {
      title = 'Sub-agent';
    }
  }

  if (event.type === 'notification') {
    try {
      const data = JSON.parse(event.output_data || '{}');
      title = data.message || 'Notification';
    } catch {
      title = 'Notification';
    }
    if (title.length > 120) title = title.slice(0, 120) + '...';
    detail = '';
  }

  if (event.type === 'session_end') {
    title = 'Session ended';
    detail = '';
  }

  return { ...config, title, detail, isInstruction };
}

export function ActivityFeed({ events, onSelectEvent, selectedEventId }: Props) {
  const [filter, setFilter] = useState<FilterMode>('meaningful');

  const filtered = filter === 'meaningful'
    ? events.filter(isImportant)
    : events;

  const meaningfulCount = events.filter(isImportant).length;

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 px-8">
        <Terminal size={48} className="mb-4 text-slate-700" />
        <p className="text-lg font-medium">No activity yet</p>
        <p className="text-sm mt-1 text-center">File changes, commands, and important events will appear here as Claude Code works</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="px-6 py-2.5 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-slate-500 mr-1" />
          <button
            onClick={() => setFilter('meaningful')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'meaningful' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Changes & Commands ({meaningfulCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            All ({events.length})
          </button>
        </div>
      </div>

      {/* Events */}
      <div className="divide-y divide-slate-800/30">
        {filtered.map(event => {
          const display = getEventDisplay(event);
          const isSelected = event.id === selectedEventId;
          const iconColor = display.color.split(' ')[0];
          const borderColor = display.color.split(' ')[1] || 'border-slate-700/30';

          return (
            <button
              key={event.id}
              onClick={() => onSelectEvent(event)}
              className={`w-full text-left px-6 py-3 transition-colors border-l-2 ${borderColor}
                ${isSelected ? 'bg-slate-800/60' : 'hover:bg-slate-900/50'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                  {display.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {display.isInstruction && (
                      <span className="badge bg-indigo-500/20 text-indigo-400 flex items-center gap-1">
                        <BookOpen size={10} /> instruction
                      </span>
                    )}
                    {event.tool_name === 'Bash' ? (
                      <code className="text-sm text-amber-300 font-mono truncate">
                        $ {display.title}
                      </code>
                    ) : (
                      <span className="text-sm font-medium text-slate-200 truncate">
                        {display.title}
                      </span>
                    )}
                  </div>
                  {display.detail && (
                    <p className="text-xs text-slate-500 mt-0.5">{display.detail}</p>
                  )}
                  {event.diff && (
                    <div className="mt-1.5 text-xs font-mono leading-4 max-h-16 overflow-hidden">
                      {event.diff.split('\n').slice(0, 4).map((line, i) => (
                        <div key={i} className={
                          line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-500/70' :
                          line.startsWith('-') && !line.startsWith('---') ? 'text-red-500/70' :
                          'text-slate-600'
                        }>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-600 shrink-0 whitespace-nowrap">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
