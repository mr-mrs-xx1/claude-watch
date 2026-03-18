import { useState, useEffect } from 'react';
import { RefreshCw, ChevronRight, ChevronDown, X } from 'lucide-react';

interface TreeNode {
  id: string;
  label: string;
  type: 'root' | 'file' | 'section' | 'rule' | 'item';
  children: TreeNode[];
  content?: string;
  source?: string;
  importance?: 'critical' | 'high' | 'normal';
  icon?: string;
}

interface Props {
  projectId: string | null;
}

export function BrainTree({ projectId }: Props) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [focusNode, setFocusNode] = useState<TreeNode | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<TreeNode[]>([]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setFocusNode(null);
    setBreadcrumbs([]);
    fetch(`/api/brain/${projectId}/tree`)
      .then(r => r.json())
      .then(d => {
        setTree(d.tree);
        setFileCount(d.file_count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId) {
    return <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a project</div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-500"><RefreshCw size={18} className="animate-spin mr-2" /> Scanning project...</div>;
  }
  if (!tree) return null;

  const handleZoomIn = (node: TreeNode, parentChain: TreeNode[]) => {
    if (node.children.length > 0) {
      setFocusNode(node);
      setBreadcrumbs(parentChain);
    }
  };

  const handleZoomOut = (index: number) => {
    if (index < 0) {
      setFocusNode(null);
      setBreadcrumbs([]);
    } else {
      setFocusNode(breadcrumbs[index]);
      setBreadcrumbs(breadcrumbs.slice(0, index));
    }
  };

  const displayNode = focusNode || tree;

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb bar */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-1 text-sm shrink-0">
        <button
          onClick={() => handleZoomOut(-1)}
          className={`px-1.5 py-0.5 rounded transition-colors ${!focusNode ? 'text-slate-200 font-medium' : 'text-slate-500 hover:text-slate-300'}`}
        >
          {tree.icon} {tree.label}
        </button>
        {breadcrumbs.map((bc, i) => (
          <span key={bc.id} className="flex items-center gap-1">
            <ChevronRight size={12} className="text-slate-700" />
            <button
              onClick={() => handleZoomOut(i)}
              className="text-slate-500 hover:text-slate-300 px-1.5 py-0.5 rounded transition-colors"
            >
              {bc.icon} {bc.label}
            </button>
          </span>
        ))}
        {focusNode && (
          <span className="flex items-center gap-1">
            <ChevronRight size={12} className="text-slate-700" />
            <span className="text-slate-200 font-medium px-1.5 py-0.5">
              {focusNode.icon} {focusNode.label}
            </span>
          </span>
        )}
        <span className="ml-auto text-xs text-slate-600">{fileCount} files scanned</span>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-3xl mx-auto">
          {displayNode.children.length === 0 && displayNode.content && (
            <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{displayNode.content}</div>
          )}
          <div className="space-y-1">
            {displayNode.children.map(child => (
              <TreeRow
                key={child.id}
                node={child}
                depth={0}
                onZoomIn={(node) => handleZoomIn(node, [...breadcrumbs, ...(focusNode ? [focusNode] : [])])}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TreeRow({ node, depth, onZoomIn }: { node: TreeNode; depth: number; onZoomIn: (n: TreeNode) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;

  const importanceStyle =
    node.importance === 'critical' ? 'text-red-400' :
    node.importance === 'high' ? 'text-amber-400' :
    '';

  const importanceDot =
    node.importance === 'critical' ? 'bg-red-500' :
    node.importance === 'high' ? 'bg-amber-500' :
    '';

  const handleClick = () => {
    if (hasChildren) {
      setOpen(!open);
    }
  };

  const handleDoubleClick = () => {
    if (hasChildren) {
      onZoomIn(node);
    }
  };

  // Count total descendants for the badge
  const descendantCount = hasChildren ? countDescendants(node) : 0;

  return (
    <div>
      <div
        className={`flex items-start gap-2 py-1.5 px-2 rounded-md transition-colors cursor-pointer group
          ${isLeaf ? 'hover:bg-slate-900/50' : 'hover:bg-slate-800/40'}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Expand/collapse or bullet */}
        <div className="w-4 h-5 flex items-center justify-center shrink-0">
          {hasChildren ? (
            open
              ? <ChevronDown size={14} className="text-slate-500" />
              : <ChevronRight size={14} className="text-slate-500" />
          ) : (
            importanceDot
              ? <span className={`w-1.5 h-1.5 rounded-full ${importanceDot}`} />
              : <span className="w-1 h-1 rounded-full bg-slate-700" />
          )}
        </div>

        {/* Icon (for files/sections) */}
        {node.icon && (node.type === 'file' || node.type === 'root') && (
          <span className="text-sm shrink-0 leading-5">{node.icon}</span>
        )}

        {/* Label */}
        <span className={`text-sm leading-5 flex-1 min-w-0 ${
          node.type === 'file' ? 'font-medium text-slate-200' :
          node.type === 'section' ? 'font-medium text-slate-300' :
          importanceStyle || 'text-slate-400'
        }`}>
          {node.label}
        </span>

        {/* Descendant count badge */}
        {hasChildren && !open && descendantCount > 0 && (
          <span className="text-[11px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
            {descendantCount}
          </span>
        )}

        {/* Zoom-in button for sections with many children */}
        {hasChildren && descendantCount > 3 && (
          <button
            onClick={(e) => { e.stopPropagation(); onZoomIn(node); }}
            className="opacity-0 group-hover:opacity-100 text-[11px] text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-500/10 transition-all shrink-0"
          >
            zoom in
          </button>
        )}
      </div>

      {/* Children */}
      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeRow key={child.id} node={child} depth={depth + 1} onZoomIn={onZoomIn} />
          ))}
        </div>
      )}
    </div>
  );
}

function countDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}
