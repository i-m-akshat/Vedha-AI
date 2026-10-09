import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/useAuthStore';
import { AppShell, ActivePage } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { MasterResumePage } from './pages/MasterResumePage';
import { TailorStudioPage } from './pages/TailorStudioPage';
import { ResultStudioPage } from './pages/ResultStudioPage';
import { TrackerPage } from './pages/TrackerPage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PromptsPage } from './pages/PromptsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CandidateProfilePage } from './pages/CandidateProfilePage';
import { OrchestratorQueuePage } from './pages/OrchestratorQueuePage';
import { Loader2 } from 'lucide-react';
import { LoginPage, RegisterPage } from './pages/AuthPages';

const queryClient = new QueryClient();

export const AppContent: React.FC = () => {
  const { isAuthenticated, isInitialized, fetchMe } = useAuthStore();
  const [activePage, setActivePage] = useState<ActivePage>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, [isAuthenticated]);

  if (isAuthenticated && !isInitialized) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-[#090a0f] font-sans text-[#e2e4e9] antialiased">
        <div className="border border-[#1e2029] bg-[#111218] p-8 rounded-2xl max-w-sm w-full flex flex-col items-center gap-4 text-center shadow-xl">
          <img src="/vedha-logo.png" alt="Vedha AI" className="w-12 h-12 rounded-xl object-contain shadow-lg" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white tracking-tight">Vedha AI</h3>
            <div className="flex items-center justify-center gap-2 text-xs text-[#8e929b]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Loading workspace...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage setActivePage={setActivePage} />;
      case 'master-resume':
        return <MasterResumePage />;
      case 'candidate-profile':
        return <CandidateProfilePage />;
      case 'tailor-studio':
        return <TailorStudioPage setActivePage={setActivePage} />;
      case 'result-studio':
        return <ResultStudioPage setActivePage={setActivePage} />;
      case 'orchestrator':
        return <OrchestratorQueuePage setActivePage={setActivePage} />;
      case 'tracker':
        return <TrackerPage />;
      case 'history':
        return <HistoryPage setActivePage={setActivePage} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'prompts':
        return <PromptsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage setActivePage={setActivePage} />;
    }
  };

  return (
    <AppShell activePage={activePage} setActivePage={setActivePage}>
      {renderPage()}
    </AppShell>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
