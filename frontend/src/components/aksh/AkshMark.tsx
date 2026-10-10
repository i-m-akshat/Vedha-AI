import React from 'react';

/** Aksh brand mark: ascending A (growth) + checkmark crossbar (verified truth, approved submit) + spark. */
export const AkshMark: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    role="img"
    aria-label="Aksh agent"
    className={className}
  >
    <defs>
      <linearGradient id="aksh-badge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#312e81" />
        <stop offset="55%" stopColor="#4f46e5" />
        <stop offset="100%" stopColor="#0e7490" />
      </linearGradient>
      <linearGradient id="aksh-a" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#c7d2fe" />
      </linearGradient>
    </defs>
    <rect x="4" y="4" width="88" height="88" rx="24" fill="url(#aksh-badge)" />
    <path
      d="M30,68 L48,28 L66,68"
      fill="none"
      stroke="url(#aksh-a)"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M39,37 L48,27 L57,37"
      fill="none"
      stroke="#22d3ee"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M39,59 L45.5,65.5 L59,50"
      fill="none"
      stroke="#34d399"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M74,14 L76,20 L82,22 L76,24 L74,30 L72,24 L66,22 L72,20 Z"
      fill="#22d3ee"
    />
  </svg>
);
