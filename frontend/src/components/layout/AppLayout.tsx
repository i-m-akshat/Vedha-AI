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
  Moon
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '../../stores/useAuthStore';

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
  const [notificationActive, setNotificationActive] = useState(true);

  const mainTabs: { id: ActivePage; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tailor-studio', label: 'Tailor Resume' },
    { id: 'result-studio', label: 'Resume Preview' },
    { id: 'orchestrator', label: 'Auto-Apply' },
    { id: 'tracker', label: 'Job Tracker' },
  ];

  const sideNavItems: { id: ActivePage; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'tailor-studio', label: 'Tailor Resume', icon: <FileText className="w-4 h-4" /> },
    { id: 'result-studio', label: 'Resume Preview', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'orchestrator', label: 'Auto-Apply Queue', icon: <Send className="w-4 h-4" />, badge: 'Active' },
    { id: 'tracker', label: 'Job Tracker', icon: <Kanban className="w-4 h-4" /> },
    { id: 'master-resume', label: 'Master Resume', icon: <Code className="w-4 h-4" /> },
    { id: 'candidate-profile', label: 'Candidate Profile', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'history', label: 'Version History', icon: <History className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'prompts', label: 'AI Prompts', icon: <Sliders className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="bg-[#0b0c0e] min-h-screen text-[#e2e4e9] font-sans antialiased">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#111216]/95 backdrop-blur-md border-b border-[#23252b]">
        <div className="h-16 w-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left Brand - Single Theme Logo (No Title Text) */}
          <div className="flex items-center gap-6">
            <div 
              className="flex items-center cursor-pointer select-none py-1"
              onClick={() => setActivePage('dashboard')}
            >
              {isDark ? (
                <img 
                  src="/VedhaAI-Dark.png" 
                  alt="Vedha AI" 
                  className="h-8 max-h-8 w-auto max-w-[140px] object-contain transition-all" 
                />
              ) : (
                <img 
                  src="/vedha-logo.png" 
                  alt="Vedha AI" 
                  className="h-9 max-h-9 w-auto max-w-[110px] object-contain transition-all" 
                />
              )}
            </div>

            <div className="hidden xl:flex items-center gap-2 rounded-full border border-[#2b2d35] bg-[#16181e] px-3 py-1 text-xs text-[#a0a4b0]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>3 Applications in Progress</span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#16181e] p-1 rounded-xl border border-[#23252b] text-xs">
            {mainTabs.map((tab) => {
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePage(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                    isActive
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-[#8e929b] hover:text-white hover:bg-[#20222a]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Metrics & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center rounded-xl border border-[#23252b] bg-[#16181e] px-3.5 py-1.5 text-xs gap-3.5 text-[#a0a4b0]">
              <div>
                <span className="text-[#6c707d]">Applied: </span>
                <strong className="text-white font-semibold">412</strong>
              </div>
              <div className="w-px h-3 bg-[#2a2d36]"></div>
              <div>
                <span className="text-[#6c707d]">Avg Match: </span>
                <strong className="text-emerald-400 font-semibold">95%</strong>
              </div>
            </div>

            <button
              onClick={() => setActivePage('tailor-studio')}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tailor New Job</span>
            </button>

            {/* Theme Toggler */}
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-[#23252b] bg-[#16181e] p-2 text-[#8e929b] hover:text-white hover:border-[#333742] transition-colors"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>

            <button
              onClick={() => setNotificationActive(!notificationActive)}
              className="rounded-lg border border-[#23252b] bg-[#16181e] p-2 text-[#8e929b] hover:text-white hover:border-[#333742] transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notificationActive && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
            </button>

            {/* Profile Menu Trigger */}
            <div 
              onClick={() => setActivePage('settings')}
              className="w-8 h-8 rounded-lg bg-[#20222a] border border-[#2e313c] hover:border-indigo-400 cursor-pointer flex items-center justify-center text-xs font-bold text-white transition-colors"
              title={user?.email || 'User Profile'}
            >
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      {/* Left Sidebar Navigation */}
      <aside className="fixed left-0 top-16 bottom-0 w-60 bg-[#111216] border-r border-[#23252b] z-40 flex flex-col justify-between py-4 text-xs overflow-y-auto">
        <div className="flex flex-col gap-2">
          <div className="px-5 py-2">
            <span className="text-[11px] font-semibold text-[#6c707d] uppercase tracking-wider block">
              Menu
            </span>
          </div>

          <nav className="flex flex-col px-3 gap-1">
            {sideNavItems.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-[#8e929b] hover:text-white hover:bg-[#1a1c23]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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
        <div className="px-3 flex flex-col gap-3">
          <div className="p-3 rounded-xl bg-[#16181e] border border-[#23252b] flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between text-[#8e929b]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>System Status</span>
              </span>
              <span className="text-white font-medium">Healthy</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#6c707d]">
              <span>Latency</span>
              <span className="text-white font-mono">14ms</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full rounded-lg border border-[#23252b] hover:border-rose-500/40 hover:bg-rose-500/10 text-[#8e929b] hover:text-rose-300 py-2 px-3 flex items-center justify-center gap-2 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-60">
        <main className="relative w-full pt-16 bg-[#0b0c0e] min-h-screen">
          <div className="flex flex-col w-full p-6 sm:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
