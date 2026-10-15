import React from 'react';

/** Aksh AI brand mark: geometric upward growth A emblem in Autumn terracotta & sage. */
export const AkshMark: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = '',
}) => (
  <div
    style={{ width: size, height: size }}
    className={`relative shrink-0 flex items-center justify-center rounded-xl bg-white p-0.5 shadow-sm border border-black/[0.08] dark:border-white/[0.12] overflow-hidden ${className}`}
  >
    <img
      src="/assets/aksh-ai-logo.png"
      alt="Aksh AI"
      className="w-full h-full object-contain"
    />
  </div>
);
