import { useState, useEffect } from 'react';
import { BookOpen, Settings, Brain, FileText, ChevronDown, ChevronRight, Globe, FolderOpen, RefreshCw } from 'lucide-react';

interface FileResult {
  path: string;
  content: string;
}

interface MemoryFile {
  path: string;
  name: string;
  content: string;
  frontmatter: {
    name?: string;
    description?: string;
    type?: string;
  } | null;
}

interface InstructionsData {
  project_instructions: {
    root_claude_md: FileResult | null;
    nested_claude_md: FileResult[];
    settings: { path: string; content: object } | null;
    local_settings: { path: string; content: object } | null;
  };
  global_instructions: {
    claude_md: FileResult | null;
    settings: { path: string; content: object } | null;
  };
  memory: {
    index: FileResult | null;
    files: MemoryFile[];
  };
}

interface Props {
  projectId: string | null;
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-400',
  feedback: 'bg-amber-500/20 text-amber-400',
  project: 'bg-purple-500/20 text-purple-400',
  reference: 'bg-cyan-500/20 text-cyan-400',
};

export function InstructionsPanel({ projectId }: Props) {
  const [data, setData] = useState<InstructionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['project-claude-md', 'memory', 'settings'])
  );

  const fetchInstructions = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/instructions/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      setData(await res.json());
    } catch {
      setError('Could not load instructions');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInstructions();
  }, [projectId]);

  const toggle = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 px-8">
        <BookOpen size={48} className="mb-4 text-slate-700" />
        <p className="text-lg font-medium">Select a project</p>
        <p className="text-sm mt-1 text-center">Choose a project from the sidebar to view its instructions, memory, and configuration</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p>{error}</p>
        <button onClick={fetchInstructions} className="mt-2 text-blue-400 text-sm hover:underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const hasProjectInstructions = data.project_instructions.root_claude_md || data.project_instructions.nested_claude_md.length > 0;
  const hasMemory = data.memory.files.length > 0;
  const hasSettings = data.project_instructions.settings || data.project_instructions.local_settings;
  const hasGlobal = data.global_instructions.claude_md || data.global_instructions.settings;
  const isEmpty = !hasProjectInstructions && !hasMemory && !hasSettings && !hasGlobal;

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Brain size={20} className="text-indigo-400" />
            Project Logic
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Instructions, memory, and settings that control how Claude Code behaves in this project
          </p>
        </div>
        <button onClick={fetchInstructions} className="p-2 text-slate-500 hover:text-slate-300 transition-colors" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {isEmpty && (
        <div className="card p-8 text-center">
          <BookOpen size={32} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400">No instructions found for this project</p>
          <p className="text-xs text-slate-600 mt-2">
            Create a <code className="bg-slate-800 px-1.5 py-0.5 rounded">CLAUDE.md</code> file in your project root to give Claude Code project-specific instructions
          </p>
        </div>
      )}

      {/* CLAUDE.md - Project Instructions */}
      {hasProjectInstructions && (
        <Section
          id="project-claude-md"
          icon={<BookOpen size={16} className="text-emerald-400" />}
          title="Project Instructions"
          subtitle="CLAUDE.md"
          expanded={expandedSections.has('project-claude-md')}
          onToggle={() => toggle('project-claude-md')}
        >
          {data.project_instructions.root_claude_md && (
            <div className="space-y-2">
              <div className="text-xs text-slate-600 font-mono">{data.project_instructions.root_claude_md.path}</div>
              <MarkdownContent content={data.project_instructions.root_claude_md.content} />
            </div>
          )}
          {data.project_instructions.nested_claude_md.map((file, i) => (
            <div key={i} className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-500 font-mono mb-2 flex items-center gap-1">
                <FolderOpen size={12} />
                {file.path}
              </div>
              <MarkdownContent content={file.content} />
            </div>
          ))}
        </Section>
      )}

      {/* Memory */}
      {hasMemory && (
        <Section
          id="memory"
          icon={<Brain size={16} className="text-purple-400" />}
          title="Memory"
          subtitle={`${data.memory.files.length} file${data.memory.files.length !== 1 ? 's' : ''}`}
          expanded={expandedSections.has('memory')}
          onToggle={() => toggle('memory')}
        >
          {data.memory.index && (
            <div className="mb-4">
              <div className="text-xs font-medium text-slate-400 mb-2">MEMORY.md (Index)</div>
              <MarkdownContent content={data.memory.index.content} />
            </div>
          )}
          <div className="space-y-3">
            {data.memory.files
              .filter(f => f.name !== 'MEMORY.md')
              .map((file, i) => (
                <MemoryCard key={i} file={file} />
              ))}
          </div>
        </Section>
      )}

      {/* Project Settings */}
      {hasSettings && (
        <Section
          id="settings"
          icon={<Settings size={16} className="text-amber-400" />}
          title="Project Settings"
          subtitle=".claude/settings.json"
          expanded={expandedSections.has('settings')}
          onToggle={() => toggle('settings')}
        >
          {data.project_instructions.settings && (
            <div>
              <div className="text-xs text-slate-600 font-mono mb-2">{data.project_instructions.settings.path}</div>
              <pre className="text-xs font-mono text-slate-300 bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(data.project_instructions.settings.content, null, 2)}
              </pre>
            </div>
          )}
          {data.project_instructions.local_settings && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-600 font-mono mb-2">{data.project_instructions.local_settings.path}</div>
              <pre className="text-xs font-mono text-slate-300 bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(data.project_instructions.local_settings.content, null, 2)}
              </pre>
            </div>
          )}
        </Section>
      )}

      {/* Global Instructions */}
      {hasGlobal && (
        <Section
          id="global"
          icon={<Globe size={16} className="text-cyan-400" />}
          title="Global Instructions"
          subtitle="~/.claude/"
          expanded={expandedSections.has('global')}
          onToggle={() => toggle('global')}
        >
          {data.global_instructions.claude_md && (
            <div>
              <div className="text-xs text-slate-500 font-mono mb-2 flex items-center gap-1">
                <FileText size={12} /> {data.global_instructions.claude_md.path}
              </div>
              <MarkdownContent content={data.global_instructions.claude_md.content} />
            </div>
          )}
          {data.global_instructions.settings && (
            <div className={data.global_instructions.claude_md ? 'mt-4 pt-4 border-t border-slate-800' : ''}>
              <div className="text-xs text-slate-500 font-mono mb-2 flex items-center gap-1">
                <Settings size={12} /> {data.global_instructions.settings.path}
              </div>
              <pre className="text-xs font-mono text-slate-300 bg-slate-800/50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(data.global_instructions.settings.content, null, 2)}
              </pre>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ id, icon, title, subtitle, expanded, onToggle, children }: {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full card-header hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
          <span className="text-xs text-slate-600">{subtitle}</span>
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      </button>
      {expanded && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Render markdown-like content with basic formatting
  const lines = content.split('\n');

  return (
    <div className="text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return <h3 key={i} className="text-base font-bold text-slate-100 mt-3 mb-1">{line.slice(2)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h4 key={i} className="text-sm font-semibold text-slate-200 mt-3 mb-1">{line.slice(3)}</h4>;
        }
        if (line.startsWith('### ')) {
          return <h5 key={i} className="text-sm font-medium text-slate-300 mt-2 mb-0.5">{line.slice(4)}</h5>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 text-slate-300 pl-2">
              <span className="text-slate-600 shrink-0">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        if (line.startsWith('```')) {
          return null; // code blocks handled below
        }
        if (line.trim() === '') {
          return <div key={i} className="h-2" />;
        }
        return <p key={i} className="text-slate-300">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Basic inline formatting: `code`, **bold**
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code spans
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(<code key={key++} className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-blue-300 font-mono">{codeMatch[2]}</code>);
      remaining = codeMatch[3];
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++} className="text-slate-100 font-semibold">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }

    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return <>{parts}</>;
}

function MemoryCard({ file }: { file: MemoryFile }) {
  const [expanded, setExpanded] = useState(false);
  const fm = file.frontmatter as Record<string, string> | null;
  const memType = fm?.type || 'unknown';
  const colorClass = MEMORY_TYPE_COLORS[memType] || 'bg-slate-500/20 text-slate-400';

  return (
    <div className="bg-slate-800/30 border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`badge ${colorClass}`}>{memType}</span>
          <span className="text-sm font-medium text-slate-200 truncate">
            {fm?.name || file.name.replace('.md', '')}
          </span>
        </div>
        {expanded ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
      </button>
      {fm?.description && (
        <div className="px-3 pb-2 -mt-1 text-xs text-slate-500">{fm.description}</div>
      )}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-800 pt-2">
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{file.content}</div>
        </div>
      )}
    </div>
  );
}
