import React, { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Sparkles, ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuthStore, useThemeStore } from '../stores/useAuthStore';
import { VoxelMatrixCanvas } from '../components/3d/VoxelMatrixCanvas';

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
    <div className="bg-[#0b0c0e] font-sans text-[#e2e4e9] antialiased flex items-center justify-center min-h-screen relative p-4 md:p-8">
      {/* Background Pixel Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none pixel-grid z-0 opacity-25"></div>

      <main className="w-full max-w-6xl relative z-10 my-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#23252b] bg-[#111216] shadow-2xl overflow-hidden">
          
          {/* LEFT COLUMN: Clean Value Proposition & Visual */}
          <section className="lg:col-span-7 flex flex-col justify-between p-8 md:p-10 lg:p-12 bg-gradient-to-br from-[#12141a] via-[#0f1015] to-[#0b0c0e] border-b lg:border-b-0 lg:border-r border-[#23252b]">
            <div className="flex flex-col gap-6">
              {/* Top Brand Logo Only (No text, responsive theme sizing) + Theme Toggle */}
              <div className="flex items-center justify-between">
                <div>
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

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-lg border border-[#23252b] bg-[#16181e] p-2 text-[#8e929b] hover:text-white hover:border-[#333742] transition-colors"
                  title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  aria-label="Toggle theme"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
                </button>
              </div>

              {/* Headline */}
              <div className="space-y-3 pt-2">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  Land your dream job <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">
                    with AI-powered speed.
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-[#9fa3b0] max-w-lg leading-relaxed">
                  Tailor your resume in seconds, beat ATS applicant tracking systems, and apply to top companies effortlessly.
                </p>
              </div>

              {/* Interactive 3D Canvas Box */}
              <div className="rounded-xl border border-[#23252b] bg-[#16181f]/80 overflow-hidden shadow-inner my-2">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[#23252b] bg-[#14151b] text-xs text-[#8e929b]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Interactive 3D Career Matrix
                  </span>
                  <span className="text-[11px]">Hover or drag to explore</span>
                </div>
                <div className="w-full h-56 flex items-center justify-center relative">
                  <VoxelMatrixCanvas className="w-full h-full" />
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-[#16181f] border border-[#23252b] space-y-1">
                  <div className="font-semibold text-white">95%+ ATS Score</div>
                  <div className="text-[#8e929b] text-[11px]">Keyword-matched to every job description</div>
                </div>
                <div className="p-3 rounded-xl bg-[#16181f] border border-[#23252b] space-y-1">
                  <div className="font-semibold text-white">One-Click Apply</div>
                  <div className="text-[#8e929b] text-[11px]">Auto-fills applications across platforms</div>
                </div>
                <div className="p-3 rounded-xl bg-[#16181f] border border-[#23252b] space-y-1">
                  <div className="font-semibold text-white">Zero Guesswork</div>
                  <div className="text-[#8e929b] text-[11px]">Truth-preserved & verified content</div>
                </div>
              </div>
            </div>

            {/* Metrics Footer */}
            <div className="mt-8 pt-4 border-t border-[#23252b] flex items-center justify-between text-xs text-[#8e929b]">
              <div>
                <span className="text-white font-bold text-base block">14,000+</span>
                <span>Applications submitted</span>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-base block">4.2x higher</span>
                <span>Interview callback rate</span>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Simple, Clean Authentication Form */}
          <section className="lg:col-span-5 flex flex-col justify-between p-8 md:p-10 bg-[#111216]">
            <div className="flex flex-col gap-6">
              
              {/* Tab Switcher */}
              <div className="flex items-center justify-between border-b border-[#23252b] pb-4">
                <div className="flex bg-[#16181f] p-1 rounded-xl border border-[#23252b] text-xs">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signin')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      mode === 'signin' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-[#8e929b] hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signup')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      mode === 'signup' ? 'bg-indigo-600 text-white font-semibold shadow-sm' : 'text-[#8e929b] hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Instant Demo Fill Button */}
                <button
                  type="button"
                  onClick={handleLoadDemo}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                >
                  Fill Demo
                </button>
              </div>

              {/* Form Title */}
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {mode === 'signin' ? 'Welcome Back' : 'Create Your Free Account'}
                </h2>
                <p className="text-xs text-[#8e929b]">
                  {mode === 'signin'
                    ? 'Enter your credentials to access your tailored resumes and active applications.'
                    : 'Start optimizing your job hunt with AI in less than 30 seconds.'}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}

              {/* Demo Account Quick Callout Button */}
              <button
                type="button"
                onClick={handleLoadDemo}
                className="w-full py-2.5 px-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>One-Click Demo Account (Alex Morgan)</span>
              </button>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#c4c7d0] block">
                      Full Name
                    </label>
                    <input
                      className="w-full rounded-xl bg-[#16181f] border border-[#2a2d36] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2.5 px-3.5 text-xs text-white placeholder-[#555866] outline-none transition-colors"
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
                  <label className="text-xs font-medium text-[#c4c7d0] block">
                    Email Address
                  </label>
                  <input
                    className="w-full rounded-xl bg-[#16181f] border border-[#2a2d36] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2.5 px-3.5 text-xs text-white placeholder-[#555866] outline-none transition-colors"
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
                    <label className="text-xs font-medium text-[#c4c7d0]">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <span className="text-[11px] text-[#6c707d]">Minimum 8 characters</span>
                    )}
                  </div>
                  <input
                    className="w-full rounded-xl bg-[#16181f] border border-[#2a2d36] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 py-2.5 px-3.5 text-xs text-white placeholder-[#555866] outline-none transition-colors"
                    placeholder="••••••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    type="password"
                  />
                </div>

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#8e929b]">
                    <input
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded bg-[#16181f] border-[#2a2d36] text-indigo-600 focus:ring-0 accent-indigo-600 cursor-pointer"
                      type="checkbox"
                    />
                    <span>Remember me on this device</span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-3 px-4 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
              <div className="text-center pt-2 text-xs text-[#8e929b]">
                {mode === 'signin' ? (
                  <span>
                    Don&apos;t have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('signup')}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline"
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
                      className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline"
                    >
                      Sign in
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-8 pt-4 border-t border-[#23252b] text-center text-[11px] text-[#6c707d]">
              Protected with secure SSL encryption &amp; private credential storage.
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
