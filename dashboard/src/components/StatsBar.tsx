import { Activity, FolderOpen, Camera, Wifi, WifiOff } from 'lucide-react';
import type { DashboardStats } from '../types';

interface Props {
  stats: DashboardStats;
  connected: boolean;
}

export function StatsBar({ stats, connected }: Props) {
  return (
    <div className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-6">
          <Stat icon={<FolderOpen size={16} />} label="Projects" value={stats.total_projects} />
          <Stat icon={<Activity size={16} />} label="Events Today" value={stats.total_events_today} />
          <Stat icon={<Camera size={16} />} label="Snapshots" value={stats.total_snapshots} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {connected ? (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <Wifi size={14} />
            <span>Live</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <WifiOff size={14} />
            <span>Disconnected</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{icon}</span>
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
    </div>
  );
}
