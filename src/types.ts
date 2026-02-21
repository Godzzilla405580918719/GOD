export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
}

export interface AutomationTask {
  id: string;
  name: string;
  command: string;
  enabled: boolean;
}

export interface LlmSettings {
  endpoint: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  command: string;
  source: 'manual' | 'prompt';
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  requestId: string;
  title: string;
  command: string;
  source: 'manual' | 'prompt';
  decision: 'approved' | 'denied';
  decidedAt: string;
}
