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

  // Rotate through playful messages every 2.4s if no custom message is fixed
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
        <div className="relative w-8 h-8 shrink-0">
          {/* Pulsing glow ring */}
          <div className="absolute inset-0 rounded-xl bg-[#D9704F]/20 animate-ping" />
          {/* Bot Face Squircle */}
          <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-[#D9704F] to-[#C85F3E] flex items-center justify-center shadow-sm">
            {/* Blinking eyes */}
            <div className="flex items-center gap-1">
              <span className="w-1 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            </div>
          </div>
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

  const avatarDimensions = isSmall ? 'w-10 h-10' : isLarge ? 'w-20 h-20' : 'w-14 h-14';
  const eyeDimensions = isSmall ? 'w-1 h-1.5' : isLarge ? 'w-2 h-3' : 'w-1.5 h-2.5';
  const eyeGap = isSmall ? 'gap-1' : isLarge ? 'gap-2.5' : 'gap-1.5';

  return (
    <div className={`flex flex-col items-center justify-center text-center p-4 ${className}`}>
      {/* Fun Mascot Container */}
      <div className="relative mb-3 flex items-center justify-center">
        {/* Soft Ambient Radiance Aura */}
        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-[#D9704F]/30 via-[#EFA84B]/20 to-[#5B9279]/20 blur-md animate-pulse" />

        {/* Orbiting Document / Paper Plane Icon */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: '6s' }}>
          <div className="w-4 h-4 rounded-md bg-white dark:bg-zinc-800 border border-[#D9704F]/40 shadow-sm flex items-center justify-center -top-2 left-1/2 -translate-x-1/2 text-[9px] text-[#D9704F]">
            ✦
          </div>
        </div>

        {/* Floating Squircle Companion "Aksh" */}
        <div
          className={`relative ${avatarDimensions} rounded-[22px] bg-gradient-to-br from-[#D9704F] via-[#C85F3E] to-[#B04C2E] p-0.5 shadow-lg shadow-[#D9704F]/25 flex items-center justify-center transition-all animate-bounce`}
          style={{ animationDuration: '2s' }}
        >
          {/* Inner face mask */}
          <div className="w-full h-full rounded-[20px] bg-gradient-to-b from-[#2B1B17] to-[#1C1210] flex flex-col items-center justify-center relative overflow-hidden border border-white/10">
            {/* Soft cheeks / blush */}
            <div className="absolute inset-x-2 bottom-2.5 flex justify-between pointer-events-none opacity-40">
              <span className="w-2 h-1 rounded-full bg-[#EFA84B]" />
              <span className="w-2 h-1 rounded-full bg-[#EFA84B]" />
            </div>

            {/* Expressive animated eyes */}
            <div className={`flex items-center ${eyeGap} mb-0.5`}>
              <span
                className={`${eyeDimensions} bg-white rounded-full shadow-[0_0_6px_#fff] animate-pulse`}
              />
              <span
                className={`${eyeDimensions} bg-white rounded-full shadow-[0_0_6px_#fff] animate-pulse`}
                style={{ animationDelay: '200ms' }}
              />
            </div>

            {/* Cute mini smile */}
            <div className="w-2.5 h-1 border-b-2 border-white/80 rounded-full" />
          </div>

          {/* Little Antenna / Sparkle on top */}
          <div className="absolute -top-1.5 w-1.5 h-1.5 rounded-full bg-[#EFA84B] ring-2 ring-white dark:ring-zinc-900 animate-ping" />
        </div>
      </div>

      {/* Dynamic Typing / Stage Message */}
      <div className="space-y-1 max-w-sm">
        <div className="flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D9704F] animate-pulse" />
          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white tracking-tight transition-all duration-300">
            {displayMessage}
          </h4>
        </div>
        {submessage ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {submessage}
          </p>
        ) : (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
            Vedha Intelligence Engine • Human-in-the-loop verified
          </p>
        )}
      </div>

      {/* Progress pill shimmer */}
      <div className="w-40 h-1 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden mt-2.5">
        <div className="h-full w-full bg-gradient-to-r from-[#D9704F] via-[#EFA84B] to-[#5B9279] rounded-full animate-pulse" />
      </div>
    </div>
  );
};
