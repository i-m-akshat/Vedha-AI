import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
}

const WORKSPACE_STEPS = [
  'Initializing career workspace...',
  'Synchronizing Master Resume & career profile...',
  'Checking application pipeline & interview schedule...',
  'Calibrating AI Copilot & Auto-Apply engine...',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message,
  submessage,
  fullScreen = true,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % WORKSPACE_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [message]);

  const activeMessage = message || WORKSPACE_STEPS[stepIndex];

  return (
    <div
      className={`flex flex-col items-center justify-center font-sans antialiased selection:bg-zinc-800 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950 transition-colors duration-300 ${
        fullScreen
          ? 'min-h-screen w-screen bg-[#FAF8F5] dark:bg-[#0D0C13] text-zinc-900 dark:text-[#ededed] p-6'
          : 'w-full py-16 text-zinc-900 dark:text-[#ededed]'
      }`}
    >
      <div className="relative flex flex-col items-center max-w-sm w-full text-center">
        {/* Soft Ambient Radiance in Background */}
        <div className="absolute -inset-12 bg-gradient-to-tr from-[#D9704F]/10 via-[#EFA84B]/10 to-[#5B7B6B]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand squircle logo with soft breathing glow */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-[26px] bg-white dark:bg-[#16151F] border border-[#D9704F]/20 dark:border-white/[0.08] shadow-xl shadow-[#D9704F]/10 flex items-center justify-center p-3.5 mx-auto transition-transform duration-500 hover:scale-105">
            <img
              src="/assets/vedha-terracotta-leaf-emblem.png"
              alt="Vedha AI"
              className="w-full h-full object-contain filter drop-shadow-sm"
            />
          </div>
          {/* Subtle spinning track around emblem */}
          <div className="absolute -inset-1 rounded-[30px] border border-dashed border-[#D9704F]/30 animate-spin" style={{ animationDuration: '18s' }} />
        </div>

        {/* Brand Title */}
        <div className="space-y-1 mb-5">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            Vedha<span className="text-[#D9704F]">.ai</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Career Operating System
          </p>
        </div>

        {/* Dynamic Stage Card */}
        <div className="w-full p-5 rounded-2xl bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-sm space-y-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-all duration-300">
              {activeMessage}
            </div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {submessage || 'Calibrating tailored career intelligence...'}
            </div>
          </div>

          {/* Smooth Gradient Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#D9704F] via-[#EFA84B] to-[#5B7B6B] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${((stepIndex + 1) / WORKSPACE_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Clean Trust Footer - No pulsing AI dots */}
        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span>Client-Side Encryption</span>
          <span>·</span>
          <span>Zero-Hallucination Guarantee</span>
        </div>
      </div>
    </div>
  );
};
