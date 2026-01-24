import { loadLevel, LEVEL_COUNT, ParsedLevel } from '@/assets/levels';
import { AudioManager } from '@/engine/audio';
import { createInputState, ControlKey, InputState } from '@/engine/input';
import { EngineSnapshot } from '@/engine/types';
import { loadWasmMath, WasmMath } from '@/engine/wasmMath';
import { AdvancedRenderer, AdvancedParticleSystem, DEFAULT_POST_PROCESS } from '@/engine/advancedRenderer';

// ============================================================================
// ТИПЫ ДЛЯ 2D TOP-DOWN SHOOTER (ALIEN SHOOTER STYLE)
// ============================================================================

type Player = {
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  ammo: number;
  speed: number;
  animFrame: number;
  walkCycle: number;
};

type Bullet = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isEnemy: boolean;
  life: number;
  caliber: number;
};

type EnemyType = 'zombie' | 'runner' | 'tank' | 'shooter' | 'spitter';

type Enemy = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  type: EnemyType;
  speed: number;
  attackCooldown: number;
  attackRange: number;
  damage: number;
  size: number;
  color: string;
  glowColor: string;
  animFrame: number;
  hitFlash: number;
  deathTimer: number;
};

type Pickup = {
  x: number;
  y: number;
  type: 'health' | 'ammo' | 'armor';
  amount: number;
  collected: boolean;
  bobOffset: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'blood' | 'smoke' | 'shell' | 'gib' | 'explosion' | 'ember' | 'dust' | 'electric';
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  glow?: boolean;
  pulseSpeed?: number;
  trail?: { x: number; y: number }[];
};

type Decal = {
  x: number;
  y: number;
  type: 'blood' | 'scorch' | 'crack';
  size: number;
  rotation: number;
  alpha: number;
  color: string;
};

type Light = {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: string;
  life: number;
  maxLife: number;
};

// ============================================================================
// НАСТРОЙКИ ИГРЫ
// ============================================================================

const TILE_SIZE = 32;
const PLAYER_SIZE = 18;
const BULLET_SPEED = 900;
const BULLET_LIFE = 2;
const FIRE_RATE = 0.08;
const WAVE_SPAWN_DELAY = 3;
const MAX_DECALS = 200;
const MAX_PARTICLES = 500;

const ENEMY_TYPES: Record<EnemyType, Omit<Enemy, 'x' | 'y' | 'alive' | 'attackCooldown' | 'animFrame' | 'hitFlash' | 'deathTimer'>> = {
  zombie: {
    hp: 40,
    maxHp: 40,
    type: 'zombie',
    speed: 55,
    attackRange: 28,
    damage: 12,
    size: 16,
    color: '#3d5c3d',
    glowColor: '#1a3a1a',
  },
  runner: {
    hp: 25,
    maxHp: 25,
    type: 'runner',
    speed: 160,
    attackRange: 22,
    damage: 8,
    size: 12,
    color: '#8b5a2b',
    glowColor: '#5a3a1a',
  },
  tank: {
    hp: 150,
    maxHp: 150,
    type: 'tank',
    speed: 30,
    attackRange: 35,
    damage: 30,
    size: 28,
    color: '#4a4a6a',
    glowColor: '#2a2a4a',
  },
  shooter: {
    hp: 50,
    maxHp: 50,
    type: 'shooter',
    speed: 40,
    attackRange: 280,
    damage: 18,
    size: 15,
    color: '#6b3030',
    glowColor: '#4a1a1a',
  },
  spitter: {
    hp: 35,
    maxHp: 35,
    type: 'spitter',
    speed: 50,
    attackRange: 200,
    damage: 25,
    size: 18,
    color: '#2d6b4f',
    glowColor: '#1a4a3a',
  },
};

// ============================================================================
// ГЛАВНЫЙ КЛАСС ДВИЖКА
// ============================================================================

export type DoomEngineOptions = {
  canvas: HTMLCanvasElement;
  onState: (snapshot: EngineSnapshot) => void;
};

export class DoomEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onState: (snapshot: EngineSnapshot) => void;
  private input: InputState = createInputState();
  private audio = new AudioManager();
  private wasmMath: WasmMath | null = null;
  
  // Продвинутый рендерер
  private advRenderer: AdvancedRenderer;
  private advParticles: AdvancedParticleSystem;
  
  // Текстуры
  private floorPattern: CanvasPattern | null = null;
  private wallTextures: Map<number, CanvasPattern> = new Map();
  private floorNormalMap: HTMLCanvasElement | null = null;
  private ambientParticles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];
  
  // Игровое состояние
  private levelIndex = 0;
  private level: ParsedLevel | null = null;
  private player: Player = {
    x: 100,
    y: 100,
    angle: 0,
    health: 100,
    maxHealth: 100,
    ammo: 250,
    speed: 180,
    animFrame: 0,
    walkCycle: 0,
  };
  
  // Сущности
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private decals: Decal[] = [];
  private lights: Light[] = [];
  
  // Статистика
  private kills = 0;
  private wave = 1;
  private score = 0;
  
  // Волновая система
  private waveTimer = 0;
  private enemiesPerWave = 8;
  private waveInProgress = false;
  
  // Таймеры и состояние
  private running = false;
  private status: EngineSnapshot['status'] = 'loading';
  private lastTime = 0;
  private lastFpsTime = 0;
  private frameCount = 0;
  private fps = 0;
  private lastUiUpdate = 0;
  private fireCooldown = 0;
  private hitFlash = 0;
  private rafId = 0;
  private gameTime = 0;
  private screenShake = 0;
  
  // Камера
  private cameraX = 0;
  private cameraY = 0;
  
  // Мышь
  private mouseX = 0;
  private mouseY = 0;

  constructor({ canvas, onState }: DoomEngineOptions) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }
    this.ctx = ctx;
    this.onState = onState;
    
    // Инициализация продвинутого рендерера
    this.advRenderer = new AdvancedRenderer(canvas, {
      bloom: true,
      bloomIntensity: 0.5,
      chromaticAberration: true,
      chromaticIntensity: 1.5,
      filmGrain: true,
      grainIntensity: 0.06,
      vignette: true,
      vignetteIntensity: 0.6,
      scanlines: false,
      fog: true,
      fogDensity: 0.12,
      colorGrading: true,
      contrast: 1.15,
      saturation: 1.2,
      ambientOcclusion: true,
    });
    this.advParticles = new AdvancedParticleSystem(1500);
    
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    this.createTextures();
    this.initAmbientParticles();
  }

  private createTextures() {
    // Создаём продвинутую текстуру пола с нормал-маппингом
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 128;
    floorCanvas.height = 128;
    const floorCtx = floorCanvas.getContext('2d')!;
    
    // Базовый металлический градиент
    const gradient = floorCtx.createRadialGradient(64, 64, 0, 64, 64, 90);
    gradient.addColorStop(0, '#2d2d40');
    gradient.addColorStop(0.5, '#1f1f2f');
    gradient.addColorStop(1, '#252535');
    floorCtx.fillStyle = gradient;
    floorCtx.fillRect(0, 0, 128, 128);
    
    // Сетка плиток с 3D эффектом
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const px = tx * 64;
        const py = ty * 64;
        
        // Тень внутри плитки (имитация углубления)
        const tileGradient = floorCtx.createLinearGradient(px, py, px + 64, py + 64);
        tileGradient.addColorStop(0, 'rgba(255,255,255,0.05)');
        tileGradient.addColorStop(0.3, 'rgba(0,0,0,0)');
        tileGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
        tileGradient.addColorStop(1, 'rgba(0,0,0,0.15)');
        floorCtx.fillStyle = tileGradient;
        floorCtx.fillRect(px + 2, py + 2, 60, 60);
        
        // Рамка плитки
        floorCtx.strokeStyle = '#3a3a4a';
        floorCtx.lineWidth = 2;
        floorCtx.strokeRect(px + 2, py + 2, 60, 60);
        
        // Внутренняя подсветка
        floorCtx.strokeStyle = 'rgba(100, 120, 150, 0.2)';
        floorCtx.lineWidth = 1;
        floorCtx.strokeRect(px + 4, py + 4, 56, 56);
      }
    }
    
    // Болты с 3D эффектом
    const boltPositions = [[12, 12], [116, 12], [12, 116], [116, 116], [64, 64]];
    boltPositions.forEach(([bx, by]) => {
      // Тень болта
      floorCtx.fillStyle = 'rgba(0,0,0,0.4)';
      floorCtx.beginPath();
      floorCtx.arc(bx + 1, by + 1, 5, 0, Math.PI * 2);
      floorCtx.fill();
      
      // Болт с градиентом
      const boltGradient = floorCtx.createRadialGradient(bx - 1, by - 1, 0, bx, by, 5);
      boltGradient.addColorStop(0, '#6a6a7a');
      boltGradient.addColorStop(0.5, '#4a4a5a');
      boltGradient.addColorStop(1, '#3a3a4a');
      floorCtx.fillStyle = boltGradient;
      floorCtx.beginPath();
      floorCtx.arc(bx, by, 4, 0, Math.PI * 2);
      floorCtx.fill();
      
      // Прорезь в болте
      floorCtx.strokeStyle = '#2a2a3a';
      floorCtx.lineWidth = 1.5;
      floorCtx.beginPath();
      floorCtx.moveTo(bx - 2, by);
      floorCtx.lineTo(bx + 2, by);
      floorCtx.stroke();
    });
    
    // Царапины и потёртости
    floorCtx.strokeStyle = 'rgba(0,0,0,0.25)';
    floorCtx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const x1 = Math.random() * 128;
      const y1 = Math.random() * 128;
      const len = 5 + Math.random() * 25;
      const angle = Math.random() * Math.PI * 2;
      floorCtx.beginPath();
      floorCtx.moveTo(x1, y1);
      floorCtx.lineTo(x1 + Math.cos(angle) * len, y1 + Math.sin(angle) * len);
      floorCtx.stroke();
    }
    
    // Добавляем небольшой шум для реалистичности
    const imageData = floorCtx.getImageData(0, 0, 128, 128);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    floorCtx.putImageData(imageData, 0, 0);
    
    this.floorPattern = this.ctx.createPattern(floorCanvas, 'repeat');
    
    // Создаём продвинутые текстуры стен
    const wallStyles = [
      { base: '#5a4a4a', mid: '#6a5a5a', dark: '#3a2a2a', accent: '#7a6060', type: 'brick' },
      { base: '#4a5a5a', mid: '#5a6a6a', dark: '#2a3a3a', accent: '#608080', type: 'metal' },
      { base: '#5a5a4a', mid: '#6a6a5a', dark: '#3a3a2a', accent: '#808060', type: 'concrete' },
      { base: '#4a4a5a', mid: '#5a5a6a', dark: '#2a2a3a', accent: '#606080', type: 'tech' },
    ];
    
    wallStyles.forEach((style, index) => {
      const wallCanvas = document.createElement('canvas');
      wallCanvas.width = 64;
      wallCanvas.height = 64;
      const wallCtx = wallCanvas.getContext('2d')!;
      
      // Базовый градиент с углом для 3D эффекта
      const wGradient = wallCtx.createLinearGradient(0, 0, 64, 64);
      wGradient.addColorStop(0, style.accent);
      wGradient.addColorStop(0.3, style.base);
      wGradient.addColorStop(0.7, style.mid);
      wGradient.addColorStop(1, style.dark);
      wallCtx.fillStyle = wGradient;
      wallCtx.fillRect(0, 0, 64, 64);
      
      if (style.type === 'brick') {
        // Кирпичная кладка
        wallCtx.fillStyle = style.dark;
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 2; col++) {
            const offset = row % 2 === 0 ? 0 : 16;
            const bx = col * 32 + offset;
            const by = row * 16;
            
            // Тень кирпича
            wallCtx.fillStyle = 'rgba(0,0,0,0.3)';
            wallCtx.fillRect(bx + 1, by + 1, 30, 14);
            
            // Кирпич
            const brickGrad = wallCtx.createLinearGradient(bx, by, bx, by + 14);
            brickGrad.addColorStop(0, style.accent);
            brickGrad.addColorStop(0.5, style.base);
            brickGrad.addColorStop(1, style.mid);
            wallCtx.fillStyle = brickGrad;
            wallCtx.fillRect(bx, by, 30, 14);
            
            // Раствор
            wallCtx.strokeStyle = style.dark;
            wallCtx.lineWidth = 2;
            wallCtx.strokeRect(bx, by, 30, 14);
          }
        }
      } else if (style.type === 'metal') {
        // Металлические панели
        wallCtx.strokeStyle = style.dark;
        wallCtx.lineWidth = 3;
        wallCtx.strokeRect(2, 2, 60, 60);
        
        // Заклёпки
        for (let i = 0; i < 4; i++) {
          const rx = 8 + (i % 2) * 48;
          const ry = 8 + Math.floor(i / 2) * 48;
          
          const rivetGrad = wallCtx.createRadialGradient(rx - 1, ry - 1, 0, rx, ry, 4);
          rivetGrad.addColorStop(0, '#888');
          rivetGrad.addColorStop(1, style.dark);
          wallCtx.fillStyle = rivetGrad;
          wallCtx.beginPath();
          wallCtx.arc(rx, ry, 3, 0, Math.PI * 2);
          wallCtx.fill();
        }
        
        // Вертикальные полосы
        wallCtx.strokeStyle = 'rgba(255,255,255,0.1)';
        wallCtx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          wallCtx.beginPath();
          wallCtx.moveTo(i * 16, 4);
          wallCtx.lineTo(i * 16, 60);
          wallCtx.stroke();
        }
      } else if (style.type === 'tech') {
        // Технологичная панель с подсветкой
        wallCtx.strokeStyle = style.dark;
        wallCtx.lineWidth = 2;
        wallCtx.strokeRect(4, 4, 56, 56);
        
        // Светящиеся линии
        wallCtx.strokeStyle = 'rgba(0, 200, 255, 0.3)';
        wallCtx.lineWidth = 2;
        wallCtx.beginPath();
        wallCtx.moveTo(8, 32);
        wallCtx.lineTo(24, 32);
        wallCtx.moveTo(40, 32);
        wallCtx.lineTo(56, 32);
        wallCtx.stroke();
        
        // Центральный индикатор
        const indicatorGrad = wallCtx.createRadialGradient(32, 32, 0, 32, 32, 8);
        indicatorGrad.addColorStop(0, 'rgba(0, 200, 255, 0.5)');
        indicatorGrad.addColorStop(1, 'rgba(0, 100, 200, 0.1)');
        wallCtx.fillStyle = indicatorGrad;
        wallCtx.beginPath();
        wallCtx.arc(32, 32, 6, 0, Math.PI * 2);
        wallCtx.fill();
      } else {
        // Бетон с трещинами
        // Добавляем шум
        const concreteData = wallCtx.getImageData(0, 0, 64, 64);
        const cd = concreteData.data;
        for (let i = 0; i < cd.length; i += 4) {
          const noise = (Math.random() - 0.5) * 15;
          cd[i] = Math.max(0, Math.min(255, cd[i] + noise));
          cd[i + 1] = Math.max(0, Math.min(255, cd[i + 1] + noise));
          cd[i + 2] = Math.max(0, Math.min(255, cd[i + 2] + noise));
        }
        wallCtx.putImageData(concreteData, 0, 0);
        
        // Трещины
        wallCtx.strokeStyle = 'rgba(0,0,0,0.4)';
        wallCtx.lineWidth = 1;
        wallCtx.beginPath();
        wallCtx.moveTo(10, 0);
        wallCtx.lineTo(15, 20);
        wallCtx.lineTo(8, 40);
        wallCtx.lineTo(20, 64);
        wallCtx.stroke();
      }
      
      // Общая подсветка сверху-слева
      wallCtx.fillStyle = 'rgba(255,255,255,0.08)';
      wallCtx.fillRect(0, 0, 64, 3);
      wallCtx.fillRect(0, 0, 3, 64);
      
      // Общая тень снизу-справа
      wallCtx.fillStyle = 'rgba(0,0,0,0.15)';
      wallCtx.fillRect(0, 61, 64, 3);
      wallCtx.fillRect(61, 0, 3, 64);
      
      this.wallTextures.set(index + 1, this.ctx.createPattern(wallCanvas, 'repeat')!);
    });
  }

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.updatePlayerAngle();
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.input.fire = true;
    }
  };

  private handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.input.fire = false;
    }
  };

  private updatePlayerAngle() {
    const screenX = this.player.x - this.cameraX;
    const screenY = this.player.y - this.cameraY;
    this.player.angle = Math.atan2(this.mouseY - screenY, this.mouseX - screenX);
  }

  async load(onProgress: (progress: number) => void) {
    this.status = 'loading';
    onProgress(0.05);
    this.wasmMath = await loadWasmMath();
    onProgress(0.25);
    this.loadLevel(0);
    onProgress(0.6);
    await new Promise(resolve => setTimeout(resolve, 120));
    this.resize();
    onProgress(1);
    this.status = 'ready';
    this.emitState(true);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.status = this.player.health <= 0 ? 'gameover' : 'running';
    this.lastTime = performance.now();
    this.lastFpsTime = this.lastTime;
    this.audio.startMusic();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    this.audio.stopMusic();
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
  }

  enableAudio() {
    this.audio.unlock();
    this.emitState(true);
  }

  toggleMute() {
    this.audio.toggleMute();
    this.emitState(true);
  }

  setControl(control: ControlKey, active: boolean) {
    this.input[control] = active;
  }

  addLookDelta(_delta: number) {}

  setJoystick(x: number, y: number, active: boolean) {
    this.input.joystickX = x;
    this.input.joystickY = y;
    this.input.joystickActive = active;
  }

  setAim(screenX: number, screenY: number, active: boolean) {
    this.input.aimX = screenX;
    this.input.aimY = screenY;
    this.input.aimActive = active;
    this.input.fire = active;
    
    if (active) {
      // Update player angle based on touch position
      const playerScreenX = this.player.x - this.cameraX;
      const playerScreenY = this.player.y - this.cameraY;
      this.player.angle = Math.atan2(screenY - playerScreenY, screenX - playerScreenX);
    }
  }

  restartLevel() {
    this.loadLevel(this.levelIndex);
    this.status = 'running';
    this.emitState(true);
  }

  nextLevel() {
    this.loadLevel((this.levelIndex + 1) % LEVEL_COUNT);
    this.status = 'running';
    this.emitState(true);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.scale(dpr, dpr);
    this.advRenderer.resize();
  }

  private initAmbientParticles() {
    // Пылинки в воздухе для атмосферы
    for (let i = 0; i < 50; i++) {
      this.ambientParticles.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        size: 1 + Math.random() * 2,
        alpha: 0.1 + Math.random() * 0.2,
      });
    }
  }

  private loadLevel(index: number) {
    this.levelIndex = index;
    this.level = loadLevel(index);
    
    this.player = {
      x: this.level.playerStart.x * TILE_SIZE + TILE_SIZE / 2,
      y: this.level.playerStart.y * TILE_SIZE + TILE_SIZE / 2,
      angle: this.level.playerStart.angle,
      health: 100,
      maxHealth: 100,
      ammo: 250,
      speed: 180,
      animFrame: 0,
      walkCycle: 0,
    };
    
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.particles = [];
    this.decals = [];
    this.lights = [];
    
    this.kills = 0;
    this.wave = 1;
    this.score = 0;
    this.waveTimer = 2;
    this.waveInProgress = false;
    this.enemiesPerWave = 8 + index * 4;
    this.gameTime = 0;
    this.screenShake = 0;
    
    this.fireCooldown = 0;
    this.hitFlash = 0;
    
    this.spawnWave();
    this.spawnPickups();
  }

  private spawnWave() {
    if (!this.level) return;
    
    const enemyCount = this.enemiesPerWave + Math.floor(this.wave * 2);
    const types: EnemyType[] = ['zombie', 'zombie', 'zombie', 'runner'];
    
    if (this.wave >= 2) types.push('runner', 'runner', 'zombie');
    if (this.wave >= 3) types.push('tank', 'shooter');
    if (this.wave >= 4) types.push('shooter', 'shooter', 'spitter');
    if (this.wave >= 5) types.push('tank', 'spitter', 'spitter');
    
    for (let i = 0; i < enemyCount; i++) {
      const spawnPos = this.getRandomSpawnPosition();
      if (spawnPos) {
        const type = types[Math.floor(Math.random() * types.length)];
        this.enemies.push(this.createEnemy(spawnPos.x, spawnPos.y, type));
      }
    }
    
    this.waveInProgress = true;
  }

  private createEnemy(x: number, y: number, type: EnemyType): Enemy {
    const template = ENEMY_TYPES[type];
    return {
      ...template,
      x,
      y,
      alive: true,
      attackCooldown: Math.random() * 0.5,
      animFrame: Math.random() * 10,
      hitFlash: 0,
      deathTimer: 0,
    };
  }

  private getRandomSpawnPosition(): { x: number; y: number } | null {
    if (!this.level) return null;
    
    for (let attempt = 0; attempt < 50; attempt++) {
      const x = Math.random() * (this.level.width * TILE_SIZE - TILE_SIZE * 2) + TILE_SIZE;
      const y = Math.random() * (this.level.height * TILE_SIZE - TILE_SIZE * 2) + TILE_SIZE;
      
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      
      if (this.level.tiles[tileY]?.[tileX] === 0) {
        const dist = Math.hypot(x - this.player.x, y - this.player.y);
        if (dist > 250) {
          return { x, y };
        }
      }
    }
    return null;
  }

  private spawnPickups() {
    if (!this.level) return;
    
    for (let i = 0; i < 15; i++) {
      const pos = this.getRandomSpawnPosition();
      if (pos) {
        const rand = Math.random();
        let type: 'health' | 'ammo' | 'armor';
        if (rand < 0.4) type = 'health';
        else if (rand < 0.8) type = 'ammo';
        else type = 'armor';
        
        this.pickups.push({
          x: pos.x,
          y: pos.y,
          type,
          amount: type === 'ammo' ? 50 : 25,
          collected: false,
          bobOffset: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  private loop = (time: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.gameTime += dt;
    this.update(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (!this.level) return;
    
    if (this.player.health <= 0) {
      this.status = 'gameover';
      this.audio.stopMusic();
      this.emitState();
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups();
    this.updateParticles(dt);
    this.updateLights(dt);
    this.updateDecals(dt);
    this.updateWaves(dt);
    this.updateCamera(dt);
    
    this.screenShake = Math.max(0, this.screenShake - dt * 10);
    
    this.updateFps();
    this.emitState();
  }

  private updatePlayer(dt: number) {
    let moveX = 0;
    let moveY = 0;
    
    // Handle joystick input (mobile)
    if (this.input.joystickActive) {
      moveX = this.input.joystickX;
      moveY = this.input.joystickY;
    } else {
      // Handle keyboard input (desktop)
      if (this.input.forward) moveY -= 1;
      if (this.input.back) moveY += 1;
      if (this.input.left) moveX -= 1;
      if (this.input.right) moveX += 1;
    }
    
    const isMoving = moveX !== 0 || moveY !== 0;
    
    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      if (len > 1) {
        moveX /= len;
        moveY /= len;
      }
      this.player.walkCycle += dt * 12;
    }
    
    const newX = this.player.x + moveX * this.player.speed * dt;
    const newY = this.player.y + moveY * this.player.speed * dt;
    
    if (!this.isWall(newX, this.player.y)) {
      this.player.x = newX;
    }
    if (!this.isWall(this.player.x, newY)) {
      this.player.y = newY;
    }
    
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    
    if (this.input.fire && this.fireCooldown <= 0 && this.player.ammo > 0) {
      this.shoot();
      this.fireCooldown = FIRE_RATE;
    }
    
    // Update aim from touch (mobile) or mouse (desktop)
    if (this.input.aimActive) {
      const playerScreenX = this.player.x - this.cameraX;
      const playerScreenY = this.player.y - this.cameraY;
      this.player.angle = Math.atan2(this.input.aimY - playerScreenY, this.input.aimX - playerScreenX);
    } else {
      this.updatePlayerAngle();
    }
  }

  private shoot() {
    this.player.ammo--;
    this.audio.playShot();
    this.screenShake = Math.min(this.screenShake + 0.5, 3);
    
    const spread = (Math.random() - 0.5) * 0.05;
    const angle = this.player.angle + spread;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    this.bullets.push({
      x: this.player.x + cos * 25,
      y: this.player.y + sin * 25,
      vx: cos * BULLET_SPEED,
      vy: sin * BULLET_SPEED,
      damage: 22,
      isEnemy: false,
      life: BULLET_LIFE,
      caliber: 3,
    });
    
    // Дульная вспышка
    this.lights.push({
      x: this.player.x + cos * 30,
      y: this.player.y + sin * 30,
      radius: 80,
      intensity: 1,
      color: '#ffaa00',
      life: 0.05,
      maxLife: 0.05,
    });
    
    // Частицы огня
    for (let i = 0; i < 8; i++) {
      const a = angle + (Math.random() - 0.5) * 0.5;
      this.particles.push({
        x: this.player.x + cos * 28,
        y: this.player.y + sin * 28,
        vx: Math.cos(a) * (200 + Math.random() * 150),
        vy: Math.sin(a) * (200 + Math.random() * 150),
        life: 0.08 + Math.random() * 0.05,
        maxLife: 0.15,
        color: Math.random() > 0.5 ? '#ffcc00' : '#ff6600',
        size: 3 + Math.random() * 3,
        type: 'spark',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 0,
      });
    }
    
    // Гильза
    const shellAngle = this.player.angle + Math.PI / 2;
    this.particles.push({
      x: this.player.x + Math.cos(shellAngle) * 8,
      y: this.player.y + Math.sin(shellAngle) * 8,
      vx: Math.cos(shellAngle) * (80 + Math.random() * 40),
      vy: Math.sin(shellAngle) * (80 + Math.random() * 40) - 50,
      life: 2,
      maxLife: 2,
      color: '#d4a574',
      size: 4,
      type: 'shell',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: 15 + Math.random() * 10,
      gravity: 400,
    });
  }

  private updateBullets(dt: number) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      
      if (this.isWall(bullet.x, bullet.y)) {
        bullet.life = 0;
        this.spawnWallHitEffect(bullet.x, bullet.y);
      }
      
      if (!bullet.isEnemy && bullet.life > 0) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
          if (dist < enemy.size) {
            enemy.hp -= bullet.damage;
            enemy.hitFlash = 0.1;
            bullet.life = 0;
            
            this.spawnBloodEffect(bullet.x, bullet.y, bullet.vx, bullet.vy);
            
            if (enemy.hp <= 0) {
              this.killEnemy(enemy);
            }
            break;
          }
        }
      }
      
      if (bullet.isEnemy && bullet.life > 0) {
        const dist = Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y);
        if (dist < PLAYER_SIZE) {
          this.player.health -= bullet.damage;
          bullet.life = 0;
          this.hitFlash = 0.3;
          this.screenShake = Math.min(this.screenShake + 3, 8);
          this.audio.playHit();
          this.spawnBloodEffect(bullet.x, bullet.y, bullet.vx * 0.3, bullet.vy * 0.3);
        }
      }
    }
    
    this.bullets = this.bullets.filter(b => b.life > 0);
  }

  private spawnWallHitEffect(x: number, y: number) {
    // Искры
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4,
        color: Math.random() > 0.5 ? '#ffcc00' : '#ffffff',
        size: 2 + Math.random() * 2,
        type: 'spark',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 200,
      });
    }
    
    // Трещина на стене
    if (this.decals.length < MAX_DECALS) {
      this.decals.push({
        x, y,
        type: 'crack',
        size: 8 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        alpha: 0.6,
        color: '#222',
      });
    }
    
    // Вспышка
    this.lights.push({
      x, y,
      radius: 40,
      intensity: 0.8,
      color: '#ffaa00',
      life: 0.05,
      maxLife: 0.05,
    });
  }

  private spawnBloodEffect(x: number, y: number, vx: number, vy: number) {
    // Капли крови
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed + vx * 0.3,
        vy: Math.sin(angle) * speed + vy * 0.3,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: Math.random() > 0.3 ? '#8b0000' : '#cc0000',
        size: 3 + Math.random() * 4,
        type: 'blood',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 300,
      });
    }
    
    // Пятно крови на полу
    if (this.decals.length < MAX_DECALS) {
      this.decals.push({
        x, y,
        type: 'blood',
        size: 15 + Math.random() * 20,
        rotation: Math.random() * Math.PI * 2,
        alpha: 0.7,
        color: '#6b0000',
      });
    }
  }

  private killEnemy(enemy: Enemy) {
    enemy.alive = false;
    this.kills++;
    this.score += this.getEnemyScore(enemy.type);
    this.screenShake = Math.min(this.screenShake + 2, 6);
    
    // Взрыв крови
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color: Math.random() > 0.4 ? '#8b0000' : '#550000',
        size: 4 + Math.random() * 6,
        type: 'blood',
        rotation: 0,
        rotationSpeed: 0,
        gravity: 250,
      });
    }
    
    // Куски (gibs)
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      this.particles.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.5 + Math.random() * 1,
        maxLife: 2.5,
        color: enemy.color,
        size: 6 + Math.random() * 8,
        type: 'gib',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: 8 + Math.random() * 8,
        gravity: 350,
      });
    }
    
    // Большое пятно крови
    this.decals.push({
      x: enemy.x, y: enemy.y,
      type: 'blood',
      size: 35 + Math.random() * 25,
      rotation: Math.random() * Math.PI * 2,
      alpha: 0.8,
      color: '#4a0000',
    });
    
    // Шанс дропа
    if (Math.random() < 0.25) {
      const rand = Math.random();
      this.pickups.push({
        x: enemy.x,
        y: enemy.y,
        type: rand < 0.5 ? 'health' : 'ammo',
        amount: 25,
        collected: false,
        bobOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  private getEnemyScore(type: EnemyType): number {
    switch (type) {
      case 'zombie': return 10;
      case 'runner': return 15;
      case 'tank': return 50;
      case 'shooter': return 30;
      case 'spitter': return 25;
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      
      enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.animFrame += dt * 8;
      
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      
      if (enemy.type === 'shooter' || enemy.type === 'spitter') {
        if (dist > 180) {
          this.moveEnemy(enemy, dx, dy, dist, dt);
        } else if (dist < 120) {
          this.moveEnemy(enemy, -dx, -dy, dist, dt);
        }
        
        if (dist < enemy.attackRange && enemy.attackCooldown <= 0) {
          this.enemyShoot(enemy);
          enemy.attackCooldown = enemy.type === 'spitter' ? 2 : 1.2;
        }
      } else {
        if (dist > enemy.attackRange) {
          this.moveEnemy(enemy, dx, dy, dist, dt);
        } else if (enemy.attackCooldown <= 0) {
          this.player.health -= enemy.damage;
          enemy.attackCooldown = 0.8;
          this.hitFlash = 0.3;
          this.screenShake = Math.min(this.screenShake + 2, 6);
          this.audio.playHit();
        }
      }
    }
  }

  private moveEnemy(enemy: Enemy, dx: number, dy: number, dist: number, dt: number) {
    const moveX = (dx / dist) * enemy.speed * dt;
    const moveY = (dy / dist) * enemy.speed * dt;
    
    const newX = enemy.x + moveX;
    const newY = enemy.y + moveY;
    
    if (!this.isWall(newX, enemy.y)) {
      enemy.x = newX;
    }
    if (!this.isWall(enemy.x, newY)) {
      enemy.y = newY;
    }
  }

  private enemyShoot(enemy: Enemy) {
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const spread = (Math.random() - 0.5) * 0.15;
    const finalAngle = angle + spread;
    const cos = Math.cos(finalAngle);
    const sin = Math.sin(finalAngle);
    
    const speed = enemy.type === 'spitter' ? 350 : 450;
    const caliber = enemy.type === 'spitter' ? 6 : 4;
    
    this.bullets.push({
      x: enemy.x + cos * enemy.size,
      y: enemy.y + sin * enemy.size,
      vx: cos * speed,
      vy: sin * speed,
      damage: enemy.damage,
      isEnemy: true,
      life: 3,
      caliber,
    });
    
    // Вспышка
    this.lights.push({
      x: enemy.x + cos * enemy.size,
      y: enemy.y + sin * enemy.size,
      radius: 50,
      intensity: 0.7,
      color: enemy.type === 'spitter' ? '#00ff00' : '#ff4400',
      life: 0.05,
      maxLife: 0.05,
    });
    
    this.audio.playShot();
  }

  private updatePickups() {
    for (const pickup of this.pickups) {
      if (pickup.collected) continue;
      
      const dist = Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y);
      if (dist < 28) {
        pickup.collected = true;
        
        if (pickup.type === 'health') {
          this.player.health = Math.min(this.player.maxHealth, this.player.health + pickup.amount);
        } else if (pickup.type === 'ammo') {
          this.player.ammo += pickup.amount;
        } else {
          this.player.maxHealth = Math.min(150, this.player.maxHealth + 10);
          this.player.health = Math.min(this.player.maxHealth, this.player.health + 10);
        }
        
        // Эффект сбора
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          this.particles.push({
            x: pickup.x, y: pickup.y,
            vx: Math.cos(angle) * 60,
            vy: Math.sin(angle) * 60 - 50,
            life: 0.4,
            maxLife: 0.4,
            color: pickup.type === 'health' ? '#00ff00' : pickup.type === 'ammo' ? '#ffaa00' : '#00aaff',
            size: 4,
            type: 'spark',
            rotation: 0,
            rotationSpeed: 0,
            gravity: -100,
          });
        }
        
        this.audio.playUse();
      }
    }
    
    this.pickups = this.pickups.filter(p => !p.collected);
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rotation += p.rotationSpeed * dt;
      p.life -= dt;
      
      // Трение для некоторых типов
      if (p.type === 'blood' || p.type === 'gib') {
        p.vx *= 0.98;
        p.vy *= 0.98;
      }
      
      // Гильзы оставляют следы при падении
      if (p.type === 'shell' && p.life < 1.8 && Math.random() < 0.1) {
        p.vx *= 0.5;
        p.vy *= 0.5;
        p.gravity = 0;
        p.rotationSpeed = 0;
      }
    }
    
    if (this.particles.length > MAX_PARTICLES) {
      this.particles = this.particles.slice(-MAX_PARTICLES);
    }
    
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private updateLights(dt: number) {
    for (const light of this.lights) {
      light.life -= dt;
      light.intensity = (light.life / light.maxLife) * light.intensity;
    }
    this.lights = this.lights.filter(l => l.life > 0);
  }

  private updateDecals(dt: number) {
    // Медленное затухание декалей
    for (const decal of this.decals) {
      if (decal.type === 'blood') {
        decal.alpha = Math.max(0.2, decal.alpha - dt * 0.02);
      }
    }
    
    if (this.decals.length > MAX_DECALS) {
      this.decals = this.decals.slice(-MAX_DECALS);
    }
  }

  private updateWaves(dt: number) {
    const aliveEnemies = this.enemies.filter(e => e.alive).length;
    
    if (aliveEnemies === 0 && this.waveInProgress) {
      this.waveInProgress = false;
      this.waveTimer = WAVE_SPAWN_DELAY;
    }
    
    if (!this.waveInProgress) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.wave++;
        this.spawnWave();
      }
    }
  }

  private updateCamera(dt: number) {
    const rect = this.canvas.getBoundingClientRect();
    const targetX = this.player.x - rect.width / 2;
    const targetY = this.player.y - rect.height / 2;
    
    this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 8);
    this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 8);
    
    if (this.level) {
      const maxX = this.level.width * TILE_SIZE - rect.width;
      const maxY = this.level.height * TILE_SIZE - rect.height;
      this.cameraX = Math.max(0, Math.min(maxX, this.cameraX));
      this.cameraY = Math.max(0, Math.min(maxY, this.cameraY));
    }
  }

  private isWall(x: number, y: number): boolean {
    if (!this.level) return true;
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    
    if (tileY < 0 || tileY >= this.level.height || tileX < 0 || tileX >= this.level.width) {
      return true;
    }
    
    return this.level.tiles[tileY][tileX] > 0;
  }

  // ============================================================================
  // РЕНДЕРИНГ С ПРОДВИНУТОЙ ГРАФИКОЙ
  // ============================================================================

  private render() {
    if (!this.level) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const dt = 1 / 60; // Approximate dt for effects
    
    // Начало кадра - очистка буферов
    this.advRenderer.beginFrame(dt);
    
    const ctx = this.advRenderer.getSceneContext();
    
    ctx.save();
    
    // Screen shake с улучшенным эффектом
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
      const shakeRot = (Math.random() - 0.5) * this.screenShake * 0.002;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(shakeRot);
      ctx.translate(-w / 2, -h / 2);
      ctx.translate(shakeX, shakeY);
    }
    
    ctx.translate(-this.cameraX, -this.cameraY);
    
    // Рендеринг сцены
    this.renderFloorAdvanced(ctx);
    this.renderAmbientParticles(ctx);
    this.renderDecals(ctx);
    this.renderWallsAdvanced(ctx);
    this.renderPickupsAdvanced(ctx);
    this.renderEnemiesAdvanced(ctx);
    this.renderBulletsAdvanced(ctx);
    this.renderPlayerAdvanced(ctx);
    this.renderParticlesAdvanced(ctx);
    
    // Рендеринг освещения
    this.renderDynamicLighting();
    
    ctx.restore();
    
    // Финализация кадра с post-processing
    this.advRenderer.endFrame();
    
    // Hit flash overlay
    if (this.hitFlash > 0) {
      this.ctx.fillStyle = `rgba(255, 0, 0, ${this.hitFlash * 0.35})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // UI поверх всего
    this.renderMinimapAdvanced(this.ctx, w, h);
    this.renderHUDAdvanced(this.ctx, w, h);
  }

  private renderDynamicLighting() {
    if (!this.level) return;
    
    // Ambient light
    this.advRenderer.addLight(
      this.player.x, 
      this.player.y, 
      250, 
      'rgba(255, 250, 240, 0.15)', 
      0.8
    );
    
    // Player flashlight cone
    const flashlightDist = 300;
    const flashlightX = this.player.x + Math.cos(this.player.angle) * flashlightDist * 0.5;
    const flashlightY = this.player.y + Math.sin(this.player.angle) * flashlightDist * 0.5;
    this.advRenderer.addLight(flashlightX, flashlightY, 200, 'rgba(255, 250, 230, 0.3)', 0.6);
    
    // God rays from flashlight
    this.advRenderer.addGodRays(
      this.player.x + Math.cos(this.player.angle) * 20,
      this.player.y + Math.sin(this.player.angle) * 20,
      this.player.angle,
      250,
      150,
      'rgba(255, 250, 230, 0.1)',
      0.15
    );
    
    // Dynamic lights from effects
    for (const light of this.lights) {
      this.advRenderer.addLight(light.x, light.y, light.radius, light.color, light.intensity);
    }
    
    // Enemy glow lights
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      
      let glowColor = 'rgba(255, 50, 50, 0.15)';
      let glowRadius = 40;
      
      if (enemy.type === 'spitter') {
        glowColor = 'rgba(50, 255, 100, 0.2)';
        glowRadius = 50;
      } else if (enemy.type === 'tank') {
        glowColor = 'rgba(100, 100, 200, 0.15)';
        glowRadius = 60;
      } else if (enemy.type === 'shooter') {
        glowColor = 'rgba(255, 100, 50, 0.15)';
      }
      
      this.advRenderer.addPulsingLight(enemy.x, enemy.y, glowRadius, glowColor, 0.5, 4);
    }
    
    // Pickup glow lights
    for (const pickup of this.pickups) {
      let color = 'rgba(0, 255, 100, 0.3)';
      if (pickup.type === 'ammo') color = 'rgba(255, 200, 50, 0.3)';
      else if (pickup.type === 'armor') color = 'rgba(50, 200, 255, 0.3)';
      
      this.advRenderer.addPulsingLight(pickup.x, pickup.y, 50, color, 0.4, 3);
    }
    
    // Exit lights
    for (const exitKey of this.level.exitTiles) {
      const [ex, ey] = exitKey.split(',').map(Number);
      const px = ex * TILE_SIZE + TILE_SIZE / 2;
      const py = ey * TILE_SIZE + TILE_SIZE / 2;
      this.advRenderer.addPulsingLight(px, py, 80, 'rgba(0, 255, 150, 0.4)', 0.6, 2);
    }
  }

  private renderAmbientParticles(ctx: CanvasRenderingContext2D) {
    // Update and render ambient dust particles
    const rect = this.canvas.getBoundingClientRect();
    
    for (const p of this.ambientParticles) {
      // Move particles
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      
      // Wrap around camera view
      if (p.x < this.cameraX - 50) p.x = this.cameraX + rect.width + 50;
      if (p.x > this.cameraX + rect.width + 50) p.x = this.cameraX - 50;
      if (p.y < this.cameraY - 50) p.y = this.cameraY + rect.height + 50;
      if (p.y > this.cameraY + rect.height + 50) p.y = this.cameraY - 50;
      
      // Render with soft glow
      ctx.save();
      ctx.globalAlpha = p.alpha * (0.5 + Math.sin(this.gameTime * 2 + p.x) * 0.5);
      ctx.fillStyle = '#aabbcc';
      ctx.shadowColor = '#aabbcc';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderFloor(ctx: CanvasRenderingContext2D) {
    this.renderFloorAdvanced(ctx);
  }

  private renderFloorAdvanced(ctx: CanvasRenderingContext2D) {
    if (!this.level || !this.floorPattern) return;
    
    const startTileX = Math.max(0, Math.floor(this.cameraX / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(this.cameraY / TILE_SIZE));
    const rect = this.canvas.getBoundingClientRect();
    const endTileX = Math.min(this.level.width, Math.ceil((this.cameraX + rect.width) / TILE_SIZE) + 1);
    const endTileY = Math.min(this.level.height, Math.ceil((this.cameraY + rect.height) / TILE_SIZE) + 1);
    
    ctx.fillStyle = this.floorPattern;
    
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = this.level.tiles[y]?.[x] ?? 0;
        if (tile === 0) {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          // Добавляем ambient occlusion у стен
          const hasWallAbove = (this.level.tiles[y - 1]?.[x] ?? 1) > 0;
          const hasWallBelow = (this.level.tiles[y + 1]?.[x] ?? 1) > 0;
          const hasWallLeft = (this.level.tiles[y]?.[x - 1] ?? 1) > 0;
          const hasWallRight = (this.level.tiles[y]?.[x + 1] ?? 1) > 0;
          
          if (hasWallAbove || hasWallBelow || hasWallLeft || hasWallRight) {
            const aoGradient = ctx.createRadialGradient(
              px + TILE_SIZE / 2, py + TILE_SIZE / 2, 0,
              px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE
            );
            aoGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            aoGradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
            aoGradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = aoGradient;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = this.floorPattern!;
          }
        }
        
        // Выход с улучшенным эффектом
        if (this.level.exitTiles.has(`${x},${y}`)) {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          
          // Пульсирующее свечение
          const pulse = Math.sin(this.gameTime * 3) * 0.15 + 0.4;
          const pulse2 = Math.sin(this.gameTime * 5 + 1) * 0.1 + 0.3;
          
          // Внешнее свечение
          const glowGradient = ctx.createRadialGradient(
            px + TILE_SIZE / 2, py + TILE_SIZE / 2, 0,
            px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE
          );
          glowGradient.addColorStop(0, `rgba(0, 255, 150, ${pulse})`);
          glowGradient.addColorStop(0.5, `rgba(0, 200, 100, ${pulse2})`);
          glowGradient.addColorStop(1, 'rgba(0, 100, 50, 0.1)');
          ctx.fillStyle = glowGradient;
          ctx.fillRect(px - 5, py - 5, TILE_SIZE + 10, TILE_SIZE + 10);
          
          // Сканирующая линия
          const scanY = ((this.gameTime * 30) % TILE_SIZE);
          ctx.fillStyle = 'rgba(100, 255, 200, 0.4)';
          ctx.fillRect(px, py + scanY, TILE_SIZE, 3);
          
          // Текст EXIT с свечением
          ctx.save();
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#00ff88';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 5);
          ctx.restore();
          
          // Угловые маркеры
          ctx.strokeStyle = `rgba(0, 255, 150, ${pulse})`;
          ctx.lineWidth = 2;
          const cornerSize = 8;
          // Верхний левый
          ctx.beginPath();
          ctx.moveTo(px + cornerSize, py);
          ctx.lineTo(px, py);
          ctx.lineTo(px, py + cornerSize);
          ctx.stroke();
          // Верхний правый
          ctx.beginPath();
          ctx.moveTo(px + TILE_SIZE - cornerSize, py);
          ctx.lineTo(px + TILE_SIZE, py);
          ctx.lineTo(px + TILE_SIZE, py + cornerSize);
          ctx.stroke();
          // Нижний левый
          ctx.beginPath();
          ctx.moveTo(px, py + TILE_SIZE - cornerSize);
          ctx.lineTo(px, py + TILE_SIZE);
          ctx.lineTo(px + cornerSize, py + TILE_SIZE);
          ctx.stroke();
          // Нижний правый
          ctx.beginPath();
          ctx.moveTo(px + TILE_SIZE, py + TILE_SIZE - cornerSize);
          ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE);
          ctx.lineTo(px + TILE_SIZE - cornerSize, py + TILE_SIZE);
          ctx.stroke();
        }
      }
    }
  }

  private renderWalls(ctx: CanvasRenderingContext2D) {
    this.renderWallsAdvanced(ctx);
  }

  private renderWallsAdvanced(ctx: CanvasRenderingContext2D) {
    if (!this.level) return;
    
    const startTileX = Math.max(0, Math.floor(this.cameraX / TILE_SIZE));
    const startTileY = Math.max(0, Math.floor(this.cameraY / TILE_SIZE));
    const rect = this.canvas.getBoundingClientRect();
    const endTileX = Math.min(this.level.width, Math.ceil((this.cameraX + rect.width) / TILE_SIZE) + 1);
    const endTileY = Math.min(this.level.height, Math.ceil((this.cameraY + rect.height) / TILE_SIZE) + 1);
    
    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = this.level.tiles[y]?.[x] ?? 0;
        if (tile > 0) {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          
          // Текстура стены
          const pattern = this.wallTextures.get(tile);
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          }
          
          // Проверяем соседей для определения типа угла/края
          const hasFloorAbove = (this.level.tiles[y - 1]?.[x] ?? 1) === 0;
          const hasFloorBelow = (this.level.tiles[y + 1]?.[x] ?? 1) === 0;
          const hasFloorLeft = (this.level.tiles[y]?.[x - 1] ?? 1) === 0;
          const hasFloorRight = (this.level.tiles[y]?.[x + 1] ?? 1) === 0;
          
          // Улучшенный 3D эффект с градиентными тенями
          if (hasFloorBelow) {
            // Тень на полу снизу стены
            const shadowGradient = ctx.createLinearGradient(px, py + TILE_SIZE, px, py + TILE_SIZE + 20);
            shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
            shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = shadowGradient;
            ctx.fillRect(px, py + TILE_SIZE, TILE_SIZE, 20);
          }
          
          if (hasFloorRight) {
            // Тень на полу справа от стены
            const shadowGradient = ctx.createLinearGradient(px + TILE_SIZE, py, px + TILE_SIZE + 15, py);
            shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
            shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = shadowGradient;
            ctx.fillRect(px + TILE_SIZE, py, 15, TILE_SIZE);
          }
          
          // Внутренняя тень на стене (снизу и справа)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
          ctx.fillRect(px, py + TILE_SIZE - 5, TILE_SIZE, 5);
          ctx.fillRect(px + TILE_SIZE - 5, py, 5, TILE_SIZE);
          
          // Подсветка сверху и слева (свет сверху-слева)
          const highlightGradient = ctx.createLinearGradient(px, py, px + TILE_SIZE * 0.3, py + TILE_SIZE * 0.3);
          highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
          highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = highlightGradient;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.fillRect(px, py, TILE_SIZE, 3);
          ctx.fillRect(px, py, 3, TILE_SIZE);
          
          // Добавляем эффект окклюзии по краям
          if (hasFloorAbove) {
            const edgeGradient = ctx.createLinearGradient(px, py, px, py + 10);
            edgeGradient.addColorStop(0, 'rgba(200, 200, 220, 0.15)');
            edgeGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = edgeGradient;
            ctx.fillRect(px, py, TILE_SIZE, 10);
          }
          
          // Случайные детали на некоторых стенах (трубы, вентиляция)
          if ((x + y) % 7 === 0 && tile === 2) {
            // Вентиляционная решётка
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(px + 8, py + 8, 16, 16);
            ctx.strokeStyle = '#3a3a4a';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(px + 8, py + 10 + i * 4);
              ctx.lineTo(px + 24, py + 10 + i * 4);
              ctx.stroke();
            }
          }
          
          if ((x + y) % 11 === 0 && tile === 4) {
            // Светящийся индикатор на tech-стенах
            const indicatorPulse = Math.sin(this.gameTime * 4 + x * y) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(0, 200, 255, ${indicatorPulse * 0.5})`;
            ctx.beginPath();
            ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(0, 150, 255, ${indicatorPulse})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }
  }

  private renderDecals(ctx: CanvasRenderingContext2D) {
    for (const decal of this.decals) {
      ctx.save();
      ctx.translate(decal.x, decal.y);
      ctx.rotate(decal.rotation);
      ctx.globalAlpha = decal.alpha;
      
      if (decal.type === 'blood') {
        // Пятно крови - несколько кругов
        ctx.fillStyle = decal.color;
        ctx.beginPath();
        ctx.arc(0, 0, decal.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(decal.size * 0.3, decal.size * 0.2, decal.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-decal.size * 0.25, decal.size * 0.15, decal.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (decal.type === 'crack') {
        ctx.strokeStyle = decal.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-decal.size / 2, 0);
        ctx.lineTo(0, -decal.size * 0.3);
        ctx.lineTo(decal.size / 2, 0);
        ctx.lineTo(0, decal.size * 0.3);
        ctx.closePath();
        ctx.stroke();
      } else if (decal.type === 'scorch') {
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, decal.size);
        gradient.addColorStop(0, 'rgba(20, 20, 20, 0.8)');
        gradient.addColorStop(0.5, 'rgba(40, 30, 20, 0.5)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, decal.size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private renderPickups(ctx: CanvasRenderingContext2D) {
    this.renderPickupsAdvanced(ctx);
  }

  private renderPickupsAdvanced(ctx: CanvasRenderingContext2D) {
    for (const pickup of this.pickups) {
      const bob = Math.sin(this.gameTime * 4 + pickup.bobOffset) * 4;
      const wobble = Math.sin(this.gameTime * 2 + pickup.bobOffset) * 0.05;
      const y = pickup.y + bob;
      
      ctx.save();
      ctx.translate(pickup.x, y);
      ctx.rotate(wobble);
      
      // Многослойное свечение
      const glowColors = pickup.type === 'health' 
        ? ['rgba(0, 255, 100, 0.4)', 'rgba(0, 200, 50, 0.2)', 'rgba(100, 255, 150, 0.1)']
        : pickup.type === 'ammo' 
        ? ['rgba(255, 200, 50, 0.4)', 'rgba(255, 150, 0, 0.2)', 'rgba(255, 220, 100, 0.1)']
        : ['rgba(50, 200, 255, 0.4)', 'rgba(0, 150, 255, 0.2)', 'rgba(100, 200, 255, 0.1)'];
      
      // Внешнее мерцающее свечение
      const glowPulse = Math.sin(this.gameTime * 5 + pickup.bobOffset) * 0.3 + 0.7;
      for (let i = 0; i < 3; i++) {
        const radius = 30 + i * 10;
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, glowColors[i]);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = glowPulse;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      
      // Вращающиеся частицы вокруг пикапа
      const particleCount = 4;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + this.gameTime * 3;
        const dist = 18 + Math.sin(this.gameTime * 6 + i) * 3;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist;
        const psize = 2 + Math.sin(this.gameTime * 8 + i) * 1;
        
        ctx.fillStyle = glowColors[0];
        ctx.beginPath();
        ctx.arc(px, py, psize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Тень под пикапом
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 15 - bob * 0.5, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Иконка с улучшенным рендерингом
      ctx.shadowColor = glowColors[0];
      ctx.shadowBlur = 10;
      
      if (pickup.type === 'health') {
        // Аптечка с градиентом
        const boxGrad = ctx.createLinearGradient(-10, -10, 10, 10);
        boxGrad.addColorStop(0, '#ffffff');
        boxGrad.addColorStop(1, '#cccccc');
        ctx.fillStyle = boxGrad;
        ctx.fillRect(-11, -11, 22, 22);
        
        const crossGrad = ctx.createLinearGradient(-8, -8, 8, 8);
        crossGrad.addColorStop(0, '#00dd00');
        crossGrad.addColorStop(1, '#008800');
        ctx.fillStyle = crossGrad;
        ctx.fillRect(-9, -9, 18, 18);
        
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 5;
        ctx.fillRect(-7, -2, 14, 4);
        ctx.fillRect(-2, -7, 4, 14);
        
      } else if (pickup.type === 'ammo') {
        // Патроны с деталями
        const boxGrad = ctx.createLinearGradient(-8, -10, 8, 10);
        boxGrad.addColorStop(0, '#a08060');
        boxGrad.addColorStop(1, '#604020');
        ctx.fillStyle = boxGrad;
        ctx.fillRect(-9, -11, 18, 22);
        
        // Надпись AMMO
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 6px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('AMMO', 0, -4);
        
        // Патроны
        for (let i = 0; i < 3; i++) {
          const bulletGrad = ctx.createLinearGradient(-4 + i * 4, -2, -4 + i * 4, 6);
          bulletGrad.addColorStop(0, '#ffdd88');
          bulletGrad.addColorStop(0.3, '#ddaa66');
          bulletGrad.addColorStop(1, '#996633');
          ctx.fillStyle = bulletGrad;
          ctx.beginPath();
          ctx.arc(-4 + i * 4, 3, 3, 0, Math.PI * 2);
          ctx.fill();
          // Наконечник
          ctx.fillStyle = '#cc8844';
          ctx.beginPath();
          ctx.arc(-4 + i * 4, 0, 2, Math.PI, 0);
          ctx.fill();
        }
        
      } else {
        // Броня с металлическим эффектом
        const armorGrad = ctx.createLinearGradient(-10, -12, 10, 14);
        armorGrad.addColorStop(0, '#00ccff');
        armorGrad.addColorStop(0.3, '#0088ff');
        armorGrad.addColorStop(0.7, '#0066cc');
        armorGrad.addColorStop(1, '#004488');
        ctx.fillStyle = armorGrad;
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(11, -5);
        ctx.lineTo(11, 9);
        ctx.lineTo(0, 15);
        ctx.lineTo(-11, 9);
        ctx.lineTo(-11, -5);
        ctx.closePath();
        ctx.fill();
        
        // Блик
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(8, -4);
        ctx.lineTo(0, 2);
        ctx.lineTo(-6, -4);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#00eeff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Индикатор в центре
        const indicatorPulse = Math.sin(this.gameTime * 6) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${indicatorPulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    this.renderEnemiesAdvanced(ctx);
  }

  private renderEnemiesAdvanced(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      
      const angleToPlayer = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      const wobble = Math.sin(enemy.animFrame) * 2;
      const breathe = Math.sin(enemy.animFrame * 0.5) * 0.05 + 1;
      
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      
      // Улучшенная тень с размытием
      const shadowScale = 1 + Math.sin(enemy.animFrame * 0.3) * 0.1;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(3, enemy.size * 0.8, enemy.size * shadowScale, enemy.size * 0.35, 0.2, 0, Math.PI * 2);
      ctx.fill();
      
      // Aura/glow effect based on enemy type
      if (enemy.hitFlash <= 0) {
        const auraGradient = ctx.createRadialGradient(0, 0, enemy.size * 0.5, 0, 0, enemy.size * 1.5);
        auraGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        auraGradient.addColorStop(0.7, enemy.glowColor.replace(')', ', 0.2)').replace('rgb', 'rgba'));
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = auraGradient;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Свечение при ударе - улучшенное
      if (enemy.hitFlash > 0) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = `rgba(255, 255, 255, ${enemy.hitFlash * 4})`;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      // Тело врага
      ctx.rotate(angleToPlayer);
      ctx.scale(breathe, breathe);
      
      // Разные формы для разных типов
      if (enemy.type === 'zombie') {
        // Зомби - гуманоид с детализацией
        const bodyGrad = ctx.createRadialGradient(-enemy.size * 0.2, 0, 0, 0, 0, enemy.size);
        bodyGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#4a6a4a');
        bodyGrad.addColorStop(0.7, enemy.hitFlash > 0 ? '#ffffff' : enemy.color);
        bodyGrad.addColorStop(1, enemy.hitFlash > 0 ? '#dddddd' : '#1a3a1a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.size * 0.7, enemy.size, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Детали тела - шрамы
        ctx.strokeStyle = '#2a3a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-enemy.size * 0.3, -enemy.size * 0.5);
        ctx.lineTo(-enemy.size * 0.1, -enemy.size * 0.2);
        ctx.stroke();
        
        // Руки с анимацией
        const armGrad = ctx.createLinearGradient(enemy.size * 0.5, 0, enemy.size * 0.5 + 10, 0);
        armGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#3a5a3a');
        armGrad.addColorStop(1, enemy.hitFlash > 0 ? '#dddddd' : '#2a4a2a');
        ctx.fillStyle = armGrad;
        ctx.fillRect(enemy.size * 0.5, -5 + wobble, 12, 7);
        ctx.fillRect(enemy.size * 0.5, 1 + wobble * 0.8, 12, 7);
        
        // Когти
        ctx.fillStyle = '#1a1a1a';
        for (let i = 0; i < 2; i++) {
          const armY = i === 0 ? -5 + wobble : 1 + wobble * 0.8;
          for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.moveTo(enemy.size * 0.5 + 12, armY + j * 2 + 1);
            ctx.lineTo(enemy.size * 0.5 + 16, armY + j * 2);
            ctx.lineTo(enemy.size * 0.5 + 12, armY + j * 2 + 2);
            ctx.fill();
          }
        }
        
        // Глаза со свечением
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(enemy.size * 0.35, -4, 3, 0, Math.PI * 2);
        ctx.arc(enemy.size * 0.35, 4, 3, 0, Math.PI * 2);
        ctx.fill();
        // Зрачки
        ctx.fillStyle = '#880000';
        ctx.beginPath();
        ctx.arc(enemy.size * 0.38, -4, 1.5, 0, Math.PI * 2);
        ctx.arc(enemy.size * 0.38, 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
      } else if (enemy.type === 'runner') {
        // Раннер - насекомое с улучшенной детализацией
        const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.size);
        bodyGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#a07040');
        bodyGrad.addColorStop(1, enemy.hitFlash > 0 ? '#dddddd' : enemy.color);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.size * 1.2, enemy.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Сегменты тела
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(-enemy.size * 0.4 + i * enemy.size * 0.4, 0, 2, enemy.size * 0.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Ноги с суставами
        ctx.strokeStyle = enemy.hitFlash > 0 ? '#ffffff' : '#5a3a1a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const legX = -enemy.size * 0.5 + i * enemy.size * 0.5;
          const legWobble = Math.sin(enemy.animFrame * 2 + i * 2) * 6;
          
          // Верхняя нога
          ctx.beginPath();
          ctx.moveTo(legX, -enemy.size * 0.4);
          ctx.lineTo(legX - 3, -enemy.size - 2 + legWobble);
          ctx.lineTo(legX, -enemy.size - 8 + legWobble);
          ctx.stroke();
          
          // Нижняя нога
          ctx.beginPath();
          ctx.moveTo(legX, enemy.size * 0.4);
          ctx.lineTo(legX - 3, enemy.size + 2 - legWobble);
          ctx.lineTo(legX, enemy.size + 8 - legWobble);
          ctx.stroke();
        }
        
        // Глаза (множественные как у насекомого)
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(enemy.size * 0.7, -3 + i * 2, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        
      } else if (enemy.type === 'tank') {
        // Танк - большой бронированный
        // Внешняя броня
        const outerGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, enemy.size);
        outerGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#6a6a8a');
        outerGrad.addColorStop(0.5, enemy.hitFlash > 0 ? '#eeeeee' : enemy.color);
        outerGrad.addColorStop(1, enemy.hitFlash > 0 ? '#cccccc' : '#2a2a4a');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Внутренняя часть
        const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, enemy.size * 0.7);
        innerGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#5a5a7a');
        innerGrad.addColorStop(1, enemy.hitFlash > 0 ? '#dddddd' : '#3a3a5a');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // Бронепластины с 3D эффектом
        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        
        // Шипы с градиентом
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + this.gameTime * 0.5;
          ctx.save();
          ctx.rotate(angle);
          
          const spikeGrad = ctx.createLinearGradient(enemy.size - 2, 0, enemy.size + 10, 0);
          spikeGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#4a4a6a');
          spikeGrad.addColorStop(1, enemy.hitFlash > 0 ? '#aaaaaa' : '#1a1a3a');
          ctx.fillStyle = spikeGrad;
          ctx.beginPath();
          ctx.moveTo(enemy.size - 2, 0);
          ctx.lineTo(enemy.size + 10, -6);
          ctx.lineTo(enemy.size + 10, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        
        // Глаз в центре
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(enemy.size * 0.3, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.size * 0.35, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
      } else if (enemy.type === 'shooter') {
        // Стрелок с улучшенными деталями
        const bodyGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, enemy.size);
        bodyGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#8a4040');
        bodyGrad.addColorStop(0.7, enemy.hitFlash > 0 ? '#eeeeee' : enemy.color);
        bodyGrad.addColorStop(1, enemy.hitFlash > 0 ? '#cccccc' : '#4a1a1a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Оружие с деталями
        ctx.fillStyle = '#222';
        ctx.fillRect(enemy.size * 0.3, -4, enemy.size + 5, 8);
        ctx.fillStyle = '#444';
        ctx.fillRect(enemy.size * 0.3, -3, 5, 6);
        ctx.fillRect(enemy.size * 0.6, -2, 3, 4);
        
        // Дуло оружия с подсветкой
        const muzzlePulse = Math.sin(this.gameTime * 10) * 0.3 + 0.3;
        ctx.fillStyle = `rgba(255, 100, 50, ${muzzlePulse})`;
        ctx.beginPath();
        ctx.arc(enemy.size + enemy.size * 0.3 + 5, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Прицельный визор
        ctx.fillStyle = '#ff4400';
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.rect(enemy.size * 0.2, -2, 8, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        
      } else if (enemy.type === 'spitter') {
        // Плевака с кислотной детализацией
        const bodyGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, enemy.size);
        bodyGrad.addColorStop(0, enemy.hitFlash > 0 ? '#ffffff' : '#4a8a6a');
        bodyGrad.addColorStop(0.6, enemy.hitFlash > 0 ? '#eeeeee' : enemy.color);
        bodyGrad.addColorStop(1, enemy.hitFlash > 0 ? '#cccccc' : '#1a4a3a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Токсичные пузыри с анимацией
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        for (let i = 0; i < 5; i++) {
          const bubbleX = Math.cos(i * 1.2 + this.gameTime * 2) * enemy.size * 0.4;
          const bubbleY = Math.sin(i * 1.5 + this.gameTime * 2) * enemy.size * 0.4;
          const bubbleSize = 3 + Math.sin(this.gameTime * 4 + i) * 2;
          const bubbleAlpha = 0.4 + Math.sin(this.gameTime * 3 + i) * 0.2;
          
          ctx.fillStyle = `rgba(100, 255, 150, ${bubbleAlpha})`;
          ctx.beginPath();
          ctx.arc(bubbleX, bubbleY, bubbleSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // "Пасть" спереди
        ctx.fillStyle = '#1a3a2a';
        ctx.beginPath();
        ctx.ellipse(enemy.size * 0.6, 0, 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00ff66';
        ctx.beginPath();
        ctx.ellipse(enemy.size * 0.6, 0, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      ctx.restore();
      
      // Улучшенная полоска здоровья
      if (enemy.hp < enemy.maxHp) {
        const barWidth = enemy.size * 2.2;
        const barHeight = 5;
        const barX = enemy.x - barWidth / 2;
        const barY = enemy.y - enemy.size - 15;
        
        // Тень под баром
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX - 1, barY + 2, barWidth + 2, barHeight);
        
        // Фон
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const hpPercent = enemy.hp / enemy.maxHp;
        
        // Градиент для здоровья
        const hpGradient = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
        if (hpPercent > 0.5) {
          hpGradient.addColorStop(0, '#66ff66');
          hpGradient.addColorStop(1, '#00aa00');
        } else if (hpPercent > 0.25) {
          hpGradient.addColorStop(0, '#ffdd66');
          hpGradient.addColorStop(1, '#cc8800');
        } else {
          hpGradient.addColorStop(0, '#ff6666');
          hpGradient.addColorStop(1, '#aa0000');
        }
        ctx.fillStyle = hpGradient;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
        
        // Блик на баре
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(barX, barY, barWidth * hpPercent, 2);
      }
    }
  }

  private renderBullets(ctx: CanvasRenderingContext2D) {
    this.renderBulletsAdvanced(ctx);
  }

  private renderBulletsAdvanced(ctx: CanvasRenderingContext2D) {
    for (const bullet of this.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      const speed = Math.hypot(bullet.vx, bullet.vy);
      
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      
      // Улучшенный след с несколькими слоями
      const trailLength = bullet.isEnemy ? 20 : 35;
      const trailWidth = bullet.caliber * 1.5;
      
      if (bullet.isEnemy) {
        // Вражеская пуля - красная/зелёная (для spitter)
        const isAcid = bullet.caliber > 5;
        
        // Внешнее свечение
        ctx.shadowColor = isAcid ? '#00ff88' : '#ff4400';
        ctx.shadowBlur = 15;
        
        // Градиентный след
        const trailGrad = ctx.createLinearGradient(-trailLength, 0, 5, 0);
        if (isAcid) {
          trailGrad.addColorStop(0, 'rgba(0, 100, 50, 0)');
          trailGrad.addColorStop(0.5, 'rgba(50, 255, 150, 0.4)');
          trailGrad.addColorStop(1, 'rgba(100, 255, 200, 0.9)');
        } else {
          trailGrad.addColorStop(0, 'rgba(100, 0, 0, 0)');
          trailGrad.addColorStop(0.5, 'rgba(255, 100, 50, 0.5)');
          trailGrad.addColorStop(1, 'rgba(255, 150, 100, 0.9)');
        }
        ctx.fillStyle = trailGrad;
        
        // След с заострённой формой
        ctx.beginPath();
        ctx.moveTo(-trailLength, 0);
        ctx.lineTo(-trailLength * 0.3, -trailWidth * 0.3);
        ctx.lineTo(bullet.caliber, -bullet.caliber * 0.5);
        ctx.lineTo(bullet.caliber + 3, 0);
        ctx.lineTo(bullet.caliber, bullet.caliber * 0.5);
        ctx.lineTo(-trailLength * 0.3, trailWidth * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // Ядро пули
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, bullet.caliber);
        if (isAcid) {
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.4, '#88ffbb');
          coreGrad.addColorStop(1, '#22aa66');
        } else {
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.4, '#ffaa88');
          coreGrad.addColorStop(1, '#ff4422');
        }
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, bullet.caliber, 0, Math.PI * 2);
        ctx.fill();
        
      } else {
        // Пуля игрока - жёлтая/оранжевая
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12;
        
        // Многослойный след
        for (let layer = 0; layer < 3; layer++) {
          const layerLength = trailLength * (1 - layer * 0.25);
          const layerWidth = trailWidth * (1 - layer * 0.2);
          const alpha = 0.3 + layer * 0.2;
          
          const trailGrad = ctx.createLinearGradient(-layerLength, 0, 5, 0);
          trailGrad.addColorStop(0, `rgba(255, 150, 0, 0)`);
          trailGrad.addColorStop(0.3, `rgba(255, 200, 50, ${alpha * 0.5})`);
          trailGrad.addColorStop(0.7, `rgba(255, 230, 100, ${alpha})`);
          trailGrad.addColorStop(1, `rgba(255, 255, 200, ${alpha})`);
          ctx.fillStyle = trailGrad;
          
          ctx.beginPath();
          ctx.moveTo(-layerLength, 0);
          ctx.quadraticCurveTo(-layerLength * 0.5, -layerWidth * 0.5, bullet.caliber, -bullet.caliber * 0.3);
          ctx.lineTo(bullet.caliber + 2, 0);
          ctx.lineTo(bullet.caliber, bullet.caliber * 0.3);
          ctx.quadraticCurveTo(-layerLength * 0.5, layerWidth * 0.5, -layerLength, 0);
          ctx.fill();
        }
        
        // Ядро пули с ярким свечением
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, bullet.caliber * 1.2);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.3, '#ffffcc');
        coreGrad.addColorStop(0.6, '#ffcc66');
        coreGrad.addColorStop(1, '#ff8800');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, bullet.caliber, 0, Math.PI * 2);
        ctx.fill();
        
        // Яркое ядро
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-1, -1, bullet.caliber * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    this.renderPlayerAdvanced(ctx);
  }

  private renderPlayerAdvanced(ctx: CanvasRenderingContext2D) {
    const { x, y, angle } = this.player;
    const isMoving = this.input.forward || this.input.back || this.input.left || this.input.right || this.input.joystickActive;
    const bobAmount = isMoving ? Math.sin(this.player.walkCycle) * 2 : 0;
    
    ctx.save();
    ctx.translate(x, y + bobAmount);
    
    // Улучшенная тень с размытием
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(3, PLAYER_SIZE * 0.7 - bobAmount, PLAYER_SIZE * 0.95, PLAYER_SIZE * 0.35, 0.15, 0, Math.PI * 2);
    ctx.fill();
    
    // Фонарик / луч света - улучшенный
    ctx.save();
    ctx.rotate(angle);
    
    // Основной конус света
    const flashlightGradient = ctx.createRadialGradient(100, 0, 0, 100, 0, 200);
    flashlightGradient.addColorStop(0, 'rgba(255, 250, 220, 0.2)');
    flashlightGradient.addColorStop(0.5, 'rgba(255, 245, 200, 0.08)');
    flashlightGradient.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = flashlightGradient;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.arc(0, 0, 200, -0.35, 0.35);
    ctx.closePath();
    ctx.fill();
    
    // Центральный яркий луч
    const centerBeam = ctx.createLinearGradient(0, 0, 180, 0);
    centerBeam.addColorStop(0, 'rgba(255, 255, 240, 0.15)');
    centerBeam.addColorStop(0.5, 'rgba(255, 255, 230, 0.05)');
    centerBeam.addColorStop(1, 'rgba(255, 255, 220, 0)');
    ctx.fillStyle = centerBeam;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(180, -15);
    ctx.lineTo(180, 15);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    ctx.rotate(angle);
    
    // Броневой щит (если есть) - с анимированным эффектом
    if (this.player.maxHealth > 100) {
      const shieldPulse = Math.sin(this.gameTime * 4) * 0.2 + 0.8;
      const shieldHealth = (this.player.maxHealth - 100) / 50; // 0 to 1
      
      // Внешний энергетический щит
      ctx.strokeStyle = `rgba(0, 200, 255, ${shieldPulse * 0.6 * shieldHealth})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_SIZE + 5, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      
      // Гексагональные сегменты щита
      ctx.strokeStyle = `rgba(100, 220, 255, ${shieldPulse * 0.3 * shieldHealth})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const segAngle = -Math.PI * 0.35 + i * (Math.PI * 0.7 / 5);
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_SIZE + 5, segAngle, segAngle + Math.PI * 0.12);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    
    // Тело с улучшенным градиентом
    const bodyGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, PLAYER_SIZE);
    bodyGradient.addColorStop(0, '#6ab0ff');
    bodyGradient.addColorStop(0.4, '#4a90d9');
    bodyGradient.addColorStop(0.7, '#2a5a99');
    bodyGradient.addColorStop(1, '#1a3a69');
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();
    
    // Обводка с свечением
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 5;
    ctx.strokeStyle = '#7ac0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Детали брони на теле
    ctx.fillStyle = '#3a6a99';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_SIZE * 0.6, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#5a8ab9';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Индикатор здоровья на броне
    const healthPercent = this.player.health / this.player.maxHealth;
    const healthColor = healthPercent > 0.5 ? '#00ff88' : healthPercent > 0.25 ? '#ffcc00' : '#ff4444';
    ctx.fillStyle = healthColor;
    ctx.shadowColor = healthColor;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(0, -PLAYER_SIZE * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Оружие с улучшенными деталями
    // Основа оружия
    const gunGrad = ctx.createLinearGradient(PLAYER_SIZE * 0.4, -5, PLAYER_SIZE * 0.4 + 35, 5);
    gunGrad.addColorStop(0, '#444');
    gunGrad.addColorStop(0.3, '#333');
    gunGrad.addColorStop(0.7, '#222');
    gunGrad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gunGrad;
    ctx.fillRect(PLAYER_SIZE * 0.4, -6, 32, 12);
    
    // Ствол
    const barrelGrad = ctx.createLinearGradient(PLAYER_SIZE * 0.4 + 27, 0, PLAYER_SIZE * 0.4 + 42, 0);
    barrelGrad.addColorStop(0, '#333');
    barrelGrad.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(PLAYER_SIZE * 0.4 + 27, -4, 15, 8);
    
    // Детали оружия
    ctx.fillStyle = '#555';
    ctx.fillRect(PLAYER_SIZE * 0.4, -4, 6, 8);
    ctx.fillRect(PLAYER_SIZE * 0.4 + 10, -5, 4, 10);
    ctx.fillRect(PLAYER_SIZE * 0.4 + 20, -3, 3, 6);
    
    // Тактический фонарь на оружии
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.ellipse(PLAYER_SIZE * 0.4 + 18, 6, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 220, 0.8)';
    ctx.beginPath();
    ctx.ellipse(PLAYER_SIZE * 0.4 + 18, 6, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Дуло - свечение при стрельбе
    if (this.fireCooldown > FIRE_RATE * 0.5) {
      const muzzleFlash = (this.fireCooldown - FIRE_RATE * 0.5) / (FIRE_RATE * 0.5);
      ctx.fillStyle = `rgba(255, 200, 50, ${muzzleFlash})`;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(PLAYER_SIZE * 0.4 + 42, 0, 6 + muzzleFlash * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
    
    // Улучшенный прицел
    const crosshairDist = 55;
    const cx = x + Math.cos(angle) * crosshairDist;
    const cy = y + Math.sin(angle) * crosshairDist;
    const spread = this.fireCooldown > 0 ? 3 : 0;
    
    ctx.save();
    
    // Внешнее свечение прицела
    ctx.shadowColor = 'rgba(255, 100, 100, 0.5)';
    ctx.shadowBlur = 8;
    
    // Внешний круг с динамическим размером
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 14 + spread, 0, Math.PI * 2);
    ctx.stroke();
    
    // Перекрестие с зазорами
    ctx.beginPath();
    ctx.moveTo(cx - 22 - spread, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 22 + spread, cy);
    ctx.moveTo(cx, cy - 22 - spread);
    ctx.lineTo(cx, cy - 8);
    ctx.moveTo(cx, cy + 8);
    ctx.lineTo(cx, cy + 22 + spread);
    ctx.stroke();
    
    // Угловые элементы
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    const cornerDist = 10 + spread;
    const cornerSize = 4;
    ctx.beginPath();
    // Верхний левый
    ctx.moveTo(cx - cornerDist, cy - cornerDist + cornerSize);
    ctx.lineTo(cx - cornerDist, cy - cornerDist);
    ctx.lineTo(cx - cornerDist + cornerSize, cy - cornerDist);
    // Верхний правый
    ctx.moveTo(cx + cornerDist - cornerSize, cy - cornerDist);
    ctx.lineTo(cx + cornerDist, cy - cornerDist);
    ctx.lineTo(cx + cornerDist, cy - cornerDist + cornerSize);
    // Нижний правый
    ctx.moveTo(cx + cornerDist, cy + cornerDist - cornerSize);
    ctx.lineTo(cx + cornerDist, cy + cornerDist);
    ctx.lineTo(cx + cornerDist - cornerSize, cy + cornerDist);
    // Нижний левый
    ctx.moveTo(cx - cornerDist + cornerSize, cy + cornerDist);
    ctx.lineTo(cx - cornerDist, cy + cornerDist);
    ctx.lineTo(cx - cornerDist, cy + cornerDist - cornerSize);
    ctx.stroke();
    
    // Центральная точка с пульсацией
    const dotPulse = Math.sin(this.gameTime * 8) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 50, 50, ${dotPulse})`;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / p.maxLife);
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;
      
      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (p.type === 'blood') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
        
      } else if (p.type === 'shell') {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.fillStyle = '#b8956e';
        ctx.beginPath();
        ctx.arc(p.size / 2 - 1, 0, p.size / 4, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (p.type === 'gib') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size / 2, 0);
        ctx.lineTo(0, -p.size / 2);
        ctx.lineTo(p.size / 2, 0);
        ctx.lineTo(0, p.size / 2);
        ctx.closePath();
        ctx.fill();
        
      } else if (p.type === 'smoke') {
        ctx.fillStyle = `rgba(100, 100, 100, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (2 - alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private renderLights(ctx: CanvasRenderingContext2D) {
    ctx.globalCompositeOperation = 'lighter';
    
    for (const light of this.lights) {
      const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
      gradient.addColorStop(0, light.color);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.globalAlpha = light.intensity;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  private renderMinimap(ctx: CanvasRenderingContext2D, w: number, _h: number) {
    if (!this.level) return;
    
    const mapSize = 140;
    const mapX = w - mapSize - 15;
    const mapY = 15;
    const scale = mapSize / Math.max(this.level.width, this.level.height);
    
    // Фон
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mapX - 8, mapY - 8, mapSize + 16, mapSize + 16, 8);
    ctx.fill();
    ctx.stroke();
    
    // Карта
    for (let y = 0; y < this.level.height; y++) {
      for (let x = 0; x < this.level.width; x++) {
        const tile = this.level.tiles[y][x];
        ctx.fillStyle = tile > 0 ? '#555' : '#222';
        ctx.fillRect(mapX + x * scale, mapY + y * scale, scale + 0.5, scale + 0.5);
      }
    }
    
    // Враги
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(mapX + (enemy.x / TILE_SIZE) * scale, mapY + (enemy.y / TILE_SIZE) * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Пикапы
    for (const pickup of this.pickups) {
      ctx.fillStyle = pickup.type === 'health' ? '#00ff00' : pickup.type === 'ammo' ? '#ffaa00' : '#00aaff';
      ctx.beginPath();
      ctx.arc(mapX + (pickup.x / TILE_SIZE) * scale, mapY + (pickup.y / TILE_SIZE) * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Игрок
    ctx.fillStyle = '#00ff00';
    const px = mapX + (this.player.x / TILE_SIZE) * scale;
    const py = mapY + (this.player.y / TILE_SIZE) * scale;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Направление взгляда
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(this.player.angle) * 10, py + Math.sin(this.player.angle) * 10);
    ctx.stroke();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, w: number, h: number) {
    // Полоса здоровья
    const healthBarWidth = 220;
    const healthBarHeight = 22;
    const healthX = 20;
    const healthY = h - 55;
    
    // Фон полоски
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(healthX - 5, healthY - 5, healthBarWidth + 10, healthBarHeight + 10, 6);
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(healthX, healthY, healthBarWidth, healthBarHeight);
    
    const healthPercent = this.player.health / this.player.maxHealth;
    
    // Градиент здоровья
    const healthGradient = ctx.createLinearGradient(healthX, healthY, healthX, healthY + healthBarHeight);
    if (healthPercent > 0.5) {
      healthGradient.addColorStop(0, '#44ff44');
      healthGradient.addColorStop(1, '#22aa22');
    } else if (healthPercent > 0.25) {
      healthGradient.addColorStop(0, '#ffcc00');
      healthGradient.addColorStop(1, '#cc9900');
    } else {
      healthGradient.addColorStop(0, '#ff4444');
      healthGradient.addColorStop(1, '#aa2222');
    }
    ctx.fillStyle = healthGradient;
    ctx.fillRect(healthX, healthY, healthBarWidth * healthPercent, healthBarHeight);
    
    // Текст здоровья
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.player.health)} / ${this.player.maxHealth}`, healthX + healthBarWidth / 2, healthY + healthBarHeight - 5);
    
    // Иконка здоровья
    ctx.fillStyle = '#ff4444';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('❤', healthX - 2, healthY - 10);
    
    // Патроны
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(15, h - 95, 110, 35, 6);
    ctx.fill();
    
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`🔫 ${this.player.ammo}`, 25, h - 68);
    
    // Статистика слева сверху
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(15, 15, 150, 85, 8);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`WAVE ${this.wave}`, 25, 40);
    
    ctx.fillStyle = '#ff6666';
    ctx.font = '16px Arial';
    ctx.fillText(`Kills: ${this.kills}`, 25, 62);
    
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`Score: ${this.score}`, 25, 84);
    
    // Следующая волна
    if (!this.waveInProgress && this.waveTimer > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 120, 80, 240, 50, 10);
      ctx.fill();
      
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`WAVE ${this.wave + 1} IN ${Math.ceil(this.waveTimer)}`, w / 2, 115);
    }
    
    // FPS
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`FPS: ${this.fps}`, w - 20, h - 10);
  }

  private updateFps() {
    if (!this.wasmMath) return;
    this.frameCount = this.wasmMath.add(this.frameCount, 1);
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  private emitState(force = false) {
    const now = performance.now();
    if (!force && now - this.lastUiUpdate < 120) return;
    this.lastUiUpdate = now;
    this.onState({
      level: this.levelIndex + 1,
      levelName: this.level?.name ?? 'Unknown',
      health: Math.round(this.player.health),
      ammo: this.player.ammo,
      kills: this.kills,
      fps: this.fps,
      soundEnabled: this.audio.isUnlocked(),
      muted: this.audio.isMuted(),
      status: this.status,
      wave: this.wave,
      score: this.score,
    });
  }
}
