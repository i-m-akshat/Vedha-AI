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
    <div className="bg-[#09090b] min-h-screen text-[#ededed] font-sans antialiased selection:bg-zinc-800 selection:text-white">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="h-14 w-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left Brand */}
          <div className="flex items-center gap-5">
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

            <div className="hidden xl:flex items-center gap-2 rounded-full border border-white/[0.07] bg-zinc-900/60 px-2.5 py-0.5 text-[11px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Applications Active</span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/70 p-1 rounded-xl border border-white/[0.06] text-xs">
            {mainTabs.map((tab) => {
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePage(tab.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Metrics & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center rounded-xl border border-white/[0.06] bg-zinc-900/60 px-3 py-1 text-xs gap-3 text-zinc-400 font-mono">
              <div>
                <span className="text-zinc-500">Applied: </span>
                <strong className="text-zinc-100 font-semibold">412</strong>
              </div>
              <div className="w-px h-2.5 bg-zinc-800"></div>
              <div>
                <span className="text-zinc-500">Match: </span>
                <strong className="text-emerald-400 font-semibold">95%</strong>
              </div>
            </div>

            <button
              onClick={() => setActivePage('tailor-studio')}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tailor Job</span>
            </button>

            {/* Theme Toggler */}
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-white/[0.07] bg-zinc-900/60 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors cursor-pointer"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-zinc-300" />}
            </button>

            <button
              onClick={() => setNotificationActive(!notificationActive)}
              className="rounded-lg border border-white/[0.07] bg-zinc-900/60 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              {notificationActive && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
            </button>

            {/* Profile Menu Trigger */}
            <div 
              onClick={() => setActivePage('settings')}
              className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/[0.1] hover:border-zinc-400 cursor-pointer flex items-center justify-center text-xs font-semibold text-zinc-200 transition-colors"
              title={user?.email || 'User Profile'}
            >
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      {/* Left Sidebar Navigation */}
      <aside className="fixed left-0 top-14 bottom-0 w-56 bg-[#0c0d10] border-r border-white/[0.06] z-40 flex flex-col justify-between py-3 text-xs overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <div className="px-4 py-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">
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
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800/90 text-white font-semibold border border-white/[0.08] shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider ${
                      isActive ? 'bg-white/10 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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
        <div className="px-2.5 flex flex-col gap-2">
          <div className="p-2.5 rounded-xl bg-zinc-900/50 border border-white/[0.06] flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>System</span>
              </span>
              <span className="text-zinc-200 font-medium font-mono text-[10px]">Optimal</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Engine</span>
              <span className="text-zinc-300 font-mono">MAF Harness</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full rounded-lg border border-white/[0.06] hover:border-rose-500/30 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-300 py-1.5 px-2.5 flex items-center justify-center gap-2 text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-56">
        <main className="relative w-full pt-14 bg-[#09090b] min-h-screen minimal-grid">
          <div className="flex flex-col w-full p-6 sm:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
