import React, { Component, ErrorInfo, ReactNode } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Sparkles 
} from 'lucide-react';
import { AutumnTreeLeavesVector } from '../icons/AutumnVectors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Vedha AI Uncaught Pipeline Exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    });
    window.location.hash = '#dashboard';
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyDiagnostic = () => {
    const { error, errorInfo } = this.state;
    const diagnosticPayload = [
      `=== VEDHA AI DIAGNOSTIC REPORT ===`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Error Name: ${error?.name}`,
      `Error Message: ${error?.message}`,
      `\n--- Stack Trace ---`,
      error?.stack || 'No stack available',
      `\n--- Component Stack ---`,
      errorInfo?.componentStack || 'No component stack available',
    ].join('\n');

    navigator.clipboard.writeText(diagnosticPayload);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, copied, showDetails } = this.state;

      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center p-6 bg-[#FAF8F5] dark:bg-[#0D0C13] font-sans text-zinc-900 dark:text-[#ededed] antialiased selection:bg-zinc-800 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950 transition-colors duration-200">
          {/* Ambient Warm Autumn Glow Aura */}
          <div className="relative flex flex-col items-center max-w-xl w-full text-center">
            <div className="absolute -inset-10 bg-gradient-to-tr from-[#D9704F]/15 via-[#EFA84B]/10 to-[#5B9279]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Creative Card Container */}
            <div className="relative z-10 w-full p-8 sm:p-10 rounded-[36px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-2xl space-y-6">
              
              {/* Top Vector Mascot & Status Badge */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-[28px] bg-[#FDF2EE] dark:bg-[#2A1B16] border border-[#FAD9CE] dark:border-[#542B20] flex items-center justify-center shadow-inner relative group">
                  <AutumnTreeLeavesVector className="w-12 h-12 transform group-hover:rotate-12 transition-transform duration-300" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D9704F] flex items-center justify-center text-white text-[9px] font-bold">
                    !
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF2EE] dark:bg-[#2A1B16] border border-[#FAD9CE] dark:border-[#542B20] text-xs font-semibold font-mono text-[#D9704F] dark:text-[#F39A7E] uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Pipeline Exception Intercepted</span>
                </div>
              </div>

              {/* Title & Human-Friendly Explanation */}
              <div className="space-y-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  A fallen leaf interrupted the pipeline
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Don&apos;t worry—your Master Resume, saved applications, and authentication tokens are completely intact. An unexpected render condition was safely contained.
                </p>
              </div>

              {/* Quick Action Recovery Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-bold transition-all shadow-md shadow-[#D9704F]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Home className="w-4 h-4" />
                  <span>Return to Career Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleReload}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Application</span>
                </button>
              </div>

              {/* Collapsible Diagnostic Details for Engineers */}
              <div className="pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => this.setState({ showDetails: !showDetails })}
                    className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors cursor-pointer"
                  >
                    <span>{showDetails ? 'Hide' : 'Inspect'} Diagnostic Details</span>
                    {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={this.handleCopyDiagnostic}
                    className="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-[#D9704F] dark:hover:text-[#F39A7E] font-medium transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Diagnostic Log</span>
                      </>
                    )}
                  </button>
                </div>

                {showDetails && (
                  <div className="mt-3 p-4 rounded-2xl bg-black/[0.03] dark:bg-black/40 border border-black/[0.05] dark:border-white/[0.06] text-left font-mono text-[11px] text-zinc-700 dark:text-zinc-300 max-h-48 overflow-y-auto space-y-2">
                    <div>
                      <strong className="text-[#D9704F] block">Message:</strong>
                      <span>{error?.message || 'Unknown render exception'}</span>
                    </div>
                    {error?.stack && (
                      <div>
                        <strong className="text-zinc-500 dark:text-zinc-400 block">Stack:</strong>
                        <pre className="whitespace-pre-wrap text-[10px] text-zinc-400 dark:text-zinc-500">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    {errorInfo?.componentStack && (
                      <div>
                        <strong className="text-zinc-500 dark:text-zinc-400 block">Component Tree:</strong>
                        <pre className="whitespace-pre-wrap text-[10px] text-zinc-400 dark:text-zinc-500">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Subtitle footer mark */}
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 font-mono relative z-10">
              <Sparkles className="w-3.5 h-3.5 text-[#D9704F]" />
              <span>Vedha AI Self-Healing Architecture</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
