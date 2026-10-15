import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Sparkles, 
  Send, 
  Code, 
  UserCheck, 
  Sliders, 
  BarChart3, 
  Kanban, 
  History, 
  Settings, 
  LogOut, 
  Bell, 
  Plus, 
  CheckCircle2,
  Sun,
  Moon,
  Bot
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '../../stores/useAuthStore';

export type ActivePage = 
  | 'dashboard' 
  | 'master-resume' 
  | 'candidate-profile'
  | 'tailor-studio' 
  | 'result-studio' 
  | 'orchestrator'
  | 'ask-aksh'
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
  const [notificationActive, setNotificationActive] = useState(true);

  const mainTabs: { id: ActivePage; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tailor-studio', label: 'Tailor Resume' },
    { id: 'result-studio', label: 'Resume Preview' },
    { id: 'orchestrator', label: 'Auto-Apply' },
    { id: 'tracker', label: 'Job Tracker' },
  ];

  const sideNavItems: { id: ActivePage; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'tailor-studio', label: 'Tailor Resume', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'result-studio', label: 'Resume Preview', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'orchestrator', label: 'Auto-Apply Queue', icon: <Send className="w-3.5 h-3.5" />, badge: 'Active' },
    { id: 'ask-aksh', label: 'Ask Aksh', icon: <Bot className="w-3.5 h-3.5" />, badge: 'Copilot' },
    { id: 'tracker', label: 'Job Tracker', icon: <Kanban className="w-3.5 h-3.5" /> },
    { id: 'master-resume', label: 'Master Resume', icon: <Code className="w-3.5 h-3.5" /> },
    { id: 'candidate-profile', label: 'Candidate Profile', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'Version History', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'prompts', label: 'AI Prompts', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="bg-[#FAF8F5] dark:bg-[#0D0C13] min-h-screen text-zinc-900 dark:text-[#EDEDED] font-sans antialiased selection:bg-zinc-800 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950 transition-colors duration-200">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/85 dark:bg-[#12111A]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] transition-colors duration-200">
        <div className="h-14 w-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left Brand */}
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center cursor-pointer select-none py-1 transition-opacity hover:opacity-85"
              onClick={() => setActivePage('dashboard')}
            >
              {isDark ? (
                <img 
                  src="/VedhaAI-Dark.png" 
                  alt="Vedha AI" 
                  className="h-7 w-auto max-w-[130px] object-contain" 
                />
              ) : (
                <img 
                  src="/vedha-logo.png" 
                  alt="Vedha AI" 
                  className="h-8 w-auto max-w-[105px] object-contain" 
                />
              )}
            </div>

            <div className="hidden xl:flex items-center gap-2 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.03] dark:bg-zinc-900/60 px-3 py-1 text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Applications Active</span>
            </div>
          </div>

          {/* Center Navigation Tabs (Pill style from Reference 1 & 3) */}
          <nav className="hidden lg:flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-full border border-black/[0.05] dark:border-white/[0.08] text-xs backdrop-blur-md">
            {mainTabs.map((tab) => {
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePage(tab.id)}
                  className={`px-3.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-white text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Metrics & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center rounded-full border border-black/[0.06] dark:border-white/[0.07] bg-white/70 dark:bg-zinc-900/60 px-3 py-1 text-xs gap-3 text-zinc-600 dark:text-zinc-400 font-mono shadow-sm">
              <div>
                <span className="text-zinc-400 dark:text-zinc-500">Applied: </span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">412</strong>
              </div>
              <div className="w-px h-2.5 bg-zinc-200 dark:bg-zinc-800"></div>
              <div>
                <span className="text-zinc-400 dark:text-zinc-500">Match: </span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">95%</strong>
              </div>
            </div>

            <button
              onClick={() => setActivePage('tailor-studio')}
              className="px-4 py-1.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tailor Job</span>
            </button>

            {/* Theme Toggler */}
            <button
              onClick={toggleTheme}
              className="rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-zinc-900/60 p-2 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-zinc-800/70 transition-all cursor-pointer shadow-sm active:scale-95"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-700" />}
            </button>

            <button
              onClick={() => setNotificationActive(!notificationActive)}
              className="rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-zinc-900/60 p-2 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-zinc-800/70 transition-all relative cursor-pointer shadow-sm active:scale-95"
              title="Notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              {notificationActive && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
            </button>

            {/* Profile Menu Trigger */}
            <div 
              onClick={() => setActivePage('settings')}
              className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white border border-black/[0.08] dark:border-white/[0.12] hover:opacity-90 cursor-pointer flex items-center justify-center text-xs font-semibold transition-transform active:scale-95 shadow-sm"
              title={user?.email || 'User Profile'}
            >
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      {/* Left Sidebar Navigation (Autumn App & Flowbase hybrid rail) */}
      <aside className="fixed left-0 top-14 bottom-0 w-56 bg-[#FAF7F2] dark:bg-[#100F17] border-r border-black/[0.05] dark:border-white/[0.07] z-40 flex flex-col justify-between py-3.5 text-xs overflow-y-auto transition-colors duration-200">
        <div className="flex flex-col gap-1.5">
          <div className="px-4 py-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500 block">
              Platform
            </span>
          </div>

          <nav className="flex flex-col px-2.5 gap-0.5">
            {sideNavItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-white/10 dark:text-white font-semibold dark:border dark:border-white/[0.12] shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                      isActive 
                        ? 'bg-white/20 text-white dark:bg-white/15' 
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Health Status & Logout */}
        <div className="px-3 flex flex-col gap-2">
          <div className="p-3 rounded-2xl bg-white/80 dark:bg-zinc-900/50 border border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-1.5 text-xs shadow-sm">
            <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                <span>System</span>
              </span>
              <span className="text-zinc-900 dark:text-zinc-200 font-medium font-mono text-[10px]">Optimal</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
              <span>Engine</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-mono">MAF Harness</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-zinc-900/40 hover:border-rose-500/30 hover:bg-rose-500/10 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-300 py-2 px-3 flex items-center justify-center gap-2 text-xs font-medium transition-all cursor-pointer shadow-sm"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-56">
        <main className="relative w-full pt-14 bg-[#FAF8F5] dark:bg-[#0D0C13] min-h-screen minimal-grid transition-colors duration-200">
          <div className="flex flex-col w-full p-6 sm:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
