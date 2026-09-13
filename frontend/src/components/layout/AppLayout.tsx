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
import { Button } from '../ui';

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

  const navItems: { id: ActivePage; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Layers className="w-4 h-4" /> },
    { id: 'master-resume', label: 'Master Resume', icon: <FileText className="w-4 h-4" /> },
    { id: 'candidate-profile', label: 'Candidate Profile & Memory', icon: <UserCheck className="w-4 h-4 text-emerald-400" /> },
    { id: 'tailor-studio', label: 'Generate Resume', icon: <Sparkles className="w-4 h-4 text-indigo-400" /> },
    { id: 'result-studio', label: 'Inspection Studio', icon: <Columns className="w-4 h-4 text-emerald-400" /> },
    { id: 'orchestrator', label: 'Application Copilot', icon: <Bot className="w-4 h-4 text-sky-400" />, badge: 'Pipelines' },
    { id: 'tracker', label: 'Job Tracker', icon: <Kanban className="w-4 h-4" /> },
    { id: 'history', label: 'Resume History', icon: <History className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'prompts', label: 'AI Prompts', icon: <Sliders className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white/80 dark:border-zinc-800/80 dark:bg-zinc-900/40 flex flex-col justify-between p-4 shrink-0 backdrop-blur-sm">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-slate-200 dark:border-zinc-800/60">
            <img 
              src="/vedha-logo.png" 
              alt="Vedha AI" 
              className="h-10 w-10 rounded-xl object-contain bg-white dark:bg-zinc-950 p-1 border border-indigo-500/30 shadow-md shadow-indigo-500/20" 
            />
            <div>
              <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Vedha <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/30">AI</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">The AI Career Operating System</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-600/15 dark:text-indigo-400 dark:border-indigo-500/30 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Controls */}
        <div className="border-t border-slate-200 dark:border-zinc-800/80 pt-4 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 shrink-0">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{user?.fullName || 'User'}</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500 truncate">{user?.email || 'user@vedha.ai'}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="flex-1 text-[11px] h-8 justify-center gap-1.5"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="text-[11px] h-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-slate-300 dark:border-zinc-800"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 dark:bg-zinc-950">
        <header className="h-14 border-b border-slate-200 dark:border-zinc-800/80 px-6 flex items-center justify-between shrink-0 bg-white/80 dark:bg-zinc-900/20 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {{
                'dashboard': 'Dashboard',
                'master-resume': 'Master Resume Center',
                'candidate-profile': 'Candidate Profile & Memory',
                'tailor-studio': 'Resume Tailor Studio',
                'result-studio': 'Inspection Studio',
                'orchestrator': 'Application Copilot',
                'tracker': 'Job Tracker',
                'history': 'Resume History',
                'analytics': 'Analytics',
                'prompts': 'AI Prompts',
                'settings': 'Settings',
              }[activePage] ?? activePage}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Model: <strong className="text-slate-800 dark:text-zinc-200">{user?.preferredModel || 'gemini-2.0-flash'}</strong></span>
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
