import { create } from 'zustand';
import { UserDto, AiProviderType } from '../types/shared';
import { authApi } from '../api';

interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateKeys: (data: { preferredProvider: AiProviderType; preferredModel?: string; openAiKey?: string; claudeKey?: string; geminiKey?: string }) => Promise<void>;
}

const getInitialToken = () => localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getInitialToken(),
  isAuthenticated: !!getInitialToken(),
  isLoading: false,

  login: async (email, pass) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(email, pass);
      localStorage.setItem('vedha_token', res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  register: async (email, pass, name) => {
    set({ isLoading: true });
    try {
      const res = await authApi.register(email, pass, name);
      localStorage.setItem('vedha_token', res.token);
      set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('vedha_token');
    localStorage.removeItem('resumate_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    try {
      const user = await authApi.getCurrentUser();
      set({ user, isAuthenticated: true });
    } catch {
      localStorage.removeItem('vedha_token');
      localStorage.removeItem('resumate_token');
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  updateKeys: async (data) => {
    await authApi.updateKeys(data);
    const user = await authApi.getCurrentUser();
    set({ user });
  },
}));

const getSavedThemeIsDark = () => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('vedha_theme') || localStorage.getItem('resumate_theme');
  if (saved === 'light') return false;
  if (saved === 'dark') return true;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const initialIsDark = getSavedThemeIsDark();
if (typeof document !== 'undefined') {
  if (initialIsDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }
}

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialIsDark,
  toggleTheme: () =>
    set((state) => {
      const next = !state.isDark;
      localStorage.setItem('vedha_theme', next ? 'dark' : 'light');
      if (typeof document !== 'undefined') {
        if (next) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
        }
      }
      return { isDark: next };
    }),
  setTheme: (isDark: boolean) => {
    localStorage.setItem('vedha_theme', isDark ? 'dark' : 'light');
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    }
    set({ isDark });
  },
}));
