import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Editorial Framing Accents
 * Minimalist subtle framing without garish HUD slop
 */
export const CornerBrackets: React.FC<{ className?: string; size?: string }> = ({
  className = 'border-zinc-300 dark:border-white/[0.08]',
  size = 'w-1.5 h-1.5',
}) => (
  <>
    <span className={cn('absolute top-0 left-0 border-t border-l pointer-events-none transition-colors duration-200', size, className)} />
    <span className={cn('absolute top-0 right-0 border-t border-r pointer-events-none transition-colors duration-200', size, className)} />
    <span className={cn('absolute bottom-0 left-0 border-b border-l pointer-events-none transition-colors duration-200', size, className)} />
    <span className={cn('absolute bottom-0 right-0 border-b border-r pointer-events-none transition-colors duration-200', size, className)} />
  </>
);

/**
 * Live Audio / Signal Pulse Equalizer
 * Understated, elegant status indicator
 */
export const LivePulse: React.FC<{ active?: boolean; label?: string; className?: string }> = ({
  active = true,
  label = 'System Active',
  className,
}) => (
  <div className={cn('inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-white/[0.07] bg-zinc-100/80 dark:bg-zinc-900/60 backdrop-blur-md text-[10px] font-mono tracking-wider uppercase text-zinc-600 dark:text-zinc-400', className)}>
    <div className="flex items-end gap-[2px] h-3 w-3">
      <span className={cn('w-[2px] rounded-full bg-emerald-500', active ? 'wave-bar-1' : 'h-[3px]')} />
      <span className={cn('w-[2px] rounded-full bg-emerald-500', active ? 'wave-bar-2' : 'h-[6px]')} />
      <span className={cn('w-[2px] rounded-full bg-emerald-500', active ? 'wave-bar-3' : 'h-[4px]')} />
      <span className={cn('w-[2px] rounded-full bg-emerald-500', active ? 'wave-bar-4' : 'h-[2px]')} />
    </div>
    {label && <span className="opacity-90">{label}</span>}
  </div>
);

/**
 * Minimalist Linear Progress Indicator
 */
export const LiquidProgress: React.FC<{
  progress: number;
  label?: string;
  showPercent?: boolean;
  className?: string;
}> = ({ progress, label, showPercent = true, className }) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-[11px] font-mono tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
          <span>{label}</span>
          {showPercent && (
            <span className="font-semibold text-zinc-900 dark:text-white">
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-white/[0.06]">
        <div
          className="relative h-full transition-all duration-300 ease-out rounded-full bg-zinc-900 dark:bg-white"
          style={{ width: `${clamped}%` }}
        />
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
    const base = 'relative inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none tracking-tight cursor-pointer';

    const variants = {
      primary: 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold shadow-sm rounded-xl',
      secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 dark:text-zinc-100 dark:border-white/[0.08] rounded-xl',
      outline: 'border border-zinc-300/80 hover:border-zinc-400 text-zinc-800 hover:bg-zinc-100/80 dark:border-white/[0.1] dark:hover:border-white/[0.2] dark:text-zinc-200 dark:hover:bg-white/[0.04] rounded-xl',
      ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white rounded-xl',
      danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm border border-rose-500/30 rounded-xl',
      tech: 'font-mono text-xs uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-white/[0.08] rounded-lg',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-4 py-2 h-9 gap-2',
      lg: 'text-base px-5 py-2.5 h-11 gap-2.5',
      icon: 'h-8 w-8 p-0 rounded-xl',
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
        'flex h-9 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:border-white/[0.08] dark:bg-zinc-950/70 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 transition-colors',
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
        'flex min-h-[90px] w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:border-white/[0.08] dark:bg-zinc-950/70 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 transition-colors',
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
  interactive3d?: boolean;
  holographic?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  className, 
  bracketed = false, 
  glowing = false, 
  interactive3d = false,
  holographic = false,
  children, 
  ...props 
}) => (
  <div
    className={cn(
      'relative rounded-2xl border border-zinc-200/90 bg-white text-zinc-900 shadow-sm p-5 transition-all duration-200 dark:border-white/[0.07] dark:bg-[#121215] dark:text-zinc-100',
      interactive3d && 'hover:border-zinc-350 dark:hover:border-white/[0.14] hover:shadow-md transition-all duration-200',
      className
    )}
    {...props}
  >
    {bracketed && <CornerBrackets />}
    {children}
  </div>
);

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { 
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'outline' | 'tech' | 'cyber';
  crossIcon?: boolean;
}> = ({
  className,
  variant = 'default',
  crossIcon = false,
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-white/[0.08]',
    success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    purple: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    outline: 'border border-zinc-300 text-zinc-700 dark:border-white/[0.1] dark:text-zinc-300',
    tech: 'font-mono text-[10px] tracking-wider uppercase bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-white/[0.08]',
    cyber: 'font-mono text-[10px] tracking-wider uppercase bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:border-white/[0.1]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-all',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={cn('relative w-full rounded-2xl border border-zinc-200 bg-white text-zinc-900 p-6 shadow-xl dark:border-white/[0.1] dark:bg-[#121215] dark:text-white', maxWidth)}>
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-white/[0.07] mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">{title}</h3>
            {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
};

export * from './StudioCanvas3D';
export * from './FuturisticCanvas3D';
export * from './gsap-motions';
