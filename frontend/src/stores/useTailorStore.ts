import { create } from 'zustand';
import { MasterResumeDto, ResumeSchema, ResumeVersionDto, TemplateStyle } from '../types/resume';
import { TailoredResumeResultDto } from '../types/ats';
import { masterResumeApi, tailorApi } from '../api';
import * as signalR from '@microsoft/signalr';

interface ResumeState {
  masterResume: MasterResumeDto | null;
  versions: ResumeVersionDto[];
  isLoading: boolean;
  fetchMasterResume: () => Promise<void>;
  uploadMasterResume: (file: File) => Promise<void>;
  updateMasterResume: (title: string, schema: ResumeSchema, note?: string) => Promise<void>;
  fetchVersions: () => Promise<void>;
  revertVersion: (versionId: string) => Promise<void>;
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

  updateMasterResume: async (title: string, schema: ResumeSchema, note?: string) => {
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
  generateTailoring: (params: Parameters<typeof tailorApi.generate>[0], userId: string) => Promise<TailoredResumeResultDto>;
  clearLogs: () => void;
}

export const useTailorStore = create<TailorState>((set, get) => ({
  isGenerating: false,
  progressLogs: [],
  currentProgressPercent: 0,
  currentStage: 'Ready',
  tailoredResult: null,
  selectedTemplate: TemplateStyle.ClassicAts,
  hubConnection: null,

  setSelectedTemplate: (style) => set({ selectedTemplate: style }),
  setTailoredResult: (res) => set({ tailoredResult: res }),

  initSignalR: (userId: string) => {
    if (get().hubConnection) return;

    const token = localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token');
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`/hubs/progress?access_token=${token || ''}`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    connection.on('OnTailoringProgress', (data: { stage: string; message: string; percentComplete: number; timestamp: string }) => {
      set((state) => ({
        currentStage: data.stage,
        currentProgressPercent: data.percentComplete,
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
    });

    connection.start().then(() => {
      connection.invoke('JoinUserGroup', userId).catch(console.error);
    }).catch(console.error);

    set({ hubConnection: connection });
  },

  clearLogs: () => set({ progressLogs: [], currentProgressPercent: 0, currentStage: 'Ready' }),

  generateTailoring: async (params, userId) => {
    set({ isGenerating: true, progressLogs: [], currentProgressPercent: 5, currentStage: 'Starting' });
    get().initSignalR(userId);

    try {
      const result = await tailorApi.generate(params);
      set({
        tailoredResult: result,
        isGenerating: false,
        currentProgressPercent: 100,
        currentStage: 'Completed',
      });
      return result;
    } catch (e) {
      set({ isGenerating: false, currentStage: 'Failed' });
      throw e;
    }
  },
}));
