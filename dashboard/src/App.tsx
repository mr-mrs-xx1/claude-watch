import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { BrainGraph } from './components/BrainGraph';
import { ActivityFeed } from './components/ActivityFeed';
import { ProjectSidebar } from './components/ProjectSidebar';
import { EventDetail } from './components/EventDetail';
import { SnapshotPanel } from './components/SnapshotPanel';
import { Brain, Activity, Camera } from 'lucide-react';
import type { CWEvent, Project, DashboardStats, Snapshot } from './types';

type Tab = 'brain' | 'activity' | 'snapshots';

export default function App() {
  const [events, setEvents] = useState<CWEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total_projects: 0, active_sessions: 0, total_events_today: 0, total_snapshots: 0 });
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CWEvent | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('brain');

  const fetchData = useCallback(async () => {
    try {
      const pf = selectedProject ? `?project_id=${selectedProject}` : '';
      const [eventsRes, projectsRes, statsRes, snapshotsRes] = await Promise.all([
        fetch(`/api/events${pf ? pf + '&' : '?'}limit=100`),
        fetch('/api/projects'),
        fetch('/api/events/stats'),
        fetch(`/api/snapshots${pf}`),
      ]);
      setEvents(await eventsRes.json() as CWEvent[]);
      const pd = await projectsRes.json() as Project[];
      setProjects(pd);
      setStats(await statsRes.json() as DashboardStats);
      setSnapshots(await snapshotsRes.json() as Snapshot[]);
      if (!selectedProject && pd.length > 0) setSelectedProject(pd[0].id);
    } catch {}
  }, [selectedProject]);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 10000); return () => clearInterval(t); }, [fetchData]);

  const handleWSMessage = useCallback((msg: { type: string; data: unknown }) => {
    if (msg.type === 'event') {
      const event = msg.data as CWEvent;
      if (!selectedProject || event.project_id === selectedProject) {
        setEvents(prev => [event, ...prev].slice(0, 200));
      }
    } else { fetchData(); }
  }, [selectedProject, fetchData]);

  const { connected } = useWebSocket(handleWSMessage);

  return (
    <div className="h-screen flex mesh-bg">
      <ProjectSidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(id) => { setSelectedProject(id); setSelectedEvent(null); }}
        connected={connected}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal tab strip */}
        <div className="flex items-center justify-between px-1 shrink-0">
          <div className="flex">
            {([
              { id: 'brain' as Tab, label: 'Project Brain', icon: <Brain size={13} /> },
              { id: 'activity' as Tab, label: 'Live Changes', icon: <Activity size={13} /> },
              { id: 'snapshots' as Tab, label: 'Snapshots', icon: <Camera size={13} /> },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedEvent(null); }}
                className={`px-4 py-2.5 text-[13px] font-medium flex items-center gap-1.5 transition-all relative
                  ${activeTab === tab.id
                    ? 'text-slate-200'
                    : 'text-slate-600 hover:text-slate-400'}`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {activeTab === 'brain' && <BrainGraph projectId={selectedProject} />}
            {activeTab === 'activity' && (
              <div className="h-full overflow-y-auto">
                <ActivityFeed events={events} onSelectEvent={setSelectedEvent} selectedEventId={selectedEvent?.id} />
              </div>
            )}
            {activeTab === 'snapshots' && (
              <div className="h-full overflow-y-auto">
                <SnapshotPanel snapshots={snapshots} projects={projects} selectedProject={selectedProject} onRefresh={fetchData} />
              </div>
            )}
          </div>
          {selectedEvent && activeTab === 'activity' && (
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
