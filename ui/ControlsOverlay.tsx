'use client';

import type { PointerEvent } from 'react';
import { ControlKey } from '@/engine/input';

type HoldButtonProps = {
  label: string;
  control: ControlKey;
  onChange: (control: ControlKey, active: boolean) => void;
  className?: string;
};

function HoldButton({ label, control, onChange, className }: HoldButtonProps) {
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(control, true);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    onChange(control, false);
  };

  const handlePointerCancel = () => {
    onChange(control, false);
  };

  return (
    <button
      type="button"
      className={`w-14 h-14 bg-gray-800/60 hover:bg-gray-700/80 active:bg-red-600/80 rounded-lg text-white font-bold text-xl transition-all select-none ${className ?? ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      aria-label={label}
    >
      {label}
    </button>
  );
}

type ControlsOverlayProps = {
  onControlChange: (control: ControlKey, active: boolean) => void;
};

export default function ControlsOverlay({ onControlChange }: ControlsOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Mobile D-pad for movement */}
      <div className="pointer-events-auto absolute left-4 bottom-24 flex flex-col items-center gap-1 md:hidden">
        <HoldButton label="W" control="forward" onChange={onControlChange} />
        <div className="flex gap-1">
          <HoldButton label="A" control="left" onChange={onControlChange} />
          <HoldButton label="S" control="back" onChange={onControlChange} />
          <HoldButton label="D" control="right" onChange={onControlChange} />
        </div>
      </div>

      {/* Mobile fire button */}
      <div className="pointer-events-auto absolute right-4 bottom-24 md:hidden">
        <HoldButton 
          label="🔫" 
          control="fire" 
          onChange={onControlChange} 
          className="w-20 h-20 bg-red-600/60 hover:bg-red-500/80 active:bg-red-400/90"
        />
      </div>

      {/* Desktop hint */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-500 text-xs hidden md:block">
        WASD to move | Mouse to aim | Click to shoot
      </div>
    </div>
  );
}
