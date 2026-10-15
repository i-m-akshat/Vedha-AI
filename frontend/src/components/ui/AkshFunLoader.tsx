import React, { useEffect, useState } from 'react';

interface AkshFunLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'compact';
  message?: string;
  submessage?: string;
  className?: string;
}

const FUN_MESSAGES = [
  'Brewing high-impact resume bullets...',
  'Aligning keywords with Google XYZ standards...',
  'Calibrating ATS resonance score...',
  'Scanning recruiter screening filters...',
  'Drafting executive STAR achievements...',
  'Polishing professional narrative...',
];

export const AkshFunLoader: React.FC<AkshFunLoaderProps> = ({
  size = 'md',
  message,
  submessage,
  className = '',
}) => {
  const [msgIndex, setMsgIndex] = useState(0);

  // Rotate through messages every 2.4s if no custom message is fixed
  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % FUN_MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [message]);

  const displayMessage = message || FUN_MESSAGES[msgIndex];

  if (size === 'compact') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
          {/* Subtle spinning track */}
          <div className="w-6 h-6 rounded-full border-2 border-[#D9704F]/20 border-t-[#D9704F] animate-spin" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
            {displayMessage}
          </span>
          {submessage && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {submessage}
            </span>
          )}
        </div>
      </div>
    );
  }

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  const containerDimensions = isSmall ? 'w-12 h-12' : isLarge ? 'w-18 h-18' : 'w-14 h-14';
  const iconDimensions = isSmall ? 'w-6 h-6' : isLarge ? 'w-9 h-9' : 'w-7 h-7';

  return (
    <div className={`flex flex-col items-center justify-center text-center p-4 ${className}`}>
      {/* Brand Squircle Loader with Ambient Halo */}
      <div className="relative mb-3.5 flex items-center justify-center">
        {/* Soft Ambient Radiance Aura */}
        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-[#D9704F]/20 via-[#EFA84B]/15 to-[#5B7B6B]/15 blur-md" />

        {/* Outer Orbiting Track */}
        <div className="absolute -inset-1 rounded-[24px] border border-dashed border-[#D9704F]/30 animate-spin" style={{ animationDuration: '14s' }} />

        {/* Central Terracotta Squircle Badge */}
        <div
          className={`relative ${containerDimensions} rounded-2xl bg-gradient-to-br from-[#D9704F] to-[#C85F3E] p-2.5 shadow-md shadow-[#D9704F]/20 flex items-center justify-center transition-transform hover:scale-105`}
        >
          <img
            src="/assets/vedha-terracotta-leaf-emblem.png"
            alt="Loading"
            className={`${iconDimensions} object-contain filter drop-shadow-sm brightness-110`}
          />
        </div>
      </div>

      {/* Dynamic Stage Message */}
      <div className="space-y-1 max-w-sm">
        <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white tracking-tight transition-all duration-300">
          {displayMessage}
        </h4>
        {submessage ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {submessage}
          </p>
        ) : (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
            Vedha Intelligence Engine · Calibrated Analysis
          </p>
        )}
      </div>

      {/* Sleek Progress Track */}
      <div className="w-36 h-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden mt-3">
        <div className="h-full w-full bg-gradient-to-r from-[#D9704F] via-[#EFA84B] to-[#5B7B6B] rounded-full animate-pulse" />
      </div>
    </div>
  );
};
