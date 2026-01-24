'use client';

import { EngineSnapshot } from '@/engine/types';

type HudProps = {
  state: EngineSnapshot;
  onRestart: () => void;
  onToggleSound: () => void;
};

export default function Hud({ state, onRestart, onToggleSound }: HudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 text-white">
      {/* Top right buttons */}
      <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2">
        <button 
          type="button" 
          className="px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg text-sm font-medium transition-all border border-gray-700 hover:border-gray-500"
          onClick={onRestart}
        >
          ↻ Restart
        </button>
        <button 
          type="button" 
          className="px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg text-sm font-medium transition-all border border-gray-700 hover:border-gray-500"
          onClick={onToggleSound}
        >
          {state.muted ? '🔇 Off' : '🔊 On'}
        </button>
      </div>

      {/* Game over screen */}
      {state.status === 'gameover' && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
          {/* Blood splatter effect */}
          <div className="absolute inset-0 opacity-30" style={{
            background: `
              radial-gradient(ellipse at 30% 40%, rgba(139, 0, 0, 0.6) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 60%, rgba(139, 0, 0, 0.5) 0%, transparent 40%),
              radial-gradient(ellipse at 50% 80%, rgba(100, 0, 0, 0.4) 0%, transparent 50%)
            `
          }} />

          <div className="relative z-10 flex flex-col items-center gap-6">
            <div 
              className="text-7xl font-black tracking-tight"
              style={{ 
                textShadow: '0 0 60px rgba(255, 0, 0, 0.8), 0 0 120px rgba(255, 0, 0, 0.4)',
                background: 'linear-gradient(180deg, #ff2222 0%, #880000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              GAME OVER
            </div>

            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-6 border border-red-900/50">
              <div className="grid grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-gray-400 text-sm uppercase">Wave</div>
                  <div className="text-3xl font-bold text-white">{state.wave ?? 1}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm uppercase">Kills</div>
                  <div className="text-3xl font-bold text-red-400">{state.kills}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm uppercase">Score</div>
                  <div className="text-3xl font-bold text-yellow-400">{state.score ?? 0}</div>
                </div>
              </div>
            </div>

            <button 
              type="button" 
              className="mt-4 px-12 py-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-xl font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-red-500/30"
              onClick={onRestart}
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
