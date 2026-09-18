'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

type Phase = 'idle' | 'striking' | 'reveal' | 'done';

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('striking'), 200));
    timers.push(setTimeout(() => setPhase('reveal'), 1050));
    timers.push(setTimeout(() => setReady(true), 2400));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (ready && !loading) {
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [ready, loading]);

  if (!visible) return <>{children}</>;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#0a0a0f] overflow-hidden transition-opacity duration-500 ${
        ready && !loading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background yellow glow pulse */}
      <div
        className={`absolute inset-0 bg-yellow-400/10 transition-opacity duration-300 ${
          phase === 'striking' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Main lightning bolt - BIG and BRIGHT */}
      <div
        className={`absolute left-1/2 top-0 -translate-x-1/2 transition-all duration-500 ${
          phase === 'striking' || phase === 'reveal'
            ? 'h-[80vh] opacity-100 scale-x-100'
            : 'h-0 opacity-0 scale-x-50'
        }`}
      >
        <svg
          viewBox="0 0 100 500"
          className="h-full w-auto animate-splash-bolt-pulse"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="splash-bolt-grad" x1="50" y1="0" x2="50" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="20%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="80%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="splash-bolt-core" x1="50" y1="0" x2="50" y2="500" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#fef9c3" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
            <filter id="splash-bolt-glow">
              <feGaussianBlur stdDeviation="6" result="blur1" />
              <feGaussianBlur stdDeviation="12" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="splash-core-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Outer glow layer */}
          <path
            d="M58 0 L42 60 L62 65 L30 140 L65 145 L20 260 L60 265 L10 400 L55 405 L0 500 L90 390 L45 385 L80 260 L35 255 L70 140 L25 135 L58 58 L38 52 L58 0 Z"
            fill="url(#splash-bolt-grad)"
            filter="url(#splash-bolt-glow)"
            opacity="0.8"
          />
          {/* Core bright layer */}
          <path
            d="M55 0 L45 55 L58 58 L35 135 L60 138 L25 250 L55 253 L15 380 L50 383 L5 500 L85 385 L48 380 L75 253 L38 250 L65 138 L30 135 L55 58 L42 55 L55 0 Z"
            fill="url(#splash-bolt-core)"
            filter="url(#splash-core-glow)"
          />
          {/* Branch bolt left */}
          <path
            d="M42 60 L20 90 L30 87 L8 130 L28 85 L18 88 L42 58 Z"
            fill="#fde047"
            filter="url(#splash-core-glow)"
            opacity="0.9"
            className="animate-splash-branch"
            style={{ animationDelay: '0s' }}
          />
          {/* Branch bolt right */}
          <path
            d="M60 140 L82 175 L72 172 L95 220 L75 170 L85 173 L60 138 Z"
            fill="#facc15"
            filter="url(#splash-core-glow)"
            opacity="0.8"
            className="animate-splash-branch"
            style={{ animationDelay: '0.18s' }}
          />
          {/* Branch bolt left lower */}
          <path
            d="M35 260 L15 295 L25 292 L5 340 L22 290 L12 293 L35 258 Z"
            fill="#fbbf24"
            filter="url(#splash-core-glow)"
            opacity="0.7"
            className="animate-splash-branch"
            style={{ animationDelay: '0.36s' }}
          />
        </svg>
      </div>

      {/* Content */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${
          phase === 'reveal' || ready ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <h1
          className="animate-splash-float text-5xl font-black tracking-tight text-[#C00000] sm:text-6xl md:text-7xl"
          style={{ textShadow: '0 0 24px rgba(192,0,0,0.55), 0 0 60px rgba(192,0,0,0.35)' }}
        >
          Power Tech
        </h1>
        <p
          className="animate-splash-float mt-3 text-base font-semibold tracking-widest text-slate-400"
          style={{ animationDelay: '0.25s' }}
        >
          Work Tracker
        </p>

        <div className="mt-10 w-56 h-1 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div
            className={`h-full bg-gradient-to-r from-violet-600 via-violet-500 to-yellow-400 rounded-full transition-all duration-700 ${
              phase === 'reveal' || ready ? 'w-full' : 'w-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
