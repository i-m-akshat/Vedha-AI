import { create } from 'zustand';
import { UserDto, AiProviderType } from '../types/shared';
import { authApi } from '../api';

interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateKeys: (data: { preferredProvider: AiProviderType; preferredModel?: string; openAiKey?: string; claudeKey?: string; geminiKey?: string }) => Promise<void>;
}

const getInitialToken = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token');
  if (token) {
    localStorage.setItem('vedha_token', token);
    localStorage.removeItem('resumate_token');
  }
  return token;
};

const initialToken = getInitialToken();

export const useAuthStore = create<AuthState>((set) => {
  if (typeof window !== 'undefined') {
    window.addEventListener('vedha:unauthorized', () => {
      localStorage.removeItem('vedha_token');
      localStorage.removeItem('vedha_refresh_token');
      localStorage.removeItem('resumate_token');
      set({ user: null, token: null, isAuthenticated: false, isInitialized: true, isLoading: false });
    });
  }

  return {
    user: null,
    token: initialToken,
    isAuthenticated: !!initialToken,
    isLoading: false,
    isInitialized: !initialToken,

    login: async (email, pass) => {
      set({ isLoading: true });
      try {
        const res = await authApi.login(email, pass);
        localStorage.setItem('vedha_token', res.token);
        if (res.refreshToken) {
          localStorage.setItem('vedha_refresh_token', res.refreshToken);
        }
        localStorage.removeItem('resumate_token');
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'VEDHA_AUTH_TOKEN_SYNC', token: res.token, user: res.user }, '*');
        }
        set({ user: res.user, token: res.token, isAuthenticated: true, isInitialized: true, isLoading: false });
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
        if (res.refreshToken) {
          localStorage.setItem('vedha_refresh_token', res.refreshToken);
        }
        localStorage.removeItem('resumate_token');
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'VEDHA_AUTH_TOKEN_SYNC', token: res.token, user: res.user }, '*');
        }
        set({ user: res.user, token: res.token, isAuthenticated: true, isInitialized: true, isLoading: false });
      } catch (e) {
        set({ isLoading: false });
        throw e;
      }
    },

    logout: () => {
      const refreshToken = localStorage.getItem('vedha_refresh_token');
      if (refreshToken) {
        authApi.revokeToken(refreshToken).catch(() => {});
      }
      localStorage.removeItem('vedha_token');
      localStorage.removeItem('vedha_refresh_token');
      localStorage.removeItem('resumate_token');
      if (typeof window !== 'undefined') {
        window.postMessage({ type: 'VEDHA_AUTH_TOKEN_CLEAR' }, '*');
      }
      set({ user: null, token: null, isAuthenticated: false, isInitialized: true, isLoading: false });
    },

    fetchMe: async () => {
      try {
        const user = await authApi.getCurrentUser();
        const currentToken = localStorage.getItem('vedha_token');
        if (typeof window !== 'undefined' && currentToken) {
          window.postMessage({ type: 'VEDHA_AUTH_TOKEN_SYNC', token: currentToken, user }, '*');
        }
        set({ user, isAuthenticated: true, isInitialized: true });
      } catch {
        localStorage.removeItem('vedha_token');
        localStorage.removeItem('vedha_refresh_token');
        localStorage.removeItem('resumate_token');
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'VEDHA_AUTH_TOKEN_CLEAR' }, '*');
        }
        set({ user: null, token: null, isAuthenticated: false, isInitialized: true });
      }
    },

    updateKeys: async (data) => {
      await authApi.updateKeys(data);
      const user = await authApi.getCurrentUser();
      set({ user });
    },
  };
});

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
