import React from 'react';

export default function FrostedOrb({ className = "", children }: { className?: string, children?: React.ReactNode }) {
  return (
    <div className={`relative flex items-center justify-center bg-white/40 backdrop-blur-md border border-white/20 shadow-lg animate-liquid-flow ${className}`}>
      {children}
    </div>
  );
}
