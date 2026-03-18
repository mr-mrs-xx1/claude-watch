import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Camera, RotateCcw, Trash2, GitBranch, Plus } from 'lucide-react';
import type { Snapshot, Project } from '../types';

interface Props {
  snapshots: Snapshot[];
  projects: Project[];
  selectedProject: string | null;
  onRefresh: () => void;
}

export function SnapshotPanel({ snapshots, projects, selectedProject, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleCreate = async () => {
    const projectId = selectedProject || projects[0]?.id;
    if (!projectId || !name.trim()) return;

    try {
      await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name: name.trim(), description: description.trim() || undefined }),
      });
      setName('');
      setDescription('');
      setCreating(false);
      onRefresh();
    } catch {
      // Handle error
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm('Restore this snapshot? A safety backup will be created first.')) return;
    setRestoring(id);
    try {
      await fetch(`/api/snapshots/${id}/restore`, { method: 'POST' });
      onRefresh();
    } catch {
      // Handle error
    }
    setRestoring(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snapshot?')) return;
    try {
      await fetch(`/api/snapshots/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      // Handle error
    }
  };

  return (
    <div className="p-6">
      {/* Create snapshot */}
      <div className="mb-6">
        {creating ? (
          <div className="card p-4 space-y-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Snapshot name (e.g., 'before-refactor')"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors"
              >
                Create Snapshot
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-4 py-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            disabled={projects.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 border border-slate-700 rounded-lg text-sm transition-colors"
          >
            <Plus size={16} />
            New Snapshot
          </button>
        )}
      </div>

      {/* Snapshot list */}
      {snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Camera size={48} className="mb-4 text-slate-700" />
          <p className="text-lg font-medium">No snapshots</p>
          <p className="text-sm mt-1">Create snapshots to save your project state at key moments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map(snapshot => (
            <div key={snapshot.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Camera size={20} className="text-indigo-400 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{snapshot.name}</span>
                      {snapshot.project_name && (
                        <span className="badge badge-gray">{snapshot.project_name}</span>
                      )}
                    </div>
                    {snapshot.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{snapshot.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span>{formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true })}</span>
                      {snapshot.git_ref && (
                        <span className="flex items-center gap-1">
                          <GitBranch size={12} />
                          <code className="bg-slate-800 px-1 rounded">{snapshot.git_ref}</code>
                        </span>
                      )}
                      {snapshot.file_count > 0 && (
                        <span>{snapshot.file_count} files</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {snapshot.git_ref && (
                    <button
                      onClick={() => handleRestore(snapshot.id)}
                      disabled={restoring === snapshot.id}
                      className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors"
                      title="Restore snapshot"
                    >
                      <RotateCcw size={16} className={restoring === snapshot.id ? 'animate-spin' : ''} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(snapshot.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete snapshot"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
