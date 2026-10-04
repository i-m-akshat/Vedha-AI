import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Technical Corner Brackets
 * Signature editorial framing inspired by Ciao Energy & Depth
 */
export const CornerBrackets: React.FC<{ className?: string; size?: string }> = ({
  className = 'border-slate-400/80 dark:border-zinc-500/60',
  size = 'w-2 h-2',
}) => (
  <>
    <span className={cn('absolute -top-[1px] -left-[1px] border-t border-l pointer-events-none transition-colors duration-200', size, className)} />
    <span className={cn('absolute -top-[1px] -right-[1px] border-t border-r pointer-events-none transition-colors duration-200', size, className)} />
    <span className={cn('absolute -bottom-[1px] -left-[1px] border-b border-l pointer-events-none transition-colors duration-200', size, className)} />
    <span className={cn('absolute -bottom-[1px] -right-[1px] border-b border-r pointer-events-none transition-colors duration-200', size, className)} />
  </>
);

/**
 * Live Audio / Signal Pulse Equalizer
 * Inspired by Ciao Energy's audio wave indicator
 */
export const LivePulse: React.FC<{ active?: boolean; label?: string; className?: string }> = ({
  active = true,
  label = 'ENGINE // ACTIVE',
  className,
}) => (
  <div className={cn('inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/[0.08] bg-slate-100/80 dark:bg-zinc-950/60 backdrop-blur-md text-[10px] font-mono tracking-wider uppercase text-slate-700 dark:text-zinc-300', className)}>
    <div className="flex items-end gap-[2px] h-3 w-3.5">
      <span className={cn('w-[2px] rounded-full bg-indigo-600 dark:bg-indigo-400', active ? 'wave-bar-1' : 'h-[3px]')} />
      <span className={cn('w-[2px] rounded-full bg-indigo-600 dark:bg-indigo-400', active ? 'wave-bar-2' : 'h-[6px]')} />
      <span className={cn('w-[2px] rounded-full bg-indigo-600 dark:bg-indigo-400', active ? 'wave-bar-3' : 'h-[4px]')} />
      <span className={cn('w-[2px] rounded-full bg-indigo-600 dark:bg-indigo-400', active ? 'wave-bar-4' : 'h-[2px]')} />
    </div>
    {label && <span className="opacity-90">{label}</span>}
  </div>
);

/**
 * Liquid Progress Indicator
 * Inspired by Ciao Energy's liquid gradient filter and glowing progress bar
 */
export const LiquidProgress: React.FC<{
  progress: number; // 0 to 100
  label?: string;
  showPercent?: boolean;
  className?: string;
}> = ({ progress, label, showPercent = true, className }) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-[11px] font-mono tracking-wider uppercase text-slate-600 dark:text-zinc-400">
          <span>{label}</span>
          {showPercent && (
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-zinc-900/90 border border-slate-300/50 dark:border-white/[0.08]">
        {/* Core liquid gradient bar */}
        <div
          className="relative h-full transition-all duration-500 ease-out rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 animate-liquid"
          style={{ width: `${clamped}%` }}
        >
          {/* Leading hotspot dot */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] opacity-90" />
        </div>
      </div>
    </div>
  );
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'tech';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const base = 'relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none tracking-tight';

    const variants = {
      primary: 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-semibold shadow-sm border border-transparent dark:border-white/20 rounded-xl',
      secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 dark:bg-zinc-900/90 dark:hover:bg-zinc-800/90 dark:text-zinc-100 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] rounded-xl',
      outline: 'border border-slate-300/80 hover:border-slate-400 text-slate-800 hover:bg-slate-100/80 dark:border-white/[0.12] dark:hover:border-white/[0.25] dark:text-zinc-200 dark:hover:bg-white/[0.04] dark:hover:text-white rounded-xl backdrop-blur-sm',
      ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-white/[0.05] dark:hover:text-white rounded-xl',
      danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm border border-rose-500/30 rounded-xl',
      tech: 'font-mono text-xs uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-500/30 rounded-lg',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-4 py-2 h-10 gap-2',
      lg: 'text-base px-6 py-2.5 h-11 gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-xl',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/80 transition-all dark:border-white/[0.1] dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/80 backdrop-blur-sm',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[90px] w-full rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/60 focus:border-indigo-500/80 transition-all dark:border-white/[0.1] dark:bg-zinc-950/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400/80 backdrop-blur-sm',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  bracketed?: boolean;
  glowing?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, bracketed = false, glowing = false, children, ...props }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-slate-200/90 bg-white/80 text-slate-900 shadow-sm backdrop-blur-xl p-5 transition-all duration-200 dark:border-white/[0.08] dark:bg-zinc-950/70 dark:text-zinc-100',
      glowing && 'studio-glow',
      className
    )}
    {...props}
  >
    {/* Subtle specular top highlight line */}
    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent pointer-events-none rounded-t-2xl" />
    {bracketed && <CornerBrackets />}
    {children}
  </div>
);

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { 
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'outline' | 'tech';
  crossIcon?: boolean;
}> = ({
  className,
  variant = 'default',
  crossIcon = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-zinc-900/90 dark:text-zinc-300 dark:border-white/[0.08]',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    purple: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    outline: 'border border-slate-300 text-slate-700 dark:border-white/[0.12] dark:text-zinc-300',
    tech: 'font-mono text-[10px] tracking-wider uppercase bg-slate-100/90 text-slate-700 border-slate-300 dark:bg-zinc-950/80 dark:text-zinc-300 dark:border-white/[0.1]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {crossIcon && <span className="opacity-50 text-[10px]">×</span>}
      {children}
    </span>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, onClose, title, description, children, maxWidth = 'max-w-2xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className={cn('relative w-full rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 p-6 shadow-2xl dark:border-white/[0.12] dark:bg-zinc-950/95 dark:text-white', maxWidth)}>
        <CornerBrackets size="w-3 h-3" />
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/[0.08] mb-4">
          <div>
            <div className="text-[10px] font-mono tracking-wider uppercase text-slate-500 dark:text-zinc-400 mb-0.5">
              DIALOG // OVERLAY
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
            {description && <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
};

// Re-export 3D & GSAP motion elements
export * from './StudioCanvas3D';
export * from './gsap-motions';

