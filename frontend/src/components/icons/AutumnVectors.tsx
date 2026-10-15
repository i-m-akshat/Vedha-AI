import React from 'react';

/**
 * Autumn Design System Vector Illustrations
 * Faithfully inspired by "Autumn app by Tamo" reference design.
 * Warm earth tones, soft organic curves, terracotta (#D9704F),
 * golden mustard (#E5A93C), sage green (#5B9279), and peach (#F7D3C3).
 */

export const AutumnHeroVector: React.FC<{ className?: string }> = ({ className = "w-full h-48" }) => (
  <svg 
    viewBox="0 0 700 240" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
    preserveAspectRatio="xMidYMid slice"
  >
    {/* Soft sky and rolling hills backdrop */}
    <rect width="700" height="240" fill="#FDF3E9" />
    <path d="M0 240C120 180 240 210 380 190C500 170 600 210 700 195V240H0Z" fill="#FCE9D9" />
    <path d="M0 240C150 200 300 225 450 215C560 205 630 220 700 218V240H0Z" fill="#E8DDD2" />

    {/* Background Autumn Foliage Blobs */}
    <ellipse cx="280" cy="110" rx="90" ry="75" fill="#EFA84B" />
    <ellipse cx="220" cy="120" rx="65" ry="55" fill="#E5973A" />
    <ellipse cx="340" cy="125" rx="75" ry="60" fill="#EFA84B" />
    <ellipse cx="560" cy="120" rx="80" ry="70" fill="#C65A3D" opacity="0.9" />
    <ellipse cx="610" cy="130" rx="70" ry="65" fill="#A84329" opacity="0.9" />

    {/* Ground / Paved Pathway */}
    <path d="M0 240C100 195 240 200 380 195C520 190 620 205 700 200V240H0Z" fill="#D6C6BA" />
    <path d="M0 240C140 205 280 210 420 205C550 200 640 212 700 208V240H0Z" fill="#DFD2C7" />

    {/* Tree Trunks */}
    <path d="M120 120V220" stroke="#756157" strokeWidth="5" strokeLinecap="round" />
    <path d="M120 160L135 145" stroke="#756157" strokeWidth="3" strokeLinecap="round" />
    <path d="M600 130V225" stroke="#604D44" strokeWidth="7" strokeLinecap="round" />

    {/* Walking Character (Stylized legs in motion with mustard shoes) */}
    <g transform="translate(380, 80)">
      {/* Upper body / coat draped */}
      <path d="M70 20C65 45 60 70 55 90C75 90 95 85 110 75C105 50 95 30 70 20Z" fill="#E3B3A5" />
      <path d="M62 70C60 90 58 105 56 120C75 118 90 115 105 110C106 95 108 80 110 75Z" fill="#5E4E49" />
      {/* Front moving leg */}
      <path d="M68 115C72 135 78 155 86 175L94 177" stroke="#483B36" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      {/* Front shoe */}
      <path d="M84 175C94 175 112 176 124 177C124 182 115 186 98 186C88 186 82 181 84 175Z" fill="#EAA53B" />
      
      {/* Back leg */}
      <path d="M96 112C108 128 122 145 135 160L138 163" stroke="#3D322E" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {/* Back shoe lifted */}
      <path d="M134 158C140 166 148 178 147 185C142 187 135 182 130 172C128 167 130 162 134 158Z" fill="#EAA53B" />
    </g>

    {/* Walking Companion Pet (Fluffy white dog with leash) */}
    <g transform="translate(180, 140)">
      {/* Red/terracotta Leash curving to character */}
      <path d="M125 15C170 12 210 -15 260 -40" stroke="#CF5C40" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 0" />
      
      {/* Dog Body */}
      <ellipse cx="90" cy="30" rx="36" ry="18" fill="#FFFFFF" />
      <circle cx="120" cy="18" r="16" fill="#FFFFFF" />
      
      {/* Dog Ears (soft brown tint) */}
      <ellipse cx="112" cy="18" rx="6" ry="12" fill="#D3C1B5" />
      <ellipse cx="128" cy="18" rx="6" ry="12" fill="#D3C1B5" />
      
      {/* Eyes & Nose */}
      <circle cx="116" cy="16" r="2.2" fill="#2E2421" />
      <circle cx="124" cy="16" r="2.2" fill="#2E2421" />
      <ellipse cx="120" cy="20" rx="3.5" ry="2" fill="#2E2421" />
      <path d="M118 22C120 23.5 122 23.5 124 22" stroke="#2E2421" strokeWidth="1.2" strokeLinecap="round" />
      
      {/* Terracotta Collar */}
      <path d="M112 26C116 29 124 29 128 26" stroke="#CF5C40" strokeWidth="3" strokeLinecap="round" />
      
      {/* Legs */}
      <rect x="68" y="38" width="6" height="15" rx="3" fill="#FFFFFF" />
      <rect x="80" y="38" width="6" height="15" rx="3" fill="#EDE4DD" />
      <rect x="100" y="38" width="6" height="15" rx="3" fill="#FFFFFF" />
      <rect x="110" y="38" width="6" height="15" rx="3" fill="#EDE4DD" />
      
      {/* Tail up */}
      <path d="M60 25C54 18 56 8 64 6C66 12 64 20 60 25Z" fill="#FFFFFF" />
    </g>

    {/* Floating Falling Autumn Leaves */}
    <g fill="#EAA53B" opacity="0.85">
      <path d="M140 85C148 83 154 87 155 93C150 97 142 95 140 85Z" />
      <path d="M260 55C266 52 272 56 273 62C267 65 261 63 260 55Z" />
      <path d="M480 75C488 72 494 77 495 84C489 88 482 86 480 75Z" fill="#D9704F" />
      <path d="M540 145C546 142 552 146 553 152C547 155 541 153 540 145Z" fill="#C65A3D" />
      <path d="M320 160C326 157 332 161 333 167C327 170 321 168 320 160Z" />
    </g>
  </svg>
);

export const AutumnTreeLeavesVector: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="80" height="80" rx="20" fill="#FEF3E8" />
    {/* Trunk */}
    <path d="M40 70V30" stroke="#7E5F4E" strokeWidth="5" strokeLinecap="round" />
    <path d="M40 48L52 38" stroke="#7E5F4E" strokeWidth="3" strokeLinecap="round" />
    <path d="M40 56L28 46" stroke="#7E5F4E" strokeWidth="3" strokeLinecap="round" />
    {/* Golden Foliage */}
    <ellipse cx="40" cy="28" rx="20" ry="16" fill="#F0A83B" />
    <ellipse cx="26" cy="38" rx="14" ry="12" fill="#E8962B" />
    <ellipse cx="54" cy="38" rx="14" ry="12" fill="#F4B84D" />
    <ellipse cx="40" cy="40" rx="16" ry="13" fill="#D9704F" opacity="0.9" />
    {/* Floating leaf */}
    <path d="M58 20C62 18 66 21 66 25C62 27 58 25 58 20Z" fill="#E8962B" />
  </svg>
);

export const AutumnUmbrellaVector: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="80" height="80" rx="20" fill="#FDF0E6" />
    {/* Umbrella Canopy */}
    <path d="M18 42C18 26 28 16 40 16C52 16 62 26 62 42C56 39 50 41 46 43C42 41 38 41 34 43C30 41 24 39 18 42Z" fill="#EFA83B" />
    <path d="M28 41C30 26 36 17 40 16C44 17 50 26 52 41C48 40 44 41 40 42C36 41 32 40 28 41Z" fill="#D9704F" />
    {/* Umbrella Tip */}
    <path d="M40 12V16" stroke="#5E4E49" strokeWidth="2.5" strokeLinecap="round" />
    {/* Handle / J-hook */}
    <path d="M40 42V56C40 60 44 63 48 61C51 59 50 55 48 55" stroke="#5E4E49" strokeWidth="3" strokeLinecap="round" fill="none" />
    {/* Floating autumn droplets & leaf */}
    <circle cx="22" cy="52" r="2" fill="#84B8A6" />
    <circle cx="60" cy="48" r="2.2" fill="#84B8A6" />
    <path d="M24 24C28 22 31 25 31 28C28 30 25 28 24 24Z" fill="#D9704F" />
  </svg>
);

export const AutumnWalkingStepsVector: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="80" height="80" rx="20" fill="#F5EFE8" />
    {/* Stylized walking boot & step */}
    <path d="M35 15V45L45 52" stroke="#483B36" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    {/* Boot */}
    <path d="M40 48C48 48 58 50 64 53C64 57 58 60 48 60C41 60 38 56 40 48Z" fill="#EAA53B" />
    {/* Pathway stone */}
    <ellipse cx="44" cy="65" rx="22" ry="5" fill="#DCD0C5" />
    {/* Autumn maple leaf near foot */}
    <path d="M22 55C27 52 32 55 33 60C28 63 23 61 22 55Z" fill="#CF5C40" />
  </svg>
);

export const AutumnScarfBranchVector: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="80" height="80" rx="20" fill="#FAF1E6" />
    {/* Birch branch with dark notches */}
    <path d="M65 70C58 50 52 35 48 15" stroke="#756157" strokeWidth="6" strokeLinecap="round" />
    <path d="M52 42L35 30" stroke="#756157" strokeWidth="4" strokeLinecap="round" />
    {/* Scarf draped & flowing in the breeze */}
    <path d="M38 28C38 35 48 44 58 40C64 38 68 30 62 26C55 22 42 22 38 28Z" fill="#D9704F" />
    <path d="M52 40C52 48 48 56 46 62" stroke="#D9704F" strokeWidth="7" strokeLinecap="round" />
    <path d="M44 62L43 65" stroke="#C65A3D" strokeWidth="6" strokeLinecap="round" />
    {/* Falling leaves */}
    <path d="M26 38C30 36 34 39 34 43C30 45 27 43 26 38Z" fill="#E8962B" />
    <path d="M60 18C64 16 68 19 68 23C64 25 61 23 60 18Z" fill="#EFA84B" />
  </svg>
);

export const AutumnAvatarVector: React.FC<{ className?: string }> = ({ className = "w-16 h-16" }) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="80" height="80" rx="22" fill="#E6F2EC" />
    {/* Head & Neck */}
    <ellipse cx="40" cy="42" rx="14" ry="17" fill="#FADBC8" />
    {/* Brown Coiffed Hair */}
    <path d="M26 36C26 24 33 16 45 16C54 16 57 23 57 32C54 32 50 26 44 26C37 26 34 32 30 36H26Z" fill="#4A3B32" />
    <path d="M44 16C50 12 56 16 58 20C55 21 52 20 48 18L44 16Z" fill="#3D3028" />
    {/* Eyes & Eyebrows */}
    <circle cx="36" cy="40" r="1.8" fill="#2E2420" />
    <circle cx="45" cy="40" r="1.8" fill="#2E2420" />
    <path d="M33 36C35 35 38 35 39 36" stroke="#3D3028" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M43 36C45 35 47 35 48 36" stroke="#3D3028" strokeWidth="1.2" strokeLinecap="round" />
    {/* Smile */}
    <path d="M38 48C40 50 42 50 43 48" stroke="#B87766" strokeWidth="1.5" strokeLinecap="round" />
    {/* Collar / Warm Autumn Terracotta Sweater */}
    <path d="M22 75C24 64 30 58 40 58C50 58 56 64 58 75H22Z" fill="#D9704F" />
    <path d="M35 58L40 64L45 58" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const AutumnPumpkinVector: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="60" height="60" rx="16" fill="#FEF2E4" />
    {/* Stem */}
    <path d="M30 18C30 14 33 11 36 10" stroke="#5B8766" strokeWidth="3" strokeLinecap="round" />
    {/* Pumpkin lobes */}
    <ellipse cx="23" cy="33" rx="10" ry="14" fill="#E88B27" />
    <ellipse cx="37" cy="33" rx="10" ry="14" fill="#E88B27" />
    <ellipse cx="30" cy="34" rx="11" ry="15" fill="#F49E38" />
    {/* Small leaf */}
    <path d="M32 15C36 13 39 16 38 20C35 21 32 19 32 15Z" fill="#699E77" />
  </svg>
);

export const AutumnBenchVector: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="60" height="60" rx="16" fill="#F4EFEA" />
    {/* Bench Planks */}
    <rect x="14" y="24" width="32" height="4" rx="2" fill="#8B6953" />
    <rect x="14" y="30" width="32" height="4" rx="2" fill="#8B6953" />
    <rect x="14" y="36" width="32" height="4" rx="2" fill="#785844" />
    {/* Bench Legs */}
    <path d="M18 36V48" stroke="#483B36" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M42 36V48" stroke="#483B36" strokeWidth="2.5" strokeLinecap="round" />
    {/* Floating leaf on bench */}
    <path d="M34 22C37 20 40 22 40 25C38 27 35 25 34 22Z" fill="#D9704F" />
  </svg>
);

export const AutumnDogVector: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="60" height="60" rx="16" fill="#FDF3E9" />
    {/* Dog Body */}
    <ellipse cx="28" cy="35" rx="14" ry="9" fill="#FFFFFF" />
    <circle cx="42" cy="27" r="8" fill="#FFFFFF" />
    {/* Ears */}
    <ellipse cx="38" cy="27" rx="3" ry="6" fill="#D3C1B5" />
    <ellipse cx="46" cy="27" rx="3" ry="6" fill="#D3C1B5" />
    {/* Eyes & Nose */}
    <circle cx="40" cy="26" r="1.2" fill="#2E2421" />
    <circle cx="44" cy="26" r="1.2" fill="#2E2421" />
    <ellipse cx="42" cy="29" rx="1.5" ry="1" fill="#2E2421" />
    {/* Collar */}
    <path d="M38 32C40 33.5 44 33.5 46 32" stroke="#CF5C40" strokeWidth="2" strokeLinecap="round" />
    {/* Legs */}
    <rect x="20" y="41" width="3" height="7" rx="1.5" fill="#FFFFFF" />
    <rect x="26" y="41" width="3" height="7" rx="1.5" fill="#EDE4DD" />
    <rect x="33" y="41" width="3" height="7" rx="1.5" fill="#FFFFFF" />
    <rect x="38" y="41" width="3" height="7" rx="1.5" fill="#EDE4DD" />
    {/* Tail */}
    <path d="M16 33C13 30 14 25 18 24C19 27 18 31 16 33Z" fill="#FFFFFF" />
  </svg>
);
