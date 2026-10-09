import { apiClient, API_BASE_URL } from "./client";
import {
  MasterResumeDto,
  ResumeSchema,
  ResumeVersionDto,
  TemplateStyle,
  ResumeFormat,
} from "../types/resume";
import { JobDescriptionDto } from "../types/job";
import {
  TailoredResumeResultDto,
  GeneratedResumeSummaryDto,
} from "../types/ats";
import {
  ApplicationRecordDto,
  ApplicationStatus,
  CreateApplicationRequest,
} from "../types/application";
import {
  AuthResponseDto,
  UserDto,
  CoverLetterDto,
  InterviewPrepDto,
  PromptTemplateDto,
  DashboardAnalyticsDto,
  AiProviderType,
} from "../types/shared";

export const authApi = {
  login: (email: string, password: string) =>
    apiClient
      .post<AuthResponseDto>("/auth/login", { email, password })
      .then((res) => res.data),

  register: (email: string, password: string, fullName: string) =>
    apiClient
      .post<AuthResponseDto>("/auth/register", { email, password, fullName })
      .then((res) => res.data),

  getCurrentUser: () =>
    apiClient.get<UserDto>("/auth/me").then((res) => res.data),

  refreshToken: (accessToken: string, refreshToken: string) =>
    apiClient
      .post<AuthResponseDto>("/auth/refresh", { accessToken, refreshToken })
      .then((res) => res.data),

  revokeToken: (refreshToken: string) =>
    apiClient
      .post<{ success: boolean; message: string }>("/auth/revoke", { refreshToken })
      .then((res) => res.data),

  updateKeys: (data: {
    preferredProvider: AiProviderType;
    preferredModel?: string;
    openAiKey?: string;
    claudeKey?: string;
    geminiKey?: string;
  }) => apiClient.put("/auth/keys", data).then((res) => res.data),
};

export const masterResumeApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post<MasterResumeDto>("/masterresume/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data);
  },

  get: () =>
    apiClient
      .get<MasterResumeDto | null>("/masterresume")
      .then((res) => res.data),

  update: (title: string, schema: ResumeSchema, changeDescription?: string) =>
    apiClient
      .put<MasterResumeDto>("/masterresume", {
        title,
        schema,
        changeDescription,
      })
      .then((res) => res.data),

  getVersions: () =>
    apiClient
      .get<ResumeVersionDto[]>("/masterresume/versions")
      .then((res) => res.data),

  revertVersion: (versionId: string) =>
    apiClient
      .post<MasterResumeDto>(`/masterresume/versions/${versionId}/revert`)
      .then((res) => res.data),

  delete: () => apiClient.delete("/masterresume").then((res) => res.data),
};

export const jobApi = {
  scrapeUrl: (url: string) =>
    apiClient
      .post<JobDescriptionDto>("/job/scrape", { url })
      .then((res) => res.data),

  parseRawText: (rawText: string, company?: string, title?: string) =>
    apiClient
      .post<JobDescriptionDto>("/job/parse", { rawText, company, title })
      .then((res) => res.data),

  getRecentJobs: () =>
    apiClient.get<JobDescriptionDto[]>("/job").then((res) => res.data),
};

export const tailorApi = {
  generate: (params: {
    masterResumeId?: string;
    jobDescriptionId?: string;
    directJobUrl?: string;
    directJobText?: string;
    selectedTemplate?: TemplateStyle;
    providerOverride?: AiProviderType;
    modelOverride?: string;
  }) =>
    apiClient
      .post<TailoredResumeResultDto>("/tailor/generate", params)
      .then((res) => res.data),

  getById: (id: string) =>
    apiClient
      .get<TailoredResumeResultDto>(`/tailor/${id}`)
      .then((res) => res.data),

  getHistory: () =>
    apiClient
      .get<GeneratedResumeSummaryDto[]>("/tailor/history")
      .then((res) => res.data),

  update: (
    id: string,
    updatedSchema: ResumeSchema,
    selectedTemplate?: TemplateStyle,
  ) =>
    apiClient
      .put<TailoredResumeResultDto>(`/tailor/${id}`, {
        updatedSchema,
        selectedTemplate,
      })
      .then((res) => res.data),

  exportUrl: (
    id: string,
    format: ResumeFormat = ResumeFormat.Pdf,
    style: TemplateStyle = TemplateStyle.ClassicAts,
  ) => `${API_BASE_URL}/tailor/${id}/export?format=${format}&style=${style}`,
};

export const applicationsApi = {
  list: (status?: ApplicationStatus) =>
    apiClient
      .get<ApplicationRecordDto[]>("/applications", { params: { status } })
      .then((res) => res.data),

  create: (req: CreateApplicationRequest) =>
    apiClient
      .post<ApplicationRecordDto>("/applications", req)
      .then((res) => res.data),

  updateStatus: (
    id: string,
    status: ApplicationStatus,
    appliedDate?: string,
    nextInterviewDate?: string,
  ) =>
    apiClient
      .put<ApplicationRecordDto>(`/applications/${id}/status`, {
        status,
        appliedDate,
        nextInterviewDate,
      })
      .then((res) => res.data),

  updateDetails: (id: string, data: Partial<ApplicationRecordDto>) =>
    apiClient
      .put<ApplicationRecordDto>(`/applications/${id}`, { id, ...data })
      .then((res) => res.data),

  delete: (id: string) =>
    apiClient.delete(`/applications/${id}`).then((res) => res.data),
};

export const toolsApi = {
  generateCoverLetter: (
    generatedResumeId: string,
    tone = "Professional",
    specificPoints?: string,
  ) =>
    apiClient
      .post<CoverLetterDto>("/tools/cover-letter", {
        generatedResumeId,
        tone,
        specificPoints,
      })
      .then((res) => res.data),

  generateInterviewPrep: (generatedResumeId: string) =>
    apiClient
      .post<InterviewPrepDto>("/tools/interview-prep", { generatedResumeId })
      .then((res) => res.data),

  generateSkillRoadmap: (generatedResumeId: string) =>
    apiClient
      .post<any[]>("/tools/skill-roadmap", { generatedResumeId })
      .then((res) => res.data),
};

export const promptsApi = {
  list: () =>
    apiClient.get<PromptTemplateDto[]>("/prompts").then((res) => res.data),

  save: (data: Omit<PromptTemplateDto, "id" | "isDefault">) =>
    apiClient.post<PromptTemplateDto>("/prompts", data).then((res) => res.data),

  reset: (key: string) =>
    apiClient.post(`/prompts/${key}/reset`).then((res) => res.data),
};

export const analyticsApi = {
  getDashboard: () =>
    apiClient
      .get<DashboardAnalyticsDto>("/analytics/dashboard")
      .then((res) => res.data),
};

export const candidateProfileApi = {
  get: () =>
    apiClient
      .get<
        import("../types/orchestrator").CandidateProfileDto
      >("/candidateprofile")
      .then((res) => res.data),

  update: (data: import("../types/orchestrator").CandidateProfileDto) =>
    apiClient
      .put<
        import("../types/orchestrator").CandidateProfileDto
      >("/candidateprofile", data)
      .then((res) => res.data),

  getScreeningMemories: (company?: string) =>
    apiClient
      .get<
        import("../types/orchestrator").ScreeningQuestionMemoryDto[]
      >("/candidateprofile/screening-memories", { params: { company } })
      .then((res) => res.data),

  saveScreeningMemory: (
    company: string,
    questionText: string,
    answerText: string,
    fieldType = "text",
  ) =>
    apiClient
      .post<
        import("../types/orchestrator").ScreeningQuestionMemoryDto
      >("/candidateprofile/screening-memories", { company, questionText, answerText, fieldType })
      .then((res) => res.data),
};

export const orchestratorApi = {
  detectSource: (url: string) =>
    apiClient
      .post<
        import("../types/orchestrator").DetectedJobSourceDto
      >("/orchestrator/detect-source", { url })
      .then((res) => res.data),

  generateAnswers: (
    company: string,
    questions: string[],
    masterResumeId?: string,
  ) =>
    apiClient
      .post<
        import("../types/orchestrator").ScreeningQuestionAnswerDto[]
      >("/orchestrator/generate-answers", { company, questions, masterResumeId })
      .then((res) => res.data),

  preparePackage: (
    params: import("../types/orchestrator").PreparePackageRequest,
  ) =>
    apiClient
      .post<
        import("../types/orchestrator").ApplicationQueueItemDto
      >("/orchestrator/prepare-package", params)
      .then((res) => res.data),

  getQueue: (status?: string) =>
    apiClient
      .get<
        import("../types/orchestrator").ApplicationQueueItemDto[]
      >("/orchestrator/queue", { params: { status } })
      .then((res) => res.data),

  getQueueItem: (id: string) =>
    apiClient
      .get<
        import("../types/orchestrator").ApplicationQueueItemDto
      >(`/orchestrator/queue/${id}`)
      .then((res) => res.data),

  updateStatus: (id: string, status: string, errorMessage?: string) =>
    apiClient
      .put(`/orchestrator/queue/${id}/status`, { status, errorMessage })
      .then((res) => res.data),

  execute: (id: string, headed = false, copilotMode = true) =>
    apiClient
      .post<
        import("../types/orchestrator").ApplicationAutomationResultDto
      >(`/orchestrator/queue/${id}/execute`, { headed, copilotMode })
      .then((res) => res.data),
};

export const autonomousApi = {
  ingestJob: (data: import("../types/orchestrator").IngestJobRequest) =>
    apiClient
      .post<{ applicationId: string; status: string; queueTopic: string; message: string }>("/autonomousapplications/ingest-job", data)
      .then((res) => res.data),

  getApplications: (status?: string) =>
    apiClient
      .get<import("../types/orchestrator").ApplicationAuditDto[]>("/autonomousapplications/applications", { params: { status } })
      .then((res) => res.data),

  getAchievements: () =>
    apiClient
      .get<import("../types/orchestrator").CareerAchievementDto[]>("/autonomousapplications/achievements")
      .then((res) => res.data),

  addAchievement: (content: string) =>
    apiClient
      .post<import("../types/orchestrator").CareerAchievementDto>("/autonomousapplications/achievements", { content })
      .then((res) => res.data),

  resolveHitl: (applicationId: string, answer: string) =>
    apiClient
      .post<{ success: boolean; message: string }>("/autonomousapplications/resolve-hitl", { applicationId, answer })
      .then((res) => res.data),

  getCredits: () =>
    apiClient
      .get<import("../types/orchestrator").UserCreditsDto>("/autonomousapplications/credits")
      .then((res) => res.data),
};
