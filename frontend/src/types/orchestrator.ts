import { JobSource } from './job';

export enum PipelineExecutionStatus {
  Prepared = 'Prepared',
  Reviewing = 'Reviewing',
  RunningAutomation = 'RunningAutomation',
  PausedForUserReview = 'PausedForUserReview',
  Submitted = 'Submitted',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  DispatchedToExtension = 'DispatchedToExtension'
}

export interface CandidateProfileDto {
  id?: string;
  phoneNumber: string;
  currentCity: string;
  currentCountry: string;
  workAuthorizationStatus: string;
  requiresVisaSponsorship: boolean;
  noticePeriodDays: number;
  currentSalary: string;
  expectedSalary: string;
  salaryCurrency: string; // 'INR' | 'USD' | 'GBP' | 'EUR'
  willingToRelocate: boolean;
  remotePreference: string;
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  equalEmploymentGender?: string;
  equalEmploymentRace?: string;
  equalEmploymentVeteran?: string;
  equalEmploymentDisability?: string;
  evidenceKnowledgeBase: Record<string, string>;
}

export interface ScreeningQuestionMemoryDto {
  id: string;
  company: string;
  questionHash: string;
  questionText: string;
  answerText: string;
  fieldType: string;
  successCount: number;
  lastUsedAtUtc: string;
}

export interface ScreeningQuestionAnswerDto {
  questionText: string;
  answerText: string;
  fieldType: string;
  confidenceScore: number;
  evidenceSnippet: string;
  source: string;
}

export interface ApplicationQueueItemDto {
  id: string;
  userId: string;
  jobUrl: string;
  resolvedDestinationUrl: string;
  targetCompany: string;
  targetRole: string;
  detectedSource: JobSource;
  generatedResumeId?: string;
  coverLetterText: string;
  prefilledAnswers: ScreeningQuestionAnswerDto[];
  status: PipelineExecutionStatus;
  requiresManualReview: boolean;
  executionLogs: string[];
  errorMessage?: string;
  appliedAtUtc?: string;
  createdAtUtc: string;
}

export interface DetectedJobSourceDto {
  originalUrl: string;
  resolvedUrl: string;
  detectedSource: JobSource;
  company: string;
  title: string;
  cleanedText: string;
}

export interface PreparePackageRequest {
  masterResumeId: string;
  jobUrl: string;
  directJobDescriptionText?: string;
  templateStyle?: number;
  customQuestions?: string[];
}

export interface ApplicationAutomationResultDto {
  success: boolean;
  message: string;
  finalPageUrl?: string;
  pausedForUserReview: boolean;
  executionLogs: string[];
  errorDetails?: string;
}

// --- Autonomous Job Application SaaS Types (BRD Architecture) ---

export interface ApplicationAuditDto {
  id: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string;
  status: 'pending' | 'generating_resume' | 'applying' | 'success' | 'failed' | 'hitl_required';
  resumeS3Url?: string;
  errorMessage?: string;
  hitlQuestion?: string;
  hitlAnswer?: string;
  appliedAtUtc?: string;
  createdAtUtc: string;
}

export interface CareerAchievementDto {
  id: string;
  content: string;
  embeddingDimension: number;
  createdAtUtc: string;
}

export interface UserCreditsDto {
  creditsBalance: number;
  email: string;
}

export interface IngestJobRequest {
  jobTitle?: string;
  companyName?: string;
  jobUrl: string;
  jobDescription?: string;
}
