import React from 'react';

export default function AnyenOrb({ className = "" }: { className?: string }) {
  return (
    <div className={"relative flex items-center justify-center bg-white/40 backdrop-blur-md border border-white/20 shadow-lg animate-liquid-flow " + className}>
      {/* Inner frosted glass glow elements can be nested here */}
    </div>
  );
}
