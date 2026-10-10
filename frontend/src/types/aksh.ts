// Aksh conversational surface contracts (mirror backend camelCase JSON).
export type AkshSessionStatus =
  | 'Planning'
  | 'Executing'
  | 'AwaitingApproval'
  | 'Paused'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type AkshApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Expired'
  | 'Consumed';

export type AutonomyLevel = 'Supervised' | 'SupervisedAuto';

export interface AkshTodoItem {
  step: string;
  tool?: string;
  detail?: string;
  state: 'pending' | 'active' | 'done' | 'failed' | string;
}

export interface AkshSessionDto {
  id: string;
  userId: string;
  goal: string;
  jobUrl?: string;
  autonomyLevel: AutonomyLevel;
  status: AkshSessionStatus;
  todos: AkshTodoItem[];
  tokenInputTotal: number;
  tokenOutputTotal: number;
  createdAtUtc: string;
}

export interface AkshMessageDto {
  id: string;
  role: string;
  toolName?: string;
  summaryText: string;
  artifactRef?: string;
  inputTokens: number;
  outputTokens: number;
  createdAtUtc: string;
}

export interface AkshApprovalDto {
  id: string;
  sessionId: string;
  queueItemId?: string;
  toolName: string;
  argumentsJson: string;
  status: AkshApprovalStatus;
  expiresAtUtc: string;
  decidedAtUtc?: string;
}

export interface AkshAuditDto {
  session: AkshSessionDto;
  messages: AkshMessageDto[];
  approvals: AkshApprovalDto[];
}

export interface AkshDecisionResult {
  approved: boolean;
  reasonCode?: string;
  message: string;
  queueItemId?: string;
  queueStatus?: string;
}

export interface AkshConfig {
  enabled: boolean;
  dailyTokenBudget: number;
}

export interface AkshAnswerEdit {
  question: string;
  answer: string;
}
