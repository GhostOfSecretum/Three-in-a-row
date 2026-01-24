'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import type { PointerEvent, TouchEvent } from 'react';
import { ControlKey } from '@/engine/input';

type ControlsOverlayProps = {
  onControlChange: (control: ControlKey, active: boolean) => void;
  onJoystickChange?: (x: number, y: number, active: boolean) => void;
  onAimChange?: (screenX: number, screenY: number, active: boolean) => void;
};

// Virtual Joystick Component
function VirtualJoystick({ onJoystickChange }: { onJoystickChange?: (x: number, y: number, active: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const JOYSTICK_SIZE = 120;
  const KNOB_SIZE = 50;
  const MAX_DISTANCE = (JOYSTICK_SIZE - KNOB_SIZE) / 2;

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const container = containerRef.current;
    if (!container) return;
    
    activePointerId.current = e.pointerId;
    container.setPointerCapture(e.pointerId);
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    setOrigin({ x: centerX, y: centerY });
    setIsActive(true);
    
    // Calculate initial position
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let normX = 0;
    let normY = 0;
    
    if (distance > 0) {
      const clampedDistance = Math.min(distance, MAX_DISTANCE);
      normX = (dx / distance) * (clampedDistance / MAX_DISTANCE);
      normY = (dy / distance) * (clampedDistance / MAX_DISTANCE);
      
      setJoystickPos({
        x: (dx / distance) * clampedDistance,
        y: (dy / distance) * clampedDistance,
      });
    }
    
    onJoystickChange?.(normX, normY, true);
  }, [onJoystickChange, MAX_DISTANCE]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let normX = 0;
    let normY = 0;
    
    if (distance > 0) {
      const clampedDistance = Math.min(distance, MAX_DISTANCE);
      normX = (dx / distance) * (clampedDistance / MAX_DISTANCE);
      normY = (dy / distance) * (clampedDistance / MAX_DISTANCE);
      
      setJoystickPos({
        x: (dx / distance) * clampedDistance,
        y: (dy / distance) * clampedDistance,
      });
    } else {
      setJoystickPos({ x: 0, y: 0 });
    }
    
    onJoystickChange?.(normX, normY, true);
  }, [origin, onJoystickChange, MAX_DISTANCE]);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    activePointerId.current = null;
    setIsActive(false);
    setJoystickPos({ x: 0, y: 0 });
    onJoystickChange?.(0, 0, false);
  }, [onJoystickChange]);

  const handlePointerCancel = useCallback(() => {
    activePointerId.current = null;
    setIsActive(false);
    setJoystickPos({ x: 0, y: 0 });
    onJoystickChange?.(0, 0, false);
  }, [onJoystickChange]);

  return (
    <div
      ref={containerRef}
      className="relative touch-none select-none"
      style={{ width: JOYSTICK_SIZE, height: JOYSTICK_SIZE }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-full border-4 transition-all duration-100"
        style={{
          borderColor: isActive ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)',
          backgroundColor: isActive ? 'rgba(50, 50, 50, 0.5)' : 'rgba(30, 30, 30, 0.4)',
        }}
      />
      
      {/* Direction indicators */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute top-2 text-white/30 text-xs font-bold">▲</div>
        <div className="absolute bottom-2 text-white/30 text-xs font-bold">▼</div>
        <div className="absolute left-2 text-white/30 text-xs font-bold">◄</div>
        <div className="absolute right-2 text-white/30 text-xs font-bold">►</div>
      </div>
      
      {/* Knob */}
      <div
        className="absolute rounded-full transition-transform duration-75"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${joystickPos.x}px), calc(-50% + ${joystickPos.y}px))`,
          background: isActive 
            ? 'radial-gradient(circle at 30% 30%, #6ab0ff, #2a5a99)'
            : 'radial-gradient(circle at 30% 30%, #4a90d9, #1a3a69)',
          boxShadow: isActive 
            ? '0 0 20px rgba(106, 176, 255, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.3)'
            : '0 4px 8px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
          border: '3px solid rgba(255, 255, 255, 0.3)',
        }}
      />
    </div>
  );
}

// Aim Zone Component (right side of screen)
function AimZone({ onAimChange }: { onAimChange?: (screenX: number, screenY: number, active: boolean) => void }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [aimPos, setAimPos] = useState<{ x: number; y: number } | null>(null);
  const activePointerId = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const zone = zoneRef.current;
    if (!zone) return;
    
    activePointerId.current = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    
    setAimPos({ x: e.clientX, y: e.clientY });
    onAimChange?.(e.clientX, e.clientY, true);
  }, [onAimChange]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setAimPos({ x: e.clientX, y: e.clientY });
    onAimChange?.(e.clientX, e.clientY, true);
  }, [onAimChange]);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    activePointerId.current = null;
    setAimPos(null);
    onAimChange?.(0, 0, false);
  }, [onAimChange]);

  const handlePointerCancel = useCallback(() => {
    activePointerId.current = null;
    setAimPos(null);
    onAimChange?.(0, 0, false);
  }, [onAimChange]);

  return (
    <div
      ref={zoneRef}
      className="absolute inset-0 touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {/* Visual feedback for aim position */}
      {aimPos && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: aimPos.x,
            top: aimPos.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Outer ring */}
          <div
            className="absolute rounded-full border-2 border-red-500/70 animate-ping"
            style={{
              width: 60,
              height: 60,
              left: -30,
              top: -30,
            }}
          />
          {/* Crosshair */}
          <div className="relative" style={{ width: 40, height: 40, marginLeft: -20, marginTop: -20 }}>
            {/* Horizontal line */}
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500/80 -translate-y-1/2" />
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500/80 -translate-x-1/2" />
            {/* Center dot */}
            <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2" />
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-500/80" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-500/80" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-500/80" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-500/80" />
          </div>
        </div>
      )}
      
      {/* Hint text */}
      {!aimPos && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 text-white/20 text-sm font-medium pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl">🎯</div>
            <div className="text-center">Touch to<br/>aim & shoot</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ControlsOverlay({ onControlChange, onJoystickChange, onAimChange }: ControlsOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 md:hidden">
      {/* Joystick area (left side) */}
      <div className="pointer-events-auto absolute left-4 bottom-28">
        <VirtualJoystick onJoystickChange={onJoystickChange} />
      </div>

      {/* Aim zone (right side - covers most of the right half) */}
      <div 
        className="pointer-events-auto absolute right-0 top-0 bottom-0"
        style={{ width: '55%' }}
      >
        <AimZone onAimChange={onAimChange} />
      </div>

      {/* Mobile hint at bottom */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-500 text-xs text-center">
        Left: Move | Right: Aim & Shoot
      </div>
    </div>
  );
}
