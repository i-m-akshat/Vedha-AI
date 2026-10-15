import React, { useState } from 'react';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Sun, 
  Moon,
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '../stores/useAuthStore';
import { 
  AutumnHeroVector, 
  AutumnTreeLeavesVector, 
  AutumnUmbrellaVector, 
  AutumnWalkingStepsVector 
} from '../components/icons/AutumnVectors';

export const extractErrorMessage = (err: any, fallback: string): string => {
  if (!err) return fallback;
  const data = err.response?.data;
  if (!data) return err.message || fallback;

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }

  if (data.errors && typeof data.errors === 'object') {
    const messages: string[] = [];
    for (const key of Object.keys(data.errors)) {
      const val = data.errors[key];
      if (Array.isArray(val)) {
        messages.push(...val);
      } else if (typeof val === 'string') {
        messages.push(val);
      }
    }
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }

  if (typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail.trim();
  }

  if (typeof data.title === 'string' && data.title.trim()) {
    return data.title.trim();
  }

  return fallback;
};

interface AuthPageProps {
  initialMode?: 'signin' | 'signup';
  onSwitchToRegister?: () => void;
  onSwitchToLogin?: () => void;
}

export const AuthGatewayPage: React.FC<AuthPageProps> = ({
  initialMode = 'signin',
  onSwitchToRegister,
  onSwitchToLogin,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('demo@vedha.ai');
  const [password, setPassword] = useState('Password123!');
  const [fullName, setFullName] = useState('Alex Morgan');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { login, register, isLoading } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();

  const handleSwitchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError(null);
    if (newMode === 'signin' && onSwitchToLogin) onSwitchToLogin();
    if (newMode === 'signup' && onSwitchToRegister) onSwitchToRegister();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'signin') {
        await login(email, password);
      } else {
        await register(email, password, fullName);
      }
    } catch (err: any) {
      setError(
        extractErrorMessage(
          err,
          mode === 'signin' ? 'Incorrect email or password. Please try again.' : 'Registration failed. Please verify your details.'
        )
      );
    }
  };

  const handleLoadDemo = () => {
    setEmail('demo@vedha.ai');
    setPassword('Password123!');
    setFullName('Alex Morgan');
    setError(null);
  };

  return (
    <div className="bg-[#FAF8F5] dark:bg-[#0D0C13] font-sans text-zinc-900 dark:text-[#ededed] antialiased flex items-center justify-center min-h-screen relative p-4 md:p-8 transition-colors duration-200 selection:bg-zinc-800 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950">
      
      {/* Background Soft Glow Aura */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D9704F]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#5B9279]/10 rounded-full blur-3xl" />
      </div>

      <main className="w-full max-w-5xl relative z-10 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-[36px] border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#16151F] shadow-2xl overflow-hidden transition-all duration-200">
          
          {/* LEFT COLUMN: Creative Autumn Showcase */}
          <section className="lg:col-span-7 flex flex-col justify-between p-8 md:p-10 lg:p-12 bg-[#FDF7F2] dark:bg-[#13121B] border-b lg:border-b-0 lg:border-r border-black/[0.06] dark:border-white/[0.08] transition-colors duration-200">
            <div className="flex flex-col gap-6">
              
              {/* Top Brand Header + Theme Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img 
                    src="/assets/vedha-terracotta-leaf-emblem.png" 
                    alt="Vedha AI" 
                    className="w-10 h-10 object-contain shadow-sm" 
                  />
                  <div className="flex flex-col">
                    <span className="font-bold tracking-tight text-xl text-zinc-900 dark:text-white font-sans leading-none">
                      Vedha<span className="text-[#D9704F]">.ai</span>
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mt-1">
                      Career Operating System
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-full border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-zinc-800 p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all shadow-sm cursor-pointer active:scale-95"
                  title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  aria-label="Toggle theme"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#D9704F]" />}
                </button>
              </div>

              {/* Creative Headline */}
              <div className="space-y-3 pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDF2EE] dark:bg-[#2A1B16] border border-[#FAD9CE] dark:border-[#542B20] text-xs font-semibold text-[#D9704F] dark:text-[#F39A7E] font-mono uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Autumn Career Sprint 2026</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-tight">
                  Land your dream job <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D9704F] via-[#EFA84B] to-[#5B9279]">
                    with AI precision.
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-md leading-relaxed">
                  Calibrate your master resume to any job opening in seconds, beat ATS recruiter filters with Google XYZ bullets, and auto-dispatch applications safely.
                </p>
              </div>

              {/* Autumn Scenic Vector Card */}
              <div className="rounded-[28px] overflow-hidden border border-black/[0.06] dark:border-white/[0.08] bg-[#FDF4ED] dark:bg-[#181622] shadow-sm my-1">
                <AutumnHeroVector className="w-full h-36 object-cover" />
                <div className="bg-[#D9704F] px-4 py-2 text-white flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Active Candidate Dispatch Engine</span>
                  </span>
                  <span className="text-[10px] font-mono text-white/80">100% HITL Safety</span>
                </div>
              </div>

              {/* 3 Pastel Feature Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#DCEEE5] dark:bg-[#1E362D] border border-[#C5E4D5] dark:border-[#2C5244] space-y-1 shadow-sm">
                  <div className="font-bold text-[#23503D] dark:text-[#A8DEC6] flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    <span>95%+ ATS Score</span>
                  </div>
                  <div className="text-[#2E634D] dark:text-[#7EBFA5] text-[11px] leading-snug">
                    Google XYZ bullets calibrated to the target JD
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FCE1D4] dark:bg-[#3D261D] border border-[#F9CCA8] dark:border-[#5B392B] space-y-1 shadow-sm">
                  <div className="font-bold text-[#8C3C24] dark:text-[#F8BCA7] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Auto-Dispatch</span>
                  </div>
                  <div className="text-[#A64B2F] dark:text-[#D98A72] text-[11px] leading-snug">
                    Prefills and submits applications effortlessly
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#E1F3F0] dark:bg-[#1B3633] border border-[#C7EAE3] dark:border-[#29514D] space-y-1 shadow-sm">
                  <div className="font-bold text-[#20544B] dark:text-[#A7E2D8] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Zero Hallucination</span>
                  </div>
                  <div className="text-[#2D6E62] dark:text-[#7EC4B8] text-[11px] leading-snug">
                    Truth-grounded strictly in your Master Resume
                  </div>
                </div>
              </div>

            </div>

            {/* Metrics Footer */}
            <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <div>
                <span className="text-zinc-900 dark:text-white font-bold text-base block font-mono">14,000+</span>
                <span>Applications Calibrated</span>
              </div>
              <div className="text-right">
                <span className="text-[#D9704F] dark:text-[#F39A7E] font-bold text-base block font-mono">4.2x Higher</span>
                <span>Interview Callback Rate</span>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Creative Autumn Authentication Form */}
          <section className="lg:col-span-5 flex flex-col justify-between p-8 md:p-10 bg-white dark:bg-[#16151F] transition-colors duration-200">
            <div className="flex flex-col gap-5">
              
              {/* Tab Switcher */}
              <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-4">
                <div className="flex bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-full border border-black/[0.05] dark:border-white/[0.08] text-xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className={`px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                      mode === 'signin' ? 'bg-[#D9704F] text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signup')}
                    className={`px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                      mode === 'signup' ? 'bg-[#D9704F] text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Instant Demo Fill Button */}
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="text-xs text-[#D9704F] hover:text-[#C85F3E] font-semibold hover:underline cursor-pointer"
                >
                  Fill Demo
                </button>
              </div>

              {/* Form Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                  {mode === 'signin' ? 'Welcome Back' : 'Create Free Account'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {mode === 'signin'
                    ? 'Enter your credentials to access your tailored resumes and application tracker.'
                    : 'Launch your tailored career workspace in less than 30 seconds.'}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}

              {/* Demo Account Quick Callout Button */}
              <button
                type="button"
                onClick={handleLoadDemo}
                className="w-full py-2.5 px-3 rounded-2xl border border-[#FAD9CE] dark:border-[#542B20] bg-[#FDF2EE] dark:bg-[#2A1B16] hover:bg-[#FBE8E0] dark:hover:bg-[#38221B] text-[#D9704F] dark:text-[#F39A7E] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-[#D9704F] dark:text-[#F39A7E]" />
                <span>One-Click Demo Account (Alex Morgan)</span>
              </button>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                      Full Name
                    </label>
                    <input
                      className="w-full rounded-2xl bg-[#FAF7F2] dark:bg-zinc-800/60 border border-black/[0.06] dark:border-white/[0.08] focus:border-[#D9704F] dark:focus:border-[#D9704F] focus:ring-2 focus:ring-[#D9704F]/20 py-2.5 px-4 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all shadow-inner"
                      placeholder="e.g. Alex Morgan"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      type="text"
                    />
                  </div>
                )}

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
                    Email Address
                  </label>
                  <input
                    className="w-full rounded-2xl bg-[#FAF7F2] dark:bg-zinc-800/60 border border-black/[0.06] dark:border-white/[0.08] focus:border-[#D9704F] dark:focus:border-[#D9704F] focus:ring-2 focus:ring-[#D9704F]/20 py-2.5 px-4 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all shadow-inner"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Minimum 8 characters</span>
                    )}
                  </div>
                  <input
                    className="w-full rounded-2xl bg-[#FAF7F2] dark:bg-zinc-800/60 border border-black/[0.06] dark:border-white/[0.08] focus:border-[#D9704F] dark:focus:border-[#D9704F] focus:ring-2 focus:ring-[#D9704F]/20 py-2.5 px-4 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all shadow-inner"
                    placeholder="••••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type="password"
                  />
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-zinc-600 dark:text-zinc-400">
                    <input
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded-lg bg-[#FAF7F2] dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-[#D9704F] focus:ring-0 accent-[#D9704F] cursor-pointer"
                      type="checkbox"
                    />
                    <span>Remember me on this device</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full rounded-2xl bg-[#D9704F] hover:bg-[#C85F3E] text-white font-bold text-xs py-3 px-4 shadow-md shadow-[#D9704F]/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{mode === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'signin' ? 'Sign In' : 'Create Free Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Toggle Prompt */}
              <div className="text-center pt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {mode === 'signin' ? (
                  <span>
                    Don&apos;t have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signup')}
                      className="text-[#D9704F] hover:text-[#C85F3E] font-semibold hover:underline cursor-pointer"
                    >
                      Sign up free
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signin')}
                      className="text-[#D9704F] hover:text-[#C85F3E] font-semibold hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-6 pt-4 border-t border-black/[0.05] dark:border-white/[0.06] text-center text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
              Protected with 256-bit SSL encryption &amp; private credential storage.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export const LoginPage: React.FC<{ onSwitchToRegister: () => void }> = ({ onSwitchToRegister }) => {
  return <AuthGatewayPage initialMode="signin" onSwitchToRegister={onSwitchToRegister} />;
};

export const RegisterPage: React.FC<{ onSwitchToLogin: () => void }> = ({ onSwitchToLogin }) => {
  return <AuthGatewayPage initialMode="signup" onSwitchToLogin={onSwitchToLogin} />;
};
