import React from 'react';
import { 
  FileText, 
  Sparkles, 
  Columns, 
  Kanban, 
  History, 
  BarChart3, 
  Settings, 
  Sliders, 
  LogOut, 
  Sun, 
  Moon, 
  Layers,
  ChevronRight,
  UserCheck,
  Bot
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '../../stores/useAuthStore';
import { Button, LivePulse, CornerBrackets } from '../ui';

export type ActivePage = 
  | 'dashboard' 
  | 'master-resume' 
  | 'candidate-profile'
  | 'tailor-studio' 
  | 'result-studio' 
  | 'orchestrator'
  | 'tracker' 
  | 'history' 
  | 'analytics' 
  | 'prompts' 
  | 'settings';

interface AppShellProps {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ activePage, setActivePage, children }) => {
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();

  const navItems: { id: ActivePage; index: string; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', index: '01', label: 'Dashboard', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'master-resume', index: '02', label: 'Master Resume', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'candidate-profile', index: '03', label: 'Candidate Memory', icon: <UserCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> },
    { id: 'tailor-studio', index: '04', label: 'Resume Studio', icon: <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" /> },
    { id: 'result-studio', index: '05', label: 'Inspection Studio', icon: <Columns className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> },
    { id: 'orchestrator', index: '06', label: 'Copilot Pipelines', icon: <Bot className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />, badge: 'Active' },
    { id: 'tracker', index: '07', label: 'Job Tracker', icon: <Kanban className="w-3.5 h-3.5" /> },
    { id: 'history', index: '08', label: 'Resume History', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'analytics', index: '09', label: 'Analytics & ATS', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'prompts', index: '10', label: 'Prompt Studio', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'settings', index: '11', label: 'System Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  const currentNav = navItems.find((n) => n.id === activePage);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#050508] dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200/90 bg-white/70 dark:border-white/[0.08] dark:bg-zinc-950/60 flex flex-col justify-between p-4 shrink-0 backdrop-blur-2xl">
        <div className="space-y-6">
          {/* Logo & Studio Header */}
          <div className="relative px-2 py-3 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-zinc-900/30">
            <CornerBrackets size="w-1.5 h-1.5" />
            <div className="flex items-center gap-3">
              <img 
                src="/vedha-logo.png" 
                alt="Vedha AI" 
                className="h-9 w-9 rounded-xl object-contain bg-white dark:bg-zinc-950 p-1 border border-indigo-500/30 shadow-md shadow-indigo-500/10" 
              />
              <div className="overflow-hidden">
                <div className="font-bold text-xs tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 uppercase font-mono">
                  <span>Vedha</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/30">
                    OS
                  </span>
                </div>
                <div className="text-[9px] font-mono tracking-wider uppercase text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                  EDITION 2026 // PRO
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="px-2 pb-1.5 text-[9px] font-mono tracking-wider uppercase text-slate-400 dark:text-zinc-600">
              NAVIGATION // CORE
            </div>
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 select-none ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-sm dark:bg-white/[0.08] dark:text-white dark:border dark:border-white/[0.14]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-[10px] font-mono tracking-wider ${isActive ? 'text-indigo-400 dark:text-indigo-300 font-semibold' : 'text-slate-400 dark:text-zinc-600 group-hover:text-slate-500 dark:group-hover:text-zinc-400'}`}>
                      {item.index}
                    </span>
                    <div className="shrink-0">{item.icon}</div>
                    <span className="truncate tracking-tight">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                      {item.badge}
                    </span>
                  )}
                  {isActive && !item.badge && (
                    <ChevronRight className="w-3 h-3 text-slate-400 dark:text-zinc-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Controls */}
        <div className="border-t border-slate-200/90 dark:border-white/[0.08] pt-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/[0.1] flex items-center justify-center font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{user?.fullName || 'User'}</div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 truncate">{user?.email || 'user@vedha.ai'}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex-1 text-[11px] h-8 justify-center gap-1.5 rounded-lg"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-[11px] h-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-slate-300 dark:border-white/[0.1] rounded-lg"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 dark:bg-[#050508]">
        <header className="h-14 border-b border-slate-200/90 dark:border-white/[0.08] px-6 flex items-center justify-between shrink-0 bg-white/70 dark:bg-[#050508]/80 backdrop-blur-2xl sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono tracking-widest uppercase text-slate-400 dark:text-zinc-500 flex items-center gap-2">
              <span>WORKSPACE</span>
              <span className="opacity-40">/</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{currentNav?.label || 'DASHBOARD'}</span>
              <span className="text-slate-400 dark:text-zinc-600">[{currentNav?.index || '01'}]</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LivePulse active={true} label="ENGINE // LIVE" />
            <div className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-100/90 dark:bg-zinc-950/80 border border-slate-200 dark:border-white/[0.08] px-3 py-1 rounded-full flex items-center gap-2 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono text-[11px]">
                <strong className="text-slate-800 dark:text-zinc-200">{user?.preferredModel || 'gemini-flash-lite-latest'}</strong>
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
