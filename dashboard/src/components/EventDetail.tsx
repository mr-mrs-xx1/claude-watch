import { format } from 'date-fns';
import { X, FileText, Terminal, Clock, Hash } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import type { CWEvent } from '../types';

interface Props {
  event: CWEvent;
  onClose: () => void;
}

export function EventDetail({ event, onClose }: Props) {
  const inputData = tryParse(event.input_data);
  const outputData = tryParse(event.output_data);

  return (
    <div className="w-[480px] border-l border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{event.tool_name || event.type}</span>
          <span className={`badge ${event.type === 'tool_result' ? 'badge-green' : 'badge-blue'}`}>
            {event.type === 'tool_result' ? 'completed' : event.type}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded transition-colors">
          <X size={16} className="text-slate-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} />
            <span>{format(new Date(event.timestamp), 'MMM d, yyyy h:mm:ss a')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Hash size={12} />
            <span>Event #{event.id}</span>
          </div>
          {event.file_path && (
            <div className="flex items-center gap-2 text-xs">
              <FileText size={12} className="text-slate-500" />
              <code className="text-blue-400 bg-slate-800 px-1.5 py-0.5 rounded break-all">
                {event.file_path}
              </code>
            </div>
          )}
          {event.session_id && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Terminal size={12} />
              <code className="truncate">{event.session_id}</code>
            </div>
          )}
        </div>

        {/* Input */}
        {inputData && (
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Input</h3>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-x-auto">
              {event.tool_name === 'Bash' && inputData.command ? (
                <div className="font-mono text-xs">
                  <div className="text-amber-400 mb-1">$ {inputData.command}</div>
                  {inputData.description && (
                    <div className="text-slate-600 text-xs"># {inputData.description}</div>
                  )}
                </div>
              ) : event.tool_name === 'Edit' ? (
                <div className="font-mono text-xs space-y-2">
                  {inputData.file_path && (
                    <div className="text-blue-400">{inputData.file_path}</div>
                  )}
                  {inputData.old_string && (
                    <div>
                      <div className="text-red-400/70 text-xs mb-1">- Old:</div>
                      <pre className="text-red-300/80 whitespace-pre-wrap break-all">{String(inputData.old_string)}</pre>
                    </div>
                  )}
                  {inputData.new_string && (
                    <div>
                      <div className="text-emerald-400/70 text-xs mb-1">+ New:</div>
                      <pre className="text-emerald-300/80 whitespace-pre-wrap break-all">{String(inputData.new_string)}</pre>
                    </div>
                  )}
                </div>
              ) : event.tool_name === 'Write' ? (
                <div className="font-mono text-xs space-y-2">
                  {inputData.file_path && (
                    <div className="text-blue-400 mb-2">{inputData.file_path}</div>
                  )}
                  <pre className="text-slate-300 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                    {String(inputData.content || '').slice(0, 3000)}
                    {String(inputData.content || '').length > 3000 && '\n... (truncated)'}
                  </pre>
                </div>
              ) : (
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap break-all">
                  {JSON.stringify(inputData, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Diff */}
        {event.diff && (
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Changes</h3>
            <DiffViewer diff={event.diff} />
          </div>
        )}

        {/* Output */}
        {outputData && (
          <div>
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Output</h3>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-x-auto">
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                {typeof outputData === 'string'
                  ? outputData.slice(0, 5000) + (outputData.length > 5000 ? '\n... (truncated)' : '')
                  : JSON.stringify(outputData, null, 2).slice(0, 5000)
                }
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tryParse(data: string | null): any {
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}
