import { create } from "zustand";
import {
  MasterResumeDto,
  ResumeSchema,
  ResumeVersionDto,
  TemplateStyle,
} from "../types/resume";
import { TailoredResumeResultDto } from "../types/ats";
import { masterResumeApi, tailorApi } from "../api";
import * as signalR from "@microsoft/signalr";

interface ResumeState {
  masterResume: MasterResumeDto | null;
  versions: ResumeVersionDto[];
  isLoading: boolean;
  fetchMasterResume: () => Promise<void>;
  uploadMasterResume: (file: File) => Promise<void>;
  updateMasterResume: (
    title: string,
    schema: ResumeSchema,
    note?: string,
  ) => Promise<void>;
  fetchVersions: () => Promise<void>;
  revertVersion: (versionId: string) => Promise<void>;
  deleteMasterResume: () => Promise<void>;
}

export const useResumeStore = create<ResumeState>((set) => ({
  masterResume: null,
  versions: [],
  isLoading: false,

  fetchMasterResume: async () => {
    set({ isLoading: true });
    try {
      const data = await masterResumeApi.get();
      set({ masterResume: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  uploadMasterResume: async (file: File) => {
    set({ isLoading: true });
    try {
      const data = await masterResumeApi.upload(file);
      set({ masterResume: data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  updateMasterResume: async (
    title: string,
    schema: ResumeSchema,
    note?: string,
  ) => {
    set({ isLoading: true });
    try {
      const data = await masterResumeApi.update(title, schema, note);
      set({ masterResume: data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  fetchVersions: async () => {
    try {
      const versions = await masterResumeApi.getVersions();
      set({ versions });
    } catch (e) {
      console.error(e);
    }
  },

  revertVersion: async (versionId: string) => {
    set({ isLoading: true });
    try {
      const data = await masterResumeApi.revertVersion(versionId);
      set({ masterResume: data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  deleteMasterResume: async () => {
    set({ isLoading: true });
    try {
      await masterResumeApi.delete();
      set({ masterResume: null, versions: [], isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },
}));

export interface ProgressLog {
  stage: string;
  message: string;
  percent: number;
  timestamp: string;
}

interface TailorState {
  isGenerating: boolean;
  progressLogs: ProgressLog[];
  currentProgressPercent: number;
  currentStage: string;
  tailoredResult: TailoredResumeResultDto | null;
  selectedTemplate: TemplateStyle;
  hubConnection: signalR.HubConnection | null;
  initSignalR: (userId: string) => void;
  setSelectedTemplate: (style: TemplateStyle) => void;
  setTailoredResult: (res: TailoredResumeResultDto | null) => void;
  generateTailoring: (
    params: Parameters<typeof tailorApi.generate>[0],
    userId: string,
  ) => Promise<TailoredResumeResultDto>;
  clearLogs: () => void;
}

let initialTailoredResult: TailoredResumeResultDto | null = null;
try {
  const cached = localStorage.getItem('vedha_latest_tailored_result');
  if (cached) {
    initialTailoredResult = JSON.parse(cached);
  }
} catch {}

export const useTailorStore = create<TailorState>((set, get) => ({
  isGenerating: false,
  progressLogs: [],
  currentProgressPercent: 0,
  currentStage: 'Ready',
  tailoredResult: initialTailoredResult,
  selectedTemplate: TemplateStyle.ClassicAts,
  hubConnection: null,

  setSelectedTemplate: (style) => set({ selectedTemplate: style }),
  setTailoredResult: (res) => {
    set({ tailoredResult: res });
    try {
      if (res) {
        localStorage.setItem('vedha_latest_tailored_result', JSON.stringify(res));
      } else {
        localStorage.removeItem('vedha_latest_tailored_result');
      }
    } catch {}
  },

  initSignalR: (userId: string) => {
    if (get().hubConnection) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/progress', {
        accessTokenFactory: () =>
          localStorage.getItem('vedha_token') ||
          localStorage.getItem('resumate_token') ||
          '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on(
      'OnTailoringProgress',
      (data: {
        stage: string;
        message: string;
        percentComplete: number;
        timestamp: string;
      }) => {
        set((state) => ({
          currentStage: data.stage,
          currentProgressPercent: Math.max(state.currentProgressPercent, data.percentComplete),
          progressLogs: [
            ...state.progressLogs,
            {
              stage: data.stage,
              message: data.message,
              percent: data.percentComplete,
              timestamp: new Date(data.timestamp).toLocaleTimeString(),
            },
          ],
        }));
      }
    );

    connection
      .start()
      .then(() => {
        connection.invoke('JoinUserGroup').catch((err) => console.warn('JoinUserGroup warning:', err));
      })
      .catch((err) => {
        console.warn('SignalR start warning:', err);
      });

    set({ hubConnection: connection });
  },

  clearLogs: () =>
    set({ progressLogs: [], currentProgressPercent: 0, currentStage: 'Ready' }),

  generateTailoring: async (params, userId) => {
    const initialLogs: ProgressLog[] = [
      {
        stage: 'Initializing',
        message: 'Initializing AI tailoring engine and loading master resume...',
        percent: 10,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];

    set({
      isGenerating: true,
      progressLogs: initialLogs,
      currentProgressPercent: 10,
      currentStage: 'Initializing',
    });

    get().initSignalR(userId);

    // Active simulated milestones in case WebSocket negotiation lags
    const milestones = [
      { delay: 3000, stage: 'Job Analysis', message: 'Analyzing job description requirements & must-have competencies...', percent: 25 },
      { delay: 8000, stage: 'Skill Matching', message: 'Mapping candidate experience against target role requirements...', percent: 45 },
      { delay: 15000, stage: 'STAR Tailoring', message: 'Rewriting bullet points using STAR impact methodology (Strict Zero-Lie Policy)...', percent: 68 },
      { delay: 22000, stage: 'ATS Scoring', message: 'Running keyword density analysis, semantic scoring, and recruiter evaluation...', percent: 88 },
    ];

    const timers: any[] = [];
    milestones.forEach((m) => {
      const t = setTimeout(() => {
        if (get().isGenerating) {
          set((state) => {
            if (!state.isGenerating) return state;
            return {
              currentStage: m.stage,
              currentProgressPercent: Math.max(state.currentProgressPercent, m.percent),
              progressLogs: [
                ...state.progressLogs,
                {
                  stage: m.stage,
                  message: m.message,
                  percent: m.percent,
                  timestamp: new Date().toLocaleTimeString(),
                },
              ],
            };
          });
        }
      }, m.delay);
      timers.push(t);
    });

    try {
      const result = await tailorApi.generate(params);
      timers.forEach((t) => clearTimeout(t));

      try {
        localStorage.setItem('vedha_latest_tailored_result', JSON.stringify(result));
      } catch {}

      set((state) => ({
        tailoredResult: result,
        isGenerating: false,
        currentProgressPercent: 100,
        currentStage: 'Completed',
        progressLogs: [
          ...state.progressLogs,
          {
            stage: 'Completed',
            message: 'Tailored resume and ATS scorecard generated successfully!',
            percent: 100,
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      }));
      return result;
    } catch (e) {
      timers.forEach((t) => clearTimeout(t));
      set({ isGenerating: false, currentStage: 'Failed' });
      throw e;
    }
  },
}));

