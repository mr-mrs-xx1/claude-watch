import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { RefreshCw, X, ArrowLeft, Search, AlertTriangle, Shield, FileText, ChevronRight, ChevronDown, Command } from 'lucide-react';

interface TreeNode {
  id: string; label: string; type: 'root' | 'file' | 'section' | 'rule' | 'item';
  children: TreeNode[]; importance?: 'critical' | 'high' | 'normal'; icon?: string; source?: string;
}
interface SearchResult {
  file: string; section: string | null; lines: string[];
  importance: 'critical' | 'high' | 'normal'; explanation?: string;
}
interface Props { projectId: string | null; }

const P = [
  { bg: '#1a1852', border: '#818cf8', text: '#ddd6fe', glow: '#6366f150' },
  { bg: '#102a4a', border: '#60a5fa', text: '#dbeafe', glow: '#3b82f650' },
  { bg: '#053328', border: '#34d399', text: '#d1fae5', glow: '#10b98150' },
  { bg: '#5c2d0e', border: '#fbbf24', text: '#fef3c7', glow: '#f59e0b50' },
  { bg: '#3b1370', border: '#c084fc', text: '#f3e8ff', glow: '#a855f750' },
  { bg: '#0e3e52', border: '#22d3ee', text: '#cffafe', glow: '#06b6d450' },
  { bg: '#5c1818', border: '#f87171', text: '#fee2e2', glow: '#ef444450' },
  { bg: '#2a4210', border: '#a3e635', text: '#ecfccb', glow: '#84cc1650' },
  { bg: '#351072', border: '#a78bfa', text: '#ede9fe', glow: '#8b5cf650' },
  { bg: '#55310f', border: '#facc15', text: '#fef9c3', glow: '#eab30850' },
  { bg: '#132e24', border: '#4ade80', text: '#dcfce7', glow: '#22c55e50' },
  { bg: '#2a0553', border: '#d946ef', text: '#fae8ff', glow: '#d946ef50' },
  { bg: '#083a58', border: '#38bdf8', text: '#e0f2fe', glow: '#0ea5e950' },
  { bg: '#3a1005', border: '#fb923c', text: '#ffedd5', glow: '#f9731650' },
  { bg: '#162507', border: '#84cc16', text: '#ecfccb', glow: '#84cc1650' },
  { bg: '#220b4e', border: '#a855f7', text: '#f3e8ff', glow: '#a855f750' },
  { bg: '#06273e', border: '#0ea5e9', text: '#e0f2fe', glow: '#0ea5e950' },
  { bg: '#361503', border: '#f59e0b', text: '#fef3c7', glow: '#f59e0b50' },
  { bg: '#03240f', border: '#22c55e', text: '#dcfce7', glow: '#22c55e50' },
];

function countLeaves(n: TreeNode): number { return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0); }
function findNode(r: TreeNode, id: string): TreeNode | null { if (r.id === id) return r; for (const c of r.children) { const f = findNode(c, id); if (f) return f; } return null; }
function countByImp(n: TreeNode, imp: string): number { let c = 0; (function w(x: TreeNode) { if (x.importance === imp) c++; x.children.forEach(w); })(n); return c; }
function wrapText(t: string, max: number): string[] {
  if (max < 3) return []; if (t.length <= max) return [t];
  const w = t.split(/\s+/); const l: string[] = []; let c = '';
  for (const x of w) { if (c && c.length + 1 + x.length > max) { l.push(c); c = x; if (l.length >= 2) { c += '...'; break; } } else c = c ? c + ' ' + x : x; }
  if (c) l.push(c); return l.slice(0, 3);
}
function lineImp(l: string): 'critical' | 'high' | 'normal' {
  const u = l.toUpperCase();
  if (/\bNEVER\b|\bFORBIDDEN\b|\bCRITICAL\b|\bPRIORITY\s*#?[01]\b/.test(u)) return 'critical';
  if (/\bALWAYS\b|\bMUST\b|\bREQUIRED\b|\bSAFETY\b/.test(u)) return 'high'; return 'normal';
}

export function BrainGraph({ projectId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [dims, setDims] = useState({ w: 900, h: 700 });
  const [zoomedFile, setZoomedFile] = useState<TreeNode | null>(null);
  const [zoomedIdx, setZoomedIdx] = useState(0);
  const [detail, setDetail] = useState<TreeNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; sub: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchMode, setSearchMode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { const el = containerRef.current; if (!el) return; const o = new ResizeObserver(e => { const { width: w, height: h } = e[0].contentRect; if (w > 0 && h > 0) setDims({ w, h }); }); o.observe(el); return () => o.disconnect(); }, []);
  useEffect(() => { if (!projectId) return; setLoading(true); setZoomedFile(null); setDetail(null); setSearchQuery(''); setSearchResults(null); fetch(`/api/brain/${projectId}/tree`).then(r => r.json()).then(d => setTree(d.tree)).catch(() => {}).finally(() => setLoading(false)); }, [projectId]);

  // Cmd+K to focus search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') {
        if (searchResults) { setSearchQuery(''); setSearchResults(null); searchRef.current?.blur(); }
        else if (detail) setDetail(null);
        else if (zoomedFile) { setZoomedFile(null); setDetail(null); }
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [detail, zoomedFile, searchResults]);

  // AI search with debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2 || !projectId) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/search/${projectId}?q=${encodeURIComponent(searchQuery.trim())}`);
        const d = await r.json();
        setSearchResults(d.results);
        setSearchTotal(d.total);
        setSearchMode(d.mode || 'ai');
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 500);
  }, [searchQuery, projectId]);

  const filePack = useMemo(() => {
    if (!tree) return null;
    const files = tree.children.filter(c => !/^[=\-_\s]{5,}$/.test(c.label.trim()));
    const flat: TreeNode = { ...tree, children: files.map(f => ({ ...f, children: [] })) };
    const s = Math.min(dims.w, dims.h) - 40;
    const root = d3.hierarchy(flat).sum(d => { if (d.type === 'root') return 0; const o = findNode(tree, d.id); return o ? Math.max(Math.sqrt(countLeaves(o)), 2) : 2; }).sort((a, b) => (b.value || 0) - (a.value || 0));
    d3.pack<TreeNode>().size([s, s]).padding(12)(root);
    return { root: root as d3.HierarchyCircularNode<TreeNode>, size: s };
  }, [tree, dims]);

  const sectionPack = useMemo(() => {
    if (!zoomedFile || !tree) return null;
    const orig = findNode(tree, zoomedFile.id); if (!orig) return null;
    const secs = orig.children.filter(c => !/^[=\-_\s]{5,}$/.test(c.label.trim()));
    const fake: TreeNode = { ...orig, children: secs.map(s => ({ ...s, children: [] })) };
    const aw = dims.w - (detail ? 380 : 0); const s = Math.min(aw, dims.h) - 40;
    const root = d3.hierarchy(fake).sum(d => { if (d.id === orig.id) return 0; const o = findNode(tree, d.id); return o ? Math.max(Math.sqrt(countLeaves(o)), 1.5) : 1.5; }).sort((a, b) => (b.value || 0) - (a.value || 0));
    d3.pack<TreeNode>().size([s, s]).padding(10)(root);
    return { root: root as d3.HierarchyCircularNode<TreeNode>, size: s, orig };
  }, [zoomedFile, tree, dims, detail]);

  const onHover = useCallback((e: React.MouseEvent, label: string, sub: string, id: string) => {
    setHoveredId(id); const r = (e.currentTarget as Element).closest('svg')!.getBoundingClientRect();
    setTooltip({ x: e.clientX - r.left, y: e.clientY - r.top - 12, label, sub });
  }, []);
  const offHover = useCallback(() => { setHoveredId(null); setTooltip(null); }, []);

  if (!projectId) return <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a project from the sidebar</div>;
  if (loading) return <div className="flex items-center justify-center h-full text-slate-500 animate-fade-in"><RefreshCw size={18} className="animate-spin mr-2 text-blue-400" /> Scanning project...</div>;
  if (!filePack) return null;

  const isZoomed = !!zoomedFile && !!sectionPack;
  const showSearch = searchResults !== null;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="px-3 py-1.5 flex items-center gap-2 shrink-0 border-b border-slate-800/30">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] flex-1 min-w-0">
          {isZoomed && !showSearch && (
            <button onClick={() => { setZoomedFile(null); setDetail(null); }} className="p-1 rounded-md hover:bg-slate-800/60 text-slate-500 hover:text-slate-300 transition-all">
              <ArrowLeft size={14} />
            </button>
          )}
          <button onClick={() => { setZoomedFile(null); setDetail(null); setSearchQuery(''); setSearchResults(null); }}
            className={`transition-colors truncate ${!isZoomed || showSearch ? 'text-slate-200 font-medium' : 'text-slate-500 hover:text-slate-300'}`}>
            {tree!.label}
          </button>
          {isZoomed && !showSearch && (
            <><span className="text-slate-700">/</span><span className="text-slate-200 font-medium truncate">{zoomedFile!.icon} {zoomedFile!.label}</span></>
          )}
          {detail && !showSearch && (
            <><span className="text-slate-700">/</span><span className="text-slate-500 truncate">{detail.label}</span></>
          )}
        </div>

        {/* Search */}
        <div className={`relative transition-all ${searchFocused ? 'w-72' : 'w-52'}`}>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input ref={searchRef} type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Ask anything..."
            className="w-full bg-slate-800/40 border border-slate-700/30 rounded-lg pl-8 pr-16 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:bg-slate-800/70 focus:border-blue-500/40 transition-all" />
          {searchQuery ? (
            <button onClick={() => { setSearchQuery(''); setSearchResults(null); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"><X size={12} /></button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/30 flex items-center gap-0.5">
              <Command size={9} />K
            </kbd>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showSearch ? (
          <SearchPanel results={searchResults!} total={searchTotal} query={searchQuery} searching={searching} mode={searchMode} />
        ) : (
          <>
            <div ref={containerRef} className="flex-1 overflow-hidden relative">
              {!isZoomed ? (
                /* === FILES === */
                <svg width={dims.w} height={dims.h} className="select-none animate-fade-in">
                  <defs>
                    {P.map((c, i) => (
                      <radialGradient key={i} id={`g${i}`} cx="35%" cy="30%" r="70%">
                        <stop offset="0%" stopColor={c.border} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={c.bg} stopOpacity="1" />
                      </radialGradient>
                    ))}
                  </defs>
                  <g transform={`translate(${(dims.w - filePack.size) / 2},${(dims.h - filePack.size) / 2})`}>
                    {filePack.root.children?.map((node, i) => {
                      const c = P[i % P.length]; const r = node.r; const hov = hoveredId === node.data.id;
                      const fs = Math.max(Math.min(r * 0.21, 13), 7);
                      const lines = wrapText(node.data.label, Math.floor((r * 1.6) / (fs * 0.55)));
                      const orig = findNode(tree!, node.data.id);
                      const lc = orig ? countLeaves(orig) : 0;
                      const sc = orig ? orig.children.filter(x => !/^[=\-_\s]{5,}$/.test(x.label.trim())).length : 0;
                      const sub = `${sc} sections \u00b7 ${lc} rules`;
                      const icon = node.data.icon || '';

                      return (
                        <g key={node.data.id}
                          onClick={() => { setZoomedFile(node.data); setZoomedIdx(i); setDetail(null); setTooltip(null); }}
                          onMouseEnter={e => onHover(e, `${icon} ${node.data.label}`, sub, node.data.id)} onMouseLeave={offHover}
                          style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
                          transform={hov ? `translate(${node.x * 0.01},${node.y * 0.01}) scale(0.99)` : undefined}>
                          {hov && <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke={c.glow} strokeWidth={8} />}
                          <circle cx={node.x} cy={node.y} r={r} fill={`url(#g${i % P.length})`}
                            stroke={c.border} strokeWidth={hov ? 2.5 : 1.5} strokeOpacity={hov ? 1 : 0.5} />
                          {r > 22 && <text x={node.x} y={node.y - fs * (lines.length * 0.55 + 0.9)} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(r * 0.35, 24)} className="pointer-events-none">{icon}</text>}
                          {r > 16 && lines.map((l, li) => <text key={li} x={node.x} y={node.y + (li - (lines.length - 1) / 2) * fs * 1.25 + (r > 22 ? fs * 0.4 : 0)} textAnchor="middle" dominantBaseline="central" fill={c.text} fontSize={fs} fontWeight={600} className="pointer-events-none">{l}</text>)}
                          {r > 38 && <text x={node.x} y={node.y + (lines.length / 2) * fs * 1.25 + fs * 1.5} textAnchor="middle" dominantBaseline="central" fill={c.border} fontSize={fs * 0.6} opacity={0.5} className="pointer-events-none">{sub}</text>}
                        </g>
                      );
                    })}
                  </g>
                  {tooltip && <Tooltip {...tooltip} svgW={dims.w} />}
                  {/* Onboarding hint */}
                  {!hoveredId && (
                    <text x={dims.w / 2} y={dims.h - 16} textAnchor="middle" fill="#334155" fontSize={11} className="pointer-events-none">
                      Click a bubble to explore  \u00b7  {'\u2318'}K to search
                    </text>
                  )}
                </svg>
              ) : (
                /* === SECTIONS === */
                <svg width={dims.w - (detail ? 380 : 0)} height={dims.h} className="select-none animate-fade-in">
                  <defs>
                    <radialGradient id="gc" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" /><stop offset="100%" stopColor="#2a0f0f" stopOpacity="1" /></radialGradient>
                    <radialGradient id="gh" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" /><stop offset="100%" stopColor="#2a1f0f" stopOpacity="1" /></radialGradient>
                    {P.map((c, i) => <radialGradient key={`s${i}`} id={`sg${i}`} cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor={c.border} stopOpacity="0.12" /><stop offset="100%" stopColor={c.bg} stopOpacity="1" /></radialGradient>)}
                  </defs>
                  {(() => { const sw = dims.w - (detail ? 380 : 0); return (
                    <g transform={`translate(${(sw - sectionPack!.size) / 2},${(dims.h - sectionPack!.size) / 2})`}>
                      <circle cx={sectionPack!.root.x} cy={sectionPack!.root.y} r={sectionPack!.root.r} fill="none" stroke={P[zoomedIdx % P.length].border} strokeWidth={1} strokeOpacity={0.1} />
                      {sectionPack!.root.children?.map((node, i) => {
                        const imp = node.data.importance; const sel = detail?.id === node.data.id; const hov = hoveredId === node.data.id;
                        const bdr = imp === 'critical' ? '#ef4444' : imp === 'high' ? '#f59e0b' : P[i % P.length].border;
                        const glw = imp === 'critical' ? '#ef444440' : imp === 'high' ? '#f59e0b40' : P[i % P.length].glow;
                        const txt = imp === 'critical' ? '#fecaca' : imp === 'high' ? '#fef3c7' : P[i % P.length].text;
                        const gid = imp === 'critical' ? 'gc' : imp === 'high' ? 'gh' : `sg${i % P.length}`;
                        const r = node.r; const fs = Math.max(Math.min(r * 0.23, 12), 7);
                        const lines = wrapText(node.data.label, Math.floor((r * 1.6) / (fs * 0.55)));
                        const orig = findNode(tree!, node.data.id);
                        const ic = orig ? orig.children.length : 0; const cc = orig ? countByImp(orig, 'critical') : 0;
                        const sub = `${ic} items${cc > 0 ? ` \u00b7 ${cc} critical` : ''}`;

                        return (
                          <g key={node.data.id}
                            onClick={() => { const o = findNode(tree!, node.data.id); if (o) { setDetail(o); setTooltip(null); } }}
                            onMouseEnter={e => onHover(e, node.data.label, sub, node.data.id)} onMouseLeave={offHover} style={{ cursor: 'pointer' }}>
                            {(hov || sel) && <circle cx={node.x} cy={node.y} r={r + 3} fill="none" stroke={glw} strokeWidth={sel ? 5 : 6} />}
                            <circle cx={node.x} cy={node.y} r={r} fill={`url(#${gid})`} stroke={bdr} strokeWidth={sel ? 2.5 : 1.5} strokeOpacity={hov || sel ? 1 : 0.5} />
                            {imp === 'critical' && r > 18 && <text x={node.x} y={node.y - r * 0.4} textAnchor="middle" dominantBaseline="central" fontSize={fs * 1.3} className="pointer-events-none">!</text>}
                            {r > 12 && lines.map((l, li) => <text key={li} x={node.x} y={node.y + (li - (lines.length - 1) / 2) * fs * 1.2 + ((imp === 'critical' && r > 18) ? fs * 0.4 : 0)} textAnchor="middle" dominantBaseline="central" fill={txt} fontSize={fs} fontWeight={500} className="pointer-events-none">{l}</text>)}
                            {r > 28 && <text x={node.x} y={node.y + (lines.length / 2) * fs * 1.2 + fs * 0.9} textAnchor="middle" dominantBaseline="central" fill={bdr} fontSize={fs * 0.6} opacity={0.4} className="pointer-events-none">{sub}</text>}
                          </g>
                        );
                      })}
                    </g>
                  ); })()}
                  {tooltip && <Tooltip {...tooltip} svgW={dims.w - (detail ? 380 : 0)} />}
                </svg>
              )}
            </div>
            {detail && <DetailPanel node={detail} onClose={() => setDetail(null)} />}
          </>
        )}
      </div>
    </div>
  );
}

/* Tooltip */
function Tooltip({ x, y, label, sub, svgW }: { x: number; y: number; label: string; sub: string; svgW: number }) {
  return (
    <foreignObject x={Math.max(8, Math.min(x - 125, svgW - 258))} y={y - 54} width={250} height={52} className="pointer-events-none overflow-visible">
      <div className="glass-panel rounded-lg px-3 py-2 shadow-2xl shadow-black/50 text-center animate-fade-in">
        <div className="text-[12px] font-medium text-slate-200 truncate">{label}</div>
        <div className="text-[11px] text-slate-500">{sub}</div>
      </div>
    </foreignObject>
  );
}

/* Detail panel */
function DetailPanel({ node, onClose }: { node: TreeNode; onClose: () => void }) {
  const cc = countByImp(node, 'critical'); const hc = countByImp(node, 'high');
  return (
    <div className="w-[380px] border-l border-slate-800/40 bg-[#0a0a12]/95 backdrop-blur-xl flex flex-col overflow-hidden shrink-0 animate-slide-in">
      <div className="px-4 py-3 border-b border-slate-800/40">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-semibold text-[13px] text-slate-100 truncate">{node.label}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-800/60 text-slate-600 hover:text-slate-300 transition-colors"><X size={13} /></button>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-600">{node.children.length} items</span>
          {cc > 0 && <span className="text-red-400/80 flex items-center gap-1"><AlertTriangle size={9} />{cc} critical</span>}
          {hc > 0 && <span className="text-amber-400/80 flex items-center gap-1"><Shield size={9} />{hc} important</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {node.children.map((item, i) => <DItem key={i} item={item} depth={0} />)}
      </div>
      {node.source && <div className="px-4 py-2 border-t border-slate-800/30 text-[10px] text-slate-700 truncate flex items-center gap-1"><FileText size={9} />{node.source}</div>}
    </div>
  );
}

function DItem({ item, depth }: { item: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const has = item.children.length > 0;
  const imp = item.importance;
  return (
    <div style={{ marginLeft: depth * 10 }}>
      <div className={`flex items-start gap-1.5 px-3 py-2 rounded-lg text-[12.5px] leading-relaxed transition-all
        ${imp === 'critical' ? 'bg-red-500/8 border-l-2 border-red-500/60 text-red-200' :
          imp === 'high' ? 'bg-amber-500/8 border-l-2 border-amber-500/50 text-amber-200' :
          'text-slate-400 border-l-2 border-transparent hover:bg-slate-800/30'}
        ${has ? 'cursor-pointer' : ''}`}
        onClick={has ? () => setOpen(!open) : undefined}>
        {has && <span className="mt-0.5 shrink-0 text-slate-600">{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>}
        <span className="flex-1">{item.label}</span>
        {has && !open && <span className="text-[10px] text-slate-700 shrink-0">{item.children.length}</span>}
      </div>
      {has && open && <div className="mt-0.5 space-y-0.5">{item.children.map((c, i) => <DItem key={i} item={c} depth={depth + 1} />)}</div>}
    </div>
  );
}

/* Search */
function SearchPanel({ results, total, query, searching, mode }: { results: SearchResult[]; total: number; query: string; searching: boolean; mode: string }) {
  if (searching) return <div className="flex-1 flex flex-col items-center justify-center text-slate-500 animate-fade-in"><RefreshCw size={18} className="animate-spin mb-3 text-violet-400" /><p className="text-sm">Searching...</p></div>;
  if (!results.length) return <div className="flex-1 flex flex-col items-center justify-center text-slate-600 animate-fade-in"><Search size={28} className="mb-3 text-slate-700" /><p className="text-sm">No results for "{query}"</p></div>;

  const isAI = mode === 'ai'; const ql = query.toLowerCase();
  return (
    <div className="flex-1 overflow-y-auto p-5 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-slate-600">{total} result{total !== 1 ? 's' : ''} for <span className="text-slate-400">"{query}"</span></span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${isAI ? 'bg-violet-500/10 text-violet-400 border border-violet-500/15' : 'bg-slate-800/50 text-slate-600'}`}>
          {isAI ? 'AI Search' : 'Keyword'}
        </span>
      </div>
      <div className="space-y-2.5">
        {results.map((hit, i) => (
          <div key={i} className={`rounded-xl overflow-hidden border ${hit.importance === 'critical' ? 'border-red-500/20 bg-red-500/[0.03]' : hit.importance === 'high' ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-slate-800/40'}`}>
            {isAI && hit.explanation && (
              <div className="px-4 py-2 bg-violet-500/[0.04] border-b border-violet-500/10">
                <p className="text-[11.5px] text-violet-300/70 leading-relaxed">{hit.explanation}</p>
              </div>
            )}
            <div className="px-4 py-1.5 border-b border-slate-800/30 flex items-center gap-1.5">
              <FileText size={11} className="text-slate-600" />
              <span className="text-[11px] font-mono text-slate-600 truncate">{hit.file}</span>
              {hit.section && <><ChevronRight size={9} className="text-slate-700" /><span className="text-[11px] text-slate-500 truncate">{hit.section}</span></>}
            </div>
            <div className="px-4 py-2.5 space-y-1">
              {hit.lines.map((line, j) => { const li = lineImp(line); return (
                <div key={j} className={`text-[13px] leading-relaxed flex items-start gap-2 ${li === 'critical' ? 'text-red-200' : li === 'high' ? 'text-amber-200' : 'text-slate-300'}`}>
                  {li === 'critical' && <span className="text-[9px] mt-1 shrink-0">!</span>}
                  <span>{isAI ? line : <Hl text={line} q={ql} />}</span>
                </div>
              ); })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const ps: React.ReactNode[] = []; let r = text; let k = 0;
  while (r) { const i = r.toLowerCase().indexOf(q); if (i < 0) { ps.push(<span key={k++}>{r}</span>); break; }
    if (i > 0) ps.push(<span key={k++}>{r.slice(0, i)}</span>);
    ps.push(<mark key={k++} className="bg-blue-500/25 text-blue-200 rounded px-0.5">{r.slice(i, i + q.length)}</mark>);
    r = r.slice(i + q.length);
  }
  return <>{ps}</>;
}
