import React from 'react';
import { Home, Compass, ArrowRight } from 'lucide-react';
import { AutumnWalkingStepsVector, AutumnScarfBranchVector } from '../components/icons/AutumnVectors';
import { ActivePage } from '../components/layout/AppLayout';

interface NotFoundPageProps {
  setActivePage: (page: ActivePage) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ setActivePage }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full p-6 text-center font-sans">
      <div className="relative max-w-lg w-full p-8 sm:p-10 rounded-[36px] bg-white dark:bg-[#16151F] border border-black/[0.06] dark:border-white/[0.08] shadow-xl space-y-6">
        
        {/* Vector Mascot / Illustration */}
        <div className="w-24 h-24 mx-auto rounded-[28px] bg-[#E1F3F0] dark:bg-[#1B3633] border border-[#C7EAE3] dark:border-[#29514D] flex items-center justify-center shadow-inner group">
          <AutumnWalkingStepsVector className="w-14 h-14 group-hover:scale-110 transition-transform duration-300" />
        </div>

        {/* 404 Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF2EE] dark:bg-[#2A1B16] border border-[#FAD9CE] dark:border-[#542B20] text-xs font-semibold font-mono text-[#D9704F] dark:text-[#F39A7E] uppercase tracking-wider">
          <Compass className="w-3.5 h-3.5" />
          <span>Trail 404 • Path Off-Course</span>
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Lost on the Autumn trail?
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            The page or career section you requested is not on the map. Return to your active dashboard to resume your application sprint.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActivePage('dashboard')}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#D9704F] hover:bg-[#C85F3E] text-white text-xs font-bold transition-all shadow-md shadow-[#D9704F]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('ask-aksh')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Ask Aksh Copilot</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
