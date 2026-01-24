'use client';

type StartOverlayProps = {
  onStart: () => void;
};

export default function StartOverlay({ onStart }: StartOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black via-gray-900 to-black text-white overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(255, 0, 0, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(0, 255, 0, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(255, 100, 0, 0.2) 0%, transparent 50%)
          `,
        }} />
      </div>

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
      }} />

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Title */}
        <div className="relative">
          <h1 
            className="text-6xl md:text-8xl font-black tracking-tight"
            style={{ 
              textShadow: '0 0 40px rgba(255, 0, 0, 0.8), 0 0 80px rgba(255, 0, 0, 0.4)',
              background: 'linear-gradient(180deg, #ff4444 0%, #aa0000 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))',
            }}
          >
            ALIEN SWARM
          </h1>
          <div className="absolute -inset-4 bg-red-500/20 blur-3xl -z-10 animate-pulse" />
        </div>

        <div className="text-xl md:text-2xl text-gray-400 font-light tracking-widest uppercase">
          Extermination Protocol
        </div>

        {/* Divider */}
        <div className="w-64 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent my-4" />

        {/* Controls */}
        <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800 max-w-md">
          <div className="text-yellow-400 font-bold text-center mb-4 tracking-wider">CONTROLS</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="text-gray-400">Movement</div>
            <div className="text-white font-mono">W A S D</div>
            <div className="text-gray-400">Aim</div>
            <div className="text-white font-mono">MOUSE</div>
            <div className="text-gray-400">Fire</div>
            <div className="text-white font-mono">LMB / SPACE</div>
            <div className="text-gray-400">Interact</div>
            <div className="text-white font-mono">E</div>
          </div>
        </div>

        {/* Tips */}
        <div className="text-gray-500 text-xs text-center max-w-sm mt-2 space-y-1">
          <p>Survive waves of alien creatures</p>
          <p>Collect <span className="text-green-400">health</span>, <span className="text-yellow-400">ammo</span> and <span className="text-blue-400">armor</span></p>
          <p>Reach the <span className="text-green-300">EXIT</span> to advance</p>
        </div>

        {/* Start button */}
        <button 
          type="button" 
          className="mt-8 group relative px-16 py-5 font-black text-2xl uppercase tracking-wider transition-all duration-300"
          onClick={onStart}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-700 to-red-600 rounded-lg transform group-hover:scale-105 transition-transform" />
          <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 rounded-lg shadow-lg shadow-red-500/50 group-hover:shadow-red-400/70 transition-shadow" />
          <div className="absolute -inset-1 bg-red-500/30 rounded-lg blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="relative text-white">START GAME</span>
        </button>

        {/* Version */}
        <div className="text-gray-600 text-xs mt-4">v2.0 - Top-Down Shooter</div>
      </div>
    </div>
  );
}
