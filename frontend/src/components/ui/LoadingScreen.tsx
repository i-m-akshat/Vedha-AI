import React from 'react';
import { AkshFunLoader } from './AkshFunLoader';

interface LoadingScreenProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Calibrating your career workspace...',
  submessage = 'Synchronizing Master Resume, Auto-Apply Queue, and Job Tracker...',
  fullScreen = true,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center font-sans antialiased selection:bg-zinc-800 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950 transition-colors duration-300 ${
        fullScreen
          ? 'min-h-screen w-screen bg-[#FAF8F5] dark:bg-[#0D0C13] text-zinc-900 dark:text-[#ededed] p-6'
          : 'w-full py-16 text-zinc-900 dark:text-[#ededed]'
      }`}
    >
      {/* Soft Ambient Radiance in Background */}
      <div className="relative flex flex-col items-center max-w-md w-full text-center">
        <div className="absolute -inset-10 bg-gradient-to-tr from-[#D9704F]/10 via-[#EFA84B]/10 to-[#5B9279]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand squircle logo */}
        <div className="mb-6 relative z-10">
          <img
            src="/assets/vedha-v-leaf-icon.png"
            alt="Vedha AI"
            className="w-16 h-16 rounded-[22px] object-contain shadow-lg shadow-[#D9704F]/20 mx-auto"
          />
        </div>

        {/* Mascot & Playful Status Engine */}
        <div className="relative z-10 w-full p-6 sm:p-8 rounded-[32px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-xl backdrop-blur-xl">
          <AkshFunLoader size="lg" message={message} submessage={submessage} />
        </div>

        {/* Subtitle brand tag */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 font-mono relative z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D9704F] animate-pulse" />
          <span>Vedha.ai • The AI Career Operating System</span>
        </div>
      </div>
    </div>
  );
};
