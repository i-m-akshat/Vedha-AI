export enum AiProviderType {
  OpenAi = 'OpenAi',
  Claude = 'Claude',
  Gemini = 'Gemini'
}

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: string;
  preferredAiProvider: AiProviderType;
  preferredModel?: string;
  hasCustomOpenAiKey: boolean;
  hasCustomClaudeKey: boolean;
  hasCustomGeminiKey: boolean;
}

export interface AuthResponseDto {
  token: string;
  refreshToken?: string;
  user: UserDto;
}

export interface CoverLetterDto {
  company: string;
  role: string;
  content: string;
  createdAtUtc: string;
}

export interface InterviewQuestionItem {
  question: string;
  contextWhyAsked: string;
  suggestedStarApproach: string;
  exampleTalkingPoint: string;
}

export interface InterviewPrepDto {
  company: string;
  role: string;
  behavioralQuestions: InterviewQuestionItem[];
  technicalQuestions: InterviewQuestionItem[];
  gapProbeQuestions: InterviewQuestionItem[];
  questionsToAskEmployer: string[];
}

export interface PromptTemplateDto {
  id: string;
  templateKey: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  isDefault: boolean;
}

export interface DashboardAnalyticsDto {
  totalApplications: number;
  resumesGenerated: number;
  averageAtsScore: number;
  interviewsScheduled: number;
  offersReceived: number;
  statusBreakdown: { status: string; count: number }[];
  recentScoreTrends: { company: string; role: string; score: number; createdAtUtc: string }[];
  topMissingSkills: { skill: string; frequency: number }[];
}
