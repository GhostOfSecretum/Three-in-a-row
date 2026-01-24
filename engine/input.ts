export type InputState = {
  forward: boolean;  // W
  back: boolean;     // S
  left: boolean;     // A
  right: boolean;    // D
  turnLeft: boolean;
  turnRight: boolean;
  strafe: boolean;
  fire: boolean;     // Left mouse
  use: boolean;      // E
  lookDelta: number;
};

export type ControlKey = Exclude<keyof InputState, 'lookDelta'>;

export function createInputState(): InputState {
  return {
    forward: false,
    back: false,
    left: false,
    right: false,
    turnLeft: false,
    turnRight: false,
    strafe: false,
    fire: false,
    use: false,
    lookDelta: 0,
  };
}

// Маппинг клавиш для top-down shooter
export const KEY_BINDINGS: Record<string, ControlKey> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyE: 'use',
  Space: 'fire',
};
