import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';

export const LoginPage: React.FC<{ onSwitchToRegister: () => void }> = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('demo@resumate.ai');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const { login, isLoading } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-zinc-950 font-sans">
      <Card className="w-full max-w-md p-8 space-y-6 border-zinc-800 bg-zinc-900/80 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Sign In to ResuMate AI</h2>
          <p className="text-xs text-zinc-400">ATS Resume Optimization & Application Studio</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-zinc-950"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-zinc-950"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="w-full font-bold">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            <span>Sign In</span>
          </Button>
        </form>

        <div className="text-center text-xs text-zinc-500 pt-2 border-t border-zinc-800">
          Don't have an account?{' '}
          <button onClick={onSwitchToRegister} className="text-indigo-400 font-semibold hover:underline">
            Sign up
          </button>
        </div>
      </Card>
    </div>
  );
};

export const RegisterPage: React.FC<{ onSwitchToLogin: () => void }> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { register, isLoading } = useAuthStore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password, fullName);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center p-4 bg-zinc-950 font-sans">
      <Card className="w-full max-w-md p-8 space-y-6 border-zinc-800 bg-zinc-900/80 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Create an Account</h2>
          <p className="text-xs text-zinc-400">Start tailoring your resume for ATS with AI</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Morgan"
              required
              className="bg-zinc-950"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              required
              className="bg-zinc-950"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-300">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
              className="bg-zinc-950"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={isLoading} className="w-full font-bold">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            <span>Create Free Account</span>
          </Button>
        </form>

        <div className="text-center text-xs text-zinc-500 pt-2 border-t border-zinc-800">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-indigo-400 font-semibold hover:underline">
            Sign in
          </button>
        </div>
      </Card>
    </div>
  );
};
