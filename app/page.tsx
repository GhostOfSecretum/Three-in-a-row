'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { initDoomMiniApp, DoomAppHandle } from '@/main';
import { ControlKey } from '@/engine/input';
import { EngineSnapshot } from '@/engine/types';
import ControlsOverlay from '@/ui/ControlsOverlay';
import Hud from '@/ui/Hud';
import LoadingOverlay from '@/ui/LoadingOverlay';
import StartOverlay from '@/ui/StartOverlay';

const initialState: EngineSnapshot = {
  level: 1,
  levelName: 'Boot',
  health: 100,
  ammo: 200,
  kills: 0,
  fps: 0,
  soundEnabled: false,
  muted: true,
  status: 'loading',
  wave: 1,
  score: 0,
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<DoomAppHandle | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<EngineSnapshot>(initialState);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!canvasRef.current) return;
      const app = await initDoomMiniApp({
        canvas: canvasRef.current,
        onProgress: value => active && setProgress(value),
        onState: snapshot => active && setState(snapshot),
      });
      appRef.current = app;
      if (active) {
        setReady(true);
        setProgress(1);
      }
    };
    void init();
    return () => {
      active = false;
      appRef.current?.destroy();
      appRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => appRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const setControl = (control: ControlKey, active: boolean) => {
      if (!started) return;
      appRef.current?.setControl(control, active);
      if (active) {
        appRef.current?.enableAudio();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          setControl('forward', true);
          break;
        case 'KeyS':
        case 'ArrowDown':
          setControl('back', true);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setControl('left', true);
          break;
        case 'KeyD':
        case 'ArrowRight':
          setControl('right', true);
          break;
        case 'Space':
          setControl('fire', true);
          event.preventDefault();
          break;
        case 'KeyE':
          setControl('use', true);
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          setControl('forward', false);
          break;
        case 'KeyS':
        case 'ArrowDown':
          setControl('back', false);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          setControl('left', false);
          break;
        case 'KeyD':
        case 'ArrowRight':
          setControl('right', false);
          break;
        case 'Space':
          setControl('fire', false);
          break;
        case 'KeyE':
          setControl('use', false);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [started]);

  const handleStart = useCallback(() => {
    appRef.current?.enableAudio();
    appRef.current?.start();
    setStarted(true);
  }, []);

  const handleRestart = useCallback(() => {
    appRef.current?.restartLevel();
  }, []);

  const handleToggleSound = useCallback(() => {
    appRef.current?.toggleMute();
  }, []);

  const handleControlChange = useCallback((control: ControlKey, active: boolean) => {
    if (!started) return;
    appRef.current?.setControl(control, active);
    if (active) {
      appRef.current?.enableAudio();
    }
  }, [started]);

  const handleJoystickChange = useCallback((x: number, y: number, active: boolean) => {
    // Debug log
    console.log('Joystick:', { x: x.toFixed(2), y: y.toFixed(2), active });
    appRef.current?.setJoystick(x, y, active);
    if (active) {
      appRef.current?.enableAudio();
    }
  }, []);

  const handleAimChange = useCallback((screenX: number, screenY: number, active: boolean) => {
    if (!started) return;
    appRef.current?.setAim(screenX, screenY, active);
    if (active) {
      appRef.current?.enableAudio();
    }
  }, [started]);

  return (
    <main className="doom-root">
      <canvas ref={canvasRef} className="doom-canvas" />

      {!ready && <LoadingOverlay progress={progress} />}
      {ready && !started && <StartOverlay onStart={handleStart} />}
      {ready && started && (
        <>
          <Hud state={state} onRestart={handleRestart} onToggleSound={handleToggleSound} />
          <ControlsOverlay 
            onControlChange={handleControlChange}
            onJoystickChange={handleJoystickChange}
            onAimChange={handleAimChange}
          />
        </>
      )}
    </main>
  );
}
