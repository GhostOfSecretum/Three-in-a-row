import { DoomEngine } from '@/engine/doomEngine';
import { ControlKey } from '@/engine/input';
import { EngineSnapshot } from '@/engine/types';

export type DoomAppHandle = {
  start: () => void;
  stop: () => void;
  destroy: () => void;
  restartLevel: () => void;
  toggleMute: () => void;
  enableAudio: () => void;
  setControl: (control: ControlKey, active: boolean) => void;
  addLookDelta: (delta: number) => void;
  resize: () => void;
};

export type DoomAppOptions = {
  canvas: HTMLCanvasElement;
  onProgress: (progress: number) => void;
  onState: (snapshot: EngineSnapshot) => void;
};

export async function initDoomMiniApp(options: DoomAppOptions): Promise<DoomAppHandle> {
  const engine = new DoomEngine({ canvas: options.canvas, onState: options.onState });
  await engine.load(options.onProgress);
  return {
    start: () => engine.start(),
    stop: () => engine.stop(),
    destroy: () => engine.destroy(),
    restartLevel: () => engine.restartLevel(),
    toggleMute: () => engine.toggleMute(),
    enableAudio: () => engine.enableAudio(),
    setControl: (control, active) => engine.setControl(control, active),
    addLookDelta: delta => engine.addLookDelta(delta),
    resize: () => engine.resize(),
  };
}
