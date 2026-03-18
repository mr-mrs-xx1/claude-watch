export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_active_at: string | null;
  active_sessions?: number;
  total_events?: number;
}

export interface Session {
  id: string;
  project_id: string;
  project_name?: string;
  project_path?: string;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'completed';
  summary: string | null;
  event_count?: number;
}

export interface CWEvent {
  id: number;
  session_id: string;
  project_id: string;
  project_name?: string;
  timestamp: string;
  type: 'tool_use' | 'tool_result' | 'notification' | 'session_start' | 'session_end';
  tool_name: string | null;
  input_data: string | null;
  output_data: string | null;
  file_path: string | null;
  diff: string | null;
  duration_ms: number | null;
}

export interface Snapshot {
  id: string;
  project_id: string;
  session_id: string | null;
  project_name?: string;
  name: string;
  description: string | null;
  created_at: string;
  git_ref: string | null;
  file_count: number;
}

export interface DashboardStats {
  total_projects: number;
  active_sessions: number;
  total_events_today: number;
  total_snapshots: number;
}
