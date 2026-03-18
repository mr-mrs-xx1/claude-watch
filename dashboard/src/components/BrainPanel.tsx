import { useState, useEffect, useRef } from 'react';
import { RefreshCw, FileText, ChevronDown, Clock, GitCommit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LogicFile {
  relativePath: string;
  name: string;
  category: string;
  content: string;
  size: number;
  lastModified: string;
}

interface LogicChange {
  relativePath: string;
  hash: string;
  date: string;
  message: string;
  diff: string;
}

interface MemoryFile {
  name: string;
  content: string;
  frontmatter: { name?: string; type?: string } | null;
}

interface BrainData {
  files: LogicFile[];
  recent_changes: LogicChange[];
  claude_code: {
    memory_index: string | null;
    memory_files: MemoryFile[];
    global_claude_md: string | null;
    global_settings: object | null;
  };
}

interface Props {
  projectId: string | null;
}

export function BrainPanel({ projectId }: Props) {
  const [data, setData] = useState<BrainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    fetch(`/api/brain/${projectId}`)
      .then(r => r.json())
      .then(d => { setData(d); setActiveSection(null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return <Empty text="Select a project from the sidebar" />;
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500"><RefreshCw size={18} className="animate-spin mr-2" /> Scanning...</div>;
  }
  if (!data || data.files.length === 0) {
    return <Empty text="No logic files found in this project" />;
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  // Prioritize: prompts first, then rules, then the rest
  const priorityOrder = ['prompt', 'rules', 'config', 'docs', 'state'];
  const sorted = [...data.files].sort((a, b) =>
    priorityOrder.indexOf(a.category) - priorityOrder.indexOf(b.category)
  );

  const memoryFiles = data.claude_code.memory_files.filter(f => f.name !== 'MEMORY.md');
  const hasMemory = memoryFiles.length > 0;
  const hasChanges = data.recent_changes.length > 0;

  return (
    <div className="flex h-full">
      {/* Table of contents — left rail */}
      <nav className="w-56 shrink-0 border-r border-slate-800 p-3 overflow-y-auto hidden lg:block">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Contents</div>
        {sorted.map(f => (
          <button
            key={f.relativePath}
            onClick={() => scrollTo(slugify(f.relativePath))}
            className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors
              ${activeSection === slugify(f.relativePath) ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {f.relativePath}
          </button>
        ))}
        {hasMemory && (
          <>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2 px-2">Memory</div>
            {memoryFiles.map(f => (
              <button
                key={f.name}
                onClick={() => scrollTo(`mem-${f.name}`)}
                className="w-full text-left px-2 py-1.5 rounded text-xs truncate text-slate-500 hover:text-slate-300 transition-colors"
              >
                {f.frontmatter?.name || f.name.replace('.md', '')}
              </button>
            ))}
          </>
        )}
        {hasChanges && (
          <button
            onClick={() => scrollTo('recent-changes')}
            className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-500 hover:text-slate-300 mt-4 transition-colors"
          >
            Recent Changes ({data.recent_changes.length})
          </button>
        )}
      </nav>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-10">

          {/* Each file rendered as a readable section */}
          {sorted.map(file => (
            <section key={file.relativePath} id={slugify(file.relativePath)}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                <FileText size={14} className="text-slate-500" />
                <span className="text-sm font-mono text-slate-400">{file.relativePath}</span>
                <span className="text-xs text-slate-600 ml-auto">
                  {formatDistanceToNow(new Date(file.lastModified), { addSuffix: true })}
                </span>
              </div>
              <RenderedContent content={file.content} filename={file.name} />
            </section>
          ))}

          {/* Memory files */}
          {hasMemory && (
            <section>
              <h2 className="text-base font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-800">
                Claude Code Memory
              </h2>
              {data.claude_code.memory_index && (
                <div className="mb-6 text-sm text-slate-400 whitespace-pre-wrap leading-relaxed">{data.claude_code.memory_index}</div>
              )}
              <div className="space-y-6">
                {memoryFiles.map(file => (
                  <div key={file.name} id={`mem-${file.name}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {file.frontmatter?.type && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{file.frontmatter.type}</span>
                      )}
                      <span className="text-sm font-medium text-slate-300">{file.frontmatter?.name || file.name}</span>
                    </div>
                    <div className="text-sm text-slate-400 whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-slate-800">
                      {file.content}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent changes */}
          {hasChanges && (
            <section id="recent-changes">
              <h2 className="text-base font-semibold text-slate-200 mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                Recent Changes to Logic Files
              </h2>
              <ChangeList changes={data.recent_changes} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Subcomponents --- */

function RenderedContent({ content, filename }: { content: string; filename: string }) {
  // For JSON files, pretty print
  if (filename.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content);
      return (
        <pre className="text-sm font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch { /* fall through */ }
  }

  // For Python config files, show as code
  if (filename.endsWith('.py')) {
    return (
      <pre className="text-sm font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">{content}</pre>
    );
  }

  // For markdown / text, render with basic formatting
  return <Markdown text={content} />;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={elements.length} className="my-2 px-3 py-2 bg-slate-900 rounded text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(<h2 key={elements.length} className="text-lg font-bold text-slate-100 mt-6 mb-2">{line.slice(2)}</h2>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={elements.length} className="text-base font-semibold text-slate-200 mt-5 mb-1.5">{line.slice(3)}</h3>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h4 key={elements.length} className="text-sm font-semibold text-slate-300 mt-4 mb-1">{line.slice(4)}</h4>);
      i++; continue;
    }

    // List items
    if (/^[-*]\s/.test(line)) {
      elements.push(
        <div key={elements.length} className="flex gap-2 text-sm text-slate-400 leading-relaxed pl-1">
          <span className="text-slate-600 shrink-0 select-none">•</span>
          <span>{inlineFmt(line.replace(/^[-*]\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered list
    if (/^\d+[.)]\s/.test(line)) {
      const num = line.match(/^(\d+)[.)]/)?.[1];
      elements.push(
        <div key={elements.length} className="flex gap-2 text-sm text-slate-400 leading-relaxed pl-1">
          <span className="text-slate-600 shrink-0 select-none w-4 text-right">{num}.</span>
          <span>{inlineFmt(line.replace(/^\d+[.)]\s+/, ''))}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={elements.length} className="h-3" />);
      i++; continue;
    }

    // Regular paragraph
    elements.push(
      <p key={elements.length} className="text-sm text-slate-400 leading-relaxed">{inlineFmt(line)}</p>
    );
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function inlineFmt(text: string): React.ReactNode {
  // Split on code spans and bold, render inline
  const parts: React.ReactNode[] = [];
  let rest = text;
  let k = 0;

  while (rest) {
    // Code span
    const codeMatch = rest.match(/^(.*?)`([^`]+)`(.*)$/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={k++}>{codeMatch[1]}</span>);
      parts.push(<code key={k++} className="px-1 py-0.5 bg-slate-800 rounded text-xs text-blue-300 font-mono">{codeMatch[2]}</code>);
      rest = codeMatch[3];
      continue;
    }
    // Bold
    const boldMatch = rest.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={k++}>{boldMatch[1]}</span>);
      parts.push(<strong key={k++} className="text-slate-200 font-semibold">{boldMatch[2]}</strong>);
      rest = boldMatch[3];
      continue;
    }
    parts.push(<span key={k++}>{rest}</span>);
    break;
  }
  return <>{parts}</>;
}

function ChangeList({ changes }: { changes: LogicChange[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Deduplicate by hash+file
  const unique: LogicChange[] = [];
  const seen = new Set<string>();
  for (const c of changes) {
    const key = `${c.hash}:${c.relativePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return (
    <div className="space-y-2">
      {unique.slice(0, 20).map((change, idx) => {
        const isOpen = expanded.has(idx);
        return (
          <div key={idx} className="border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(prev => {
                const next = new Set(prev);
                next.has(idx) ? next.delete(idx) : next.add(idx);
                return next;
              })}
              className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-900/50 transition-colors"
            >
              <GitCommit size={14} className="text-slate-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-300">{change.relativePath}</span>
                <span className="text-xs text-slate-600 ml-2">{change.message}</span>
              </div>
              <span className="text-xs text-slate-600 shrink-0">{formatDistanceToNow(new Date(change.date), { addSuffix: true })}</span>
              <ChevronDown size={14} className={`text-slate-600 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </button>
            {isOpen && change.diff && (
              <div className="border-t border-slate-800 px-4 py-3 bg-slate-950">
                <pre className="text-xs font-mono leading-5 overflow-x-auto">
                  {change.diff.split('\n').map((line, j) => (
                    <div key={j} className={
                      line.startsWith('+') && !line.startsWith('+++') ? 'text-emerald-400/80' :
                      line.startsWith('-') && !line.startsWith('---') ? 'text-red-400/80' :
                      line.startsWith('@@') ? 'text-blue-400/60' :
                      'text-slate-600'
                    }>{line}</div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-full text-slate-600 text-sm">{text}</div>
  );
}

function slugify(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, '-');
}
