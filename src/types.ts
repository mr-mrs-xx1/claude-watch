export interface Project {
  id: string;
  name: string;
  path: string;
  created_at: string;
  last_active_at: string | null;
}

export interface Session {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'completed';
  summary: string | null;
  event_count?: number;
}

export interface CWEvent {
  id?: number;
  session_id: string;
  project_id: string;
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
  name: string;
  description: string | null;
  created_at: string;
  git_ref: string | null;
  file_count: number;
  metadata: string | null;
}

export interface HookPayload {
  session_id: string;
  type: 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop';
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  message?: string;
  project_path?: string;
  // Claude Code sends these in the hook input
  session_id_from_env?: string;
}

export interface WebSocketMessage {
  type: 'event' | 'session_update' | 'project_update' | 'snapshot';
  data: unknown;
}

export interface DashboardStats {
  total_projects: number;
  active_sessions: number;
  total_events_today: number;
  total_snapshots: number;
}
