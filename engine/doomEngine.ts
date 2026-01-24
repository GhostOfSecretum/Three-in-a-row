import { loadLevel, LEVEL_COUNT, ParsedLevel } from '@/assets/levels';
import { AudioManager } from '@/engine/audio';
import { createInputState, ControlKey, InputState } from '@/engine/input';
import { EngineSnapshot } from '@/engine/types';
import { loadWasmMath, WasmMath } from '@/engine/wasmMath';

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
  type: 'spark' | 'blood' | 'smoke' | 'shell' | 'gib' | 'explosion';
  rotation: number;
  rotationSpeed: number;
  gravity: number;
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
  
  // Текстуры
  private floorPattern: CanvasPattern | null = null;
  private wallTextures: Map<number, CanvasPattern> = new Map();
  
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
    
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    
    this.createTextures();
  }

  private createTextures() {
    // Создаём текстуру пола
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 64;
    floorCanvas.height = 64;
    const floorCtx = floorCanvas.getContext('2d')!;
    
    // Металлический пол
    const gradient = floorCtx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, '#2a2a3a');
    gradient.addColorStop(0.5, '#1f1f2f');
    gradient.addColorStop(1, '#2a2a3a');
    floorCtx.fillStyle = gradient;
    floorCtx.fillRect(0, 0, 64, 64);
    
    // Добавляем детали
    floorCtx.strokeStyle = '#3a3a4a';
    floorCtx.lineWidth = 1;
    floorCtx.strokeRect(2, 2, 60, 60);
    
    // Болты в углах
    floorCtx.fillStyle = '#4a4a5a';
    floorCtx.beginPath();
    floorCtx.arc(8, 8, 3, 0, Math.PI * 2);
    floorCtx.arc(56, 8, 3, 0, Math.PI * 2);
    floorCtx.arc(8, 56, 3, 0, Math.PI * 2);
    floorCtx.arc(56, 56, 3, 0, Math.PI * 2);
    floorCtx.fill();
    
    // Царапины
    floorCtx.strokeStyle = 'rgba(0,0,0,0.3)';
    floorCtx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x1 = Math.random() * 64;
      const y1 = Math.random() * 64;
      floorCtx.beginPath();
      floorCtx.moveTo(x1, y1);
      floorCtx.lineTo(x1 + Math.random() * 20 - 10, y1 + Math.random() * 20 - 10);
      floorCtx.stroke();
    }
    
    this.floorPattern = this.ctx.createPattern(floorCanvas, 'repeat');
    
    // Создаём текстуры стен
    const wallColors = [
      { base: '#5a4a4a', detail: '#6a5a5a', dark: '#3a2a2a' },
      { base: '#4a5a5a', detail: '#5a6a6a', dark: '#2a3a3a' },
      { base: '#5a5a4a', detail: '#6a6a5a', dark: '#3a3a2a' },
      { base: '#4a4a5a', detail: '#5a5a6a', dark: '#2a2a3a' },
    ];
    
    wallColors.forEach((colors, index) => {
      const wallCanvas = document.createElement('canvas');
      wallCanvas.width = 32;
      wallCanvas.height = 32;
      const wallCtx = wallCanvas.getContext('2d')!;
      
      // Базовый цвет с градиентом
      const wGradient = wallCtx.createLinearGradient(0, 0, 32, 32);
      wGradient.addColorStop(0, colors.base);
      wGradient.addColorStop(1, colors.dark);
      wallCtx.fillStyle = wGradient;
      wallCtx.fillRect(0, 0, 32, 32);
      
      // Кирпичная кладка
      wallCtx.strokeStyle = colors.dark;
      wallCtx.lineWidth = 2;
      wallCtx.strokeRect(1, 1, 30, 30);
      
      wallCtx.strokeStyle = 'rgba(0,0,0,0.4)';
      wallCtx.lineWidth = 1;
      wallCtx.beginPath();
      wallCtx.moveTo(0, 16);
      wallCtx.lineTo(32, 16);
      wallCtx.moveTo(16, 0);
      wallCtx.lineTo(16, 16);
      wallCtx.moveTo(0, 16);
      wallCtx.lineTo(0, 32);
      wallCtx.stroke();
      
      // Подсветка
      wallCtx.strokeStyle = colors.detail;
      wallCtx.beginPath();
      wallCtx.moveTo(1, 31);
      wallCtx.lineTo(1, 1);
      wallCtx.lineTo(31, 1);
      wallCtx.stroke();
      
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
    
    if (this.input.forward) moveY -= 1;
    if (this.input.back) moveY += 1;
    if (this.input.left) moveX -= 1;
    if (this.input.right) moveX += 1;
    
    const isMoving = moveX !== 0 || moveY !== 0;
    
    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
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
    
    this.updatePlayerAngle();
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
  // РЕНДЕРИНГ
  // ============================================================================

  private render() {
    if (!this.level) return;
    
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    // Очистка
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);
    
    ctx.save();
    
    // Screen shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
      ctx.translate(shakeX, shakeY);
    }
    
    ctx.translate(-this.cameraX, -this.cameraY);
    
    this.renderFloor(ctx);
    this.renderDecals(ctx);
    this.renderWalls(ctx);
    this.renderPickups(ctx);
    this.renderEnemies(ctx);
    this.renderBullets(ctx);
    this.renderPlayer(ctx);
    this.renderParticles(ctx);
    this.renderLights(ctx);
    
    ctx.restore();
    
    // Post-processing
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${this.hitFlash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }
    
    // Виньетка
    this.renderVignette(ctx, w, h);
    
    // UI
    this.renderMinimap(ctx, w, h);
    this.renderHUD(ctx, w, h);
  }

  private renderFloor(ctx: CanvasRenderingContext2D) {
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
        }
        
        // Выход
        if (this.level.exitTiles.has(`${x},${y}`)) {
          const px = x * TILE_SIZE;
          const py = y * TILE_SIZE;
          const pulse = Math.sin(this.gameTime * 3) * 0.15 + 0.35;
          ctx.fillStyle = `rgba(0, 255, 100, ${pulse})`;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          
          // Стрелки
          ctx.fillStyle = '#00ff66';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('EXIT', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 5);
        }
      }
    }
  }

  private renderWalls(ctx: CanvasRenderingContext2D) {
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
          
          // 3D эффект - тень снизу и справа
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
          ctx.fillRect(px + TILE_SIZE - 4, py, 4, TILE_SIZE);
          
          // Подсветка сверху и слева
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.fillRect(px, py, TILE_SIZE, 2);
          ctx.fillRect(px, py, 2, TILE_SIZE);
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
    for (const pickup of this.pickups) {
      const bob = Math.sin(this.gameTime * 4 + pickup.bobOffset) * 3;
      const y = pickup.y + bob;
      
      ctx.save();
      ctx.translate(pickup.x, y);
      
      // Свечение
      const glowColor = pickup.type === 'health' ? 'rgba(0, 255, 0, 0.3)' 
                      : pickup.type === 'ammo' ? 'rgba(255, 170, 0, 0.3)' 
                      : 'rgba(0, 170, 255, 0.3)';
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();
      
      // Иконка
      if (pickup.type === 'health') {
        // Аптечка
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = '#00aa00';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
      } else if (pickup.type === 'ammo') {
        // Патроны
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(-8, -10, 16, 20);
        ctx.fillStyle = '#d4a574';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(-4 + i * 4, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Броня
        ctx.fillStyle = '#0088ff';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, -4);
        ctx.lineTo(10, 8);
        ctx.lineTo(0, 14);
        ctx.lineTo(-10, 8);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      
      const angleToPlayer = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      const wobble = Math.sin(enemy.animFrame) * 2;
      
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      
      // Тень
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, enemy.size * 0.7, enemy.size * 0.9, enemy.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Свечение при ударе
      if (enemy.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size + 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Тело врага
      ctx.rotate(angleToPlayer);
      
      // Разные формы для разных типов
      if (enemy.type === 'zombie') {
        // Зомби - гуманоид
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.size * 0.7, enemy.size, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Руки
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : '#2a4a2a';
        ctx.fillRect(enemy.size * 0.5, -4 + wobble, 10, 6);
        ctx.fillRect(enemy.size * 0.5, 2 + wobble, 10, 6);
        
        // Глаза
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(enemy.size * 0.3, -3, 3, 0, Math.PI * 2);
        ctx.arc(enemy.size * 0.3, 3, 3, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (enemy.type === 'runner') {
        // Раннер - насекомое
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.size * 1.2, enemy.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Ноги
        ctx.strokeStyle = enemy.hitFlash > 0 ? '#ffffff' : '#5a3a1a';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const legX = -enemy.size * 0.5 + i * enemy.size * 0.5;
          const legWobble = Math.sin(enemy.animFrame + i) * 4;
          ctx.beginPath();
          ctx.moveTo(legX, -enemy.size * 0.5);
          ctx.lineTo(legX, -enemy.size - 5 + legWobble);
          ctx.moveTo(legX, enemy.size * 0.5);
          ctx.lineTo(legX, enemy.size + 5 - legWobble);
          ctx.stroke();
        }
        
      } else if (enemy.type === 'tank') {
        // Танк - большой
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Броня
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : '#3a3a5a';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // Шипы
        ctx.fillStyle = '#2a2a4a';
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          ctx.save();
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(enemy.size - 2, 0);
          ctx.lineTo(enemy.size + 8, -5);
          ctx.lineTo(enemy.size + 8, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        
      } else if (enemy.type === 'shooter') {
        // Стрелок
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Оружие
        ctx.fillStyle = '#333';
        ctx.fillRect(enemy.size * 0.3, -3, enemy.size, 6);
        
      } else if (enemy.type === 'spitter') {
        // Плевака
        ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Пузыри
        ctx.fillStyle = '#4aff8a';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(enemy.size * 0.4, 0, 5, 0, Math.PI * 2);
        ctx.arc(enemy.size * 0.2, -4, 3, 0, Math.PI * 2);
        ctx.arc(enemy.size * 0.2, 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      ctx.restore();
      
      // Полоска здоровья
      if (enemy.hp < enemy.maxHp) {
        const barWidth = enemy.size * 2;
        const barHeight = 4;
        const barX = enemy.x - barWidth / 2;
        const barY = enemy.y - enemy.size - 12;
        
        ctx.fillStyle = '#111';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const hpPercent = enemy.hp / enemy.maxHp;
        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffaa00' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
      }
    }
  }

  private renderBullets(ctx: CanvasRenderingContext2D) {
    for (const bullet of this.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      
      // След
      const trailLength = bullet.isEnemy ? 15 : 25;
      const gradient = ctx.createLinearGradient(-trailLength, 0, 0, 0);
      
      if (bullet.isEnemy) {
        gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(255, 100, 100, 0.8)');
        ctx.shadowColor = '#ff0000';
      } else {
        gradient.addColorStop(0, 'rgba(255, 200, 0, 0)');
        gradient.addColorStop(1, 'rgba(255, 255, 100, 0.9)');
        ctx.shadowColor = '#ffff00';
      }
      
      ctx.shadowBlur = 8;
      ctx.fillStyle = gradient;
      ctx.fillRect(-trailLength, -bullet.caliber / 2, trailLength, bullet.caliber);
      
      // Пуля
      ctx.fillStyle = bullet.isEnemy ? '#ff6666' : '#ffffaa';
      ctx.beginPath();
      ctx.arc(0, 0, bullet.caliber, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const { x, y, angle } = this.player;
    
    ctx.save();
    ctx.translate(x, y);
    
    // Тень
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, PLAYER_SIZE * 0.6, PLAYER_SIZE * 0.9, PLAYER_SIZE * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Фонарик / луч света
    ctx.save();
    ctx.rotate(angle);
    const flashlightGradient = ctx.createRadialGradient(0, 0, 0, 80, 0, 150);
    flashlightGradient.addColorStop(0, 'rgba(255, 250, 200, 0.15)');
    flashlightGradient.addColorStop(1, 'rgba(255, 250, 200, 0)');
    ctx.fillStyle = flashlightGradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 150, -0.4, 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    ctx.rotate(angle);
    
    // Тело
    const bodyGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, PLAYER_SIZE);
    bodyGradient.addColorStop(0, '#4a90d9');
    bodyGradient.addColorStop(0.7, '#2a5a99');
    bodyGradient.addColorStop(1, '#1a3a69');
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_SIZE, 0, Math.PI * 2);
    ctx.fill();
    
    // Обводка
    ctx.strokeStyle = '#6ab0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Броня (если есть)
    if (this.player.maxHealth > 100) {
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_SIZE + 3, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
    }
    
    // Оружие
    ctx.fillStyle = '#333';
    ctx.fillRect(PLAYER_SIZE * 0.4, -5, 30, 10);
    ctx.fillStyle = '#222';
    ctx.fillRect(PLAYER_SIZE * 0.4 + 25, -4, 12, 8);
    
    // Детали оружия
    ctx.fillStyle = '#444';
    ctx.fillRect(PLAYER_SIZE * 0.4, -3, 5, 6);
    ctx.fillRect(PLAYER_SIZE * 0.4 + 15, -4, 3, 8);
    
    ctx.restore();
    
    // Прицел
    const crosshairDist = 50;
    const cx = x + Math.cos(angle) * crosshairDist;
    const cy = y + Math.sin(angle) * crosshairDist;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    
    // Внешний круг
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.stroke();
    
    // Перекрестие
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 18);
    ctx.stroke();
    
    // Точка в центре
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
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
