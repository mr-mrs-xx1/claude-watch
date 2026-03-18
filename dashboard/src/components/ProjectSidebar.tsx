import { useState } from 'react';
import { ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react';
import type { Project } from '../types';

interface Props {
  projects: Project[];
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  connected: boolean;
}

export function ProjectSidebar({ projects, selectedProject, onSelectProject, connected }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="w-12 border-r border-slate-800/40 flex flex-col items-center py-3 bg-[#0a0a12] shrink-0">
        <button onClick={() => setCollapsed(false)} className="p-2 text-slate-600 hover:text-slate-400 transition-colors mb-4">
          <PanelLeft size={16} />
        </button>
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className={`w-8 h-8 rounded-lg mb-1 flex items-center justify-center text-xs font-bold transition-all
              ${selectedProject === project.id
                ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30'
                : 'text-slate-600 hover:bg-slate-800 hover:text-slate-400'}`}
            title={project.name}
          >
            {project.name.charAt(0).toUpperCase()}
          </button>
        ))}
        <div className="mt-auto">
          <span className={`block w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-700'}`} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 border-r border-slate-800/40 flex flex-col bg-[#0a0a12] shrink-0">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
          Claude Watch
        </h1>
        <button onClick={() => setCollapsed(true)} className="p-1 text-slate-700 hover:text-slate-500 transition-colors">
          <PanelLeftClose size={14} />
        </button>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {projects.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <p className="text-[11px] text-slate-600">No projects yet</p>
            <p className="text-[11px] text-slate-700 mt-1">
              Run <code className="bg-slate-800/60 px-1 rounded text-slate-500">claude-watch init</code>
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-all group
                  ${selectedProject === project.id
                    ? 'bg-blue-500/10 text-blue-300'
                    : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {(project.active_sessions ?? 0) > 0 ? (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-700 shrink-0" />
                    )}
                    <span className="truncate font-medium">{project.name}</span>
                  </div>
                  <ChevronRight size={12} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="px-4 py-2.5 border-t border-slate-800/30">
        <div className={`flex items-center gap-1.5 text-[11px] ${connected ? 'text-emerald-500/70' : 'text-slate-700'}`}>
          <span className={`h-1 w-1 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>
    </div>
  );
}
