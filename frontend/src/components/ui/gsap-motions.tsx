import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * GSAP Kinetic Text Reveal Component
 * Inspired by Ciao Energy's data-anim="chars-mask" / line-mask reveals
 */
export const GsapTextReveal: React.FC<{
  text: string;
  className?: string;
  delay?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}> = ({ text, className = '', delay = 0.1, as: Tag = 'h1' }) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const words = el.querySelectorAll('.gsap-word-inner');
    gsap.fromTo(
      words,
      {
        yPercent: 120,
        opacity: 0,
        rotateX: -40,
      },
      {
        yPercent: 0,
        opacity: 1,
        rotateX: 0,
        duration: 0.9,
        stagger: 0.04,
        ease: 'power4.out',
        delay,
      }
    );
  }, [text, delay]);

  const words = text.split(' ');

  return (
    <Tag ref={containerRef as any} className={`overflow-hidden ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em] align-top">
          <span className="gsap-word-inner inline-block will-change-transform">
            {word}
          </span>
        </span>
      ))}
    </Tag>
  );
};

/**
 * Hook for 3D Perspective Tilt with GSAP physics
 * Provides tangible physical depth on hover inspired by modern studio designs
 */
export function useTilt3D<T extends HTMLElement = HTMLDivElement>(options = { maxTilt: 6, scale: 1.01 }) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const xTo = gsap.quickTo(el, 'rotationY', { duration: 0.4, ease: 'power2.out' });
    const yTo = gsap.quickTo(el, 'rotationX', { duration: 0.4, ease: 'power2.out' });
    const scaleTo = gsap.quickTo(el, 'scale', { duration: 0.3, ease: 'power2.out' });

    // Set perspective
    gsap.set(el, { transformPerspective: 1000, transformStyle: 'preserve-3d' });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;

      xTo(normX * options.maxTilt * 2);
      yTo(-normY * options.maxTilt * 2);
      scaleTo(options.scale);
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
      scaleTo(1);
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [options.maxTilt, options.scale]);

  return ref;
}

/**
 * Staggered Entrance Hook using GSAP
 */
export function useGsapStagger<T extends HTMLElement = HTMLDivElement>(selector: string, delay = 0.2) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = container.querySelectorAll(selector);
    if (!targets.length) return;

    gsap.fromTo(
      targets,
      {
        y: 20,
        opacity: 0,
        scale: 0.98,
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        delay,
      }
    );
  }, [selector, delay]);

  return containerRef;
}
