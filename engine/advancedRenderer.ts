// ============================================================================
// ADVANCED GRAPHICS RENDERER - Продвинутая система рендеринга
// ============================================================================

export type PostProcessSettings = {
  bloom: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  chromaticAberration: boolean;
  chromaticIntensity: number;
  filmGrain: boolean;
  grainIntensity: number;
  vignette: boolean;
  vignetteIntensity: number;
  scanlines: boolean;
  scanlineIntensity: number;
  colorGrading: boolean;
  contrast: number;
  saturation: number;
  ambientOcclusion: boolean;
  fog: boolean;
  fogDensity: number;
  fogColor: string;
};

export const DEFAULT_POST_PROCESS: PostProcessSettings = {
  bloom: true,
  bloomIntensity: 0.6,
  bloomThreshold: 0.7,
  chromaticAberration: true,
  chromaticIntensity: 2,
  filmGrain: true,
  grainIntensity: 0.08,
  vignette: true,
  vignetteIntensity: 0.7,
  scanlines: false,
  scanlineIntensity: 0.15,
  colorGrading: true,
  contrast: 1.1,
  saturation: 1.15,
  ambientOcclusion: true,
  fog: true,
  fogDensity: 0.15,
  fogColor: 'rgba(10, 15, 25, 0.3)',
};

export class AdvancedRenderer {
  private mainCanvas: HTMLCanvasElement;
  private mainCtx: CanvasRenderingContext2D;
  
  // Offscreen buffers for post-processing
  private sceneBuffer: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private lightBuffer: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private bloomBuffer: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private shadowBuffer: HTMLCanvasElement;
  private shadowCtx: CanvasRenderingContext2D;
  
  private settings: PostProcessSettings;
  private time = 0;
  
  // Noise texture for film grain
  private noiseData: ImageData | null = null;
  
  constructor(canvas: HTMLCanvasElement, settings: Partial<PostProcessSettings> = {}) {
    this.mainCanvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.mainCtx = ctx;
    
    this.settings = { ...DEFAULT_POST_PROCESS, ...settings };
    
    // Create offscreen buffers
    this.sceneBuffer = document.createElement('canvas');
    this.sceneCtx = this.sceneBuffer.getContext('2d', { alpha: false })!;
    
    this.lightBuffer = document.createElement('canvas');
    this.lightCtx = this.lightBuffer.getContext('2d', { alpha: true })!;
    
    this.bloomBuffer = document.createElement('canvas');
    this.bloomCtx = this.bloomBuffer.getContext('2d', { alpha: true })!;
    
    this.shadowBuffer = document.createElement('canvas');
    this.shadowCtx = this.shadowBuffer.getContext('2d', { alpha: true })!;
    
    this.resize();
    this.generateNoiseTexture();
  }
  
  resize() {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    
    this.sceneBuffer.width = w;
    this.sceneBuffer.height = h;
    
    this.lightBuffer.width = w;
    this.lightBuffer.height = h;
    
    // Bloom at half resolution for performance
    this.bloomBuffer.width = Math.floor(w / 2);
    this.bloomBuffer.height = Math.floor(h / 2);
    
    this.shadowBuffer.width = w;
    this.shadowBuffer.height = h;
    
    this.generateNoiseTexture();
  }
  
  private generateNoiseTexture() {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    if (w === 0 || h === 0) return;
    
    this.noiseData = this.mainCtx.createImageData(w, h);
    const data = this.noiseData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = Math.random() * 255;
      data[i] = noise;
      data[i + 1] = noise;
      data[i + 2] = noise;
      data[i + 3] = 255;
    }
  }
  
  getSceneContext(): CanvasRenderingContext2D {
    return this.sceneCtx;
  }
  
  getLightContext(): CanvasRenderingContext2D {
    return this.lightCtx;
  }
  
  getShadowContext(): CanvasRenderingContext2D {
    return this.shadowCtx;
  }
  
  getSettings(): PostProcessSettings {
    return this.settings;
  }
  
  updateSettings(settings: Partial<PostProcessSettings>) {
    this.settings = { ...this.settings, ...settings };
  }
  
  beginFrame(dt: number) {
    this.time += dt;
    
    // Clear all buffers
    const w = this.sceneBuffer.width;
    const h = this.sceneBuffer.height;
    
    this.sceneCtx.fillStyle = '#0a0a12';
    this.sceneCtx.fillRect(0, 0, w, h);
    
    this.lightCtx.clearRect(0, 0, w, h);
    this.shadowCtx.clearRect(0, 0, w, h);
  }
  
  // ============================================================================
  // DYNAMIC LIGHTING SYSTEM
  // ============================================================================
  
  addLight(x: number, y: number, radius: number, color: string, intensity: number = 1) {
    const ctx = this.lightCtx;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = intensity;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, this.adjustColorAlpha(color, 0.6));
    gradient.addColorStop(0.6, this.adjustColorAlpha(color, 0.2));
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
  
  addFlickeringLight(x: number, y: number, radius: number, color: string, intensity: number = 1) {
    const flicker = 0.8 + Math.sin(this.time * 15) * 0.1 + Math.random() * 0.1;
    this.addLight(x, y, radius * flicker, color, intensity * flicker);
  }
  
  addPulsingLight(x: number, y: number, radius: number, color: string, intensity: number = 1, speed: number = 3) {
    const pulse = 0.7 + Math.sin(this.time * speed) * 0.3;
    this.addLight(x, y, radius * pulse, color, intensity * pulse);
  }
  
  // Volumetric light rays (god rays)
  addGodRays(x: number, y: number, angle: number, length: number, width: number, color: string, intensity: number = 0.3) {
    const ctx = this.lightCtx;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = intensity;
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, this.adjustColorAlpha(color, 0.5));
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, -width / 2);
    ctx.lineTo(length, width / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
  
  // ============================================================================
  // SHADOW SYSTEM
  // ============================================================================
  
  castShadow(
    lightX: number, 
    lightY: number, 
    objectX: number, 
    objectY: number, 
    objectWidth: number, 
    objectHeight: number,
    shadowLength: number = 100
  ) {
    const ctx = this.shadowCtx;
    const dx = objectX - lightX;
    const dy = objectY - lightY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    
    const angle = Math.atan2(dy, dx);
    const shadowDir = shadowLength / dist;
    
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    
    // Calculate shadow polygon
    const corners = [
      { x: objectX - objectWidth / 2, y: objectY - objectHeight / 2 },
      { x: objectX + objectWidth / 2, y: objectY - objectHeight / 2 },
      { x: objectX + objectWidth / 2, y: objectY + objectHeight / 2 },
      { x: objectX - objectWidth / 2, y: objectY + objectHeight / 2 },
    ];
    
    // Find the two corners furthest from light
    corners.sort((a, b) => {
      const distA = Math.hypot(a.x - lightX, a.y - lightY);
      const distB = Math.hypot(b.x - lightX, b.y - lightY);
      return distB - distA;
    });
    
    const farCorner1 = corners[0];
    const farCorner2 = corners[1];
    
    ctx.beginPath();
    ctx.moveTo(farCorner1.x, farCorner1.y);
    ctx.lineTo(farCorner1.x + (farCorner1.x - lightX) * shadowDir, 
               farCorner1.y + (farCorner1.y - lightY) * shadowDir);
    ctx.lineTo(farCorner2.x + (farCorner2.x - lightX) * shadowDir, 
               farCorner2.y + (farCorner2.y - lightY) * shadowDir);
    ctx.lineTo(farCorner2.x, farCorner2.y);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
  
  // ============================================================================
  // AMBIENT OCCLUSION
  // ============================================================================
  
  addAmbientOcclusion(x: number, y: number, radius: number) {
    if (!this.settings.ambientOcclusion) return;
    
    const ctx = this.shadowCtx;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // ============================================================================
  // POST-PROCESSING
  // ============================================================================
  
  endFrame() {
    const w = this.mainCanvas.width;
    const h = this.mainCanvas.height;
    const rect = this.mainCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Start with scene
    this.mainCtx.drawImage(this.sceneBuffer, 0, 0);
    
    // Apply shadows
    this.mainCtx.globalCompositeOperation = 'multiply';
    this.mainCtx.drawImage(this.shadowBuffer, 0, 0);
    this.mainCtx.globalCompositeOperation = 'source-over';
    
    // Apply lighting
    this.mainCtx.globalCompositeOperation = 'lighter';
    this.mainCtx.drawImage(this.lightBuffer, 0, 0);
    this.mainCtx.globalCompositeOperation = 'source-over';
    
    // Apply fog
    if (this.settings.fog) {
      this.applyFog(w, h);
    }
    
    // Apply bloom
    if (this.settings.bloom) {
      this.applyBloom(w, h);
    }
    
    // Apply chromatic aberration
    if (this.settings.chromaticAberration) {
      this.applyChromaticAberration(w, h);
    }
    
    // Apply color grading
    if (this.settings.colorGrading) {
      this.applyColorGrading(w, h);
    }
    
    // Apply film grain
    if (this.settings.filmGrain) {
      this.applyFilmGrain(w, h);
    }
    
    // Apply scanlines
    if (this.settings.scanlines) {
      this.applyScanlines(w, h, rect.height);
    }
    
    // Apply vignette
    if (this.settings.vignette) {
      this.applyVignette(w, h, rect.width, rect.height);
    }
  }
  
  private applyBloom(w: number, h: number) {
    const bw = this.bloomBuffer.width;
    const bh = this.bloomBuffer.height;
    
    // Extract bright areas to bloom buffer
    this.bloomCtx.drawImage(this.mainCanvas, 0, 0, bw, bh);
    
    // Apply threshold and blur (simplified gaussian blur)
    this.bloomCtx.filter = `blur(${8}px) brightness(${this.settings.bloomIntensity + 0.5})`;
    this.bloomCtx.drawImage(this.bloomBuffer, 0, 0);
    this.bloomCtx.filter = 'none';
    
    // Second pass blur
    this.bloomCtx.filter = `blur(${12}px)`;
    this.bloomCtx.drawImage(this.bloomBuffer, 0, 0);
    this.bloomCtx.filter = 'none';
    
    // Composite bloom back to main
    this.mainCtx.globalCompositeOperation = 'screen';
    this.mainCtx.globalAlpha = this.settings.bloomIntensity;
    this.mainCtx.drawImage(this.bloomBuffer, 0, 0, w, h);
    this.mainCtx.globalAlpha = 1;
    this.mainCtx.globalCompositeOperation = 'source-over';
  }
  
  private applyChromaticAberration(w: number, h: number) {
    const intensity = this.settings.chromaticIntensity;
    
    // Store current frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(this.mainCanvas, 0, 0);
    
    // Red channel offset
    this.mainCtx.globalCompositeOperation = 'multiply';
    this.mainCtx.fillStyle = 'rgb(255, 0, 0)';
    this.mainCtx.fillRect(0, 0, w, h);
    
    // Apply offset
    this.mainCtx.globalCompositeOperation = 'lighter';
    this.mainCtx.drawImage(tempCanvas, -intensity, 0);
    
    // Green channel (centered)
    tempCtx.globalCompositeOperation = 'multiply';
    tempCtx.fillStyle = 'rgb(0, 255, 0)';
    tempCtx.fillRect(0, 0, w, h);
    this.mainCtx.drawImage(tempCanvas, 0, 0);
    
    // Blue channel offset
    tempCtx.globalCompositeOperation = 'source-over';
    tempCtx.drawImage(this.mainCanvas, intensity, 0);
    tempCtx.globalCompositeOperation = 'multiply';
    tempCtx.fillStyle = 'rgb(0, 0, 255)';
    tempCtx.fillRect(0, 0, w, h);
    this.mainCtx.drawImage(tempCanvas, 0, 0);
    
    this.mainCtx.globalCompositeOperation = 'source-over';
  }
  
  private applyFilmGrain(w: number, h: number) {
    if (!this.noiseData || this.noiseData.width !== w || this.noiseData.height !== h) {
      this.generateNoiseTexture();
    }
    if (!this.noiseData) return;
    
    // Animate noise
    const data = this.noiseData.data;
    const offset = Math.floor(this.time * 1000) % 256;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (data[i] + offset) % 256;
      data[i] = noise;
      data[i + 1] = noise;
      data[i + 2] = noise;
    }
    
    // Create temporary canvas for noise
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = w;
    noiseCanvas.height = h;
    const noiseCtx = noiseCanvas.getContext('2d')!;
    noiseCtx.putImageData(this.noiseData, 0, 0);
    
    // Apply noise overlay
    this.mainCtx.globalCompositeOperation = 'overlay';
    this.mainCtx.globalAlpha = this.settings.grainIntensity;
    this.mainCtx.drawImage(noiseCanvas, 0, 0);
    this.mainCtx.globalAlpha = 1;
    this.mainCtx.globalCompositeOperation = 'source-over';
  }
  
  private applyScanlines(w: number, h: number, displayHeight: number) {
    const lineSpacing = 3;
    
    this.mainCtx.fillStyle = `rgba(0, 0, 0, ${this.settings.scanlineIntensity})`;
    
    for (let y = 0; y < h; y += lineSpacing) {
      this.mainCtx.fillRect(0, y, w, 1);
    }
  }
  
  private applyVignette(w: number, h: number, displayWidth: number, displayHeight: number) {
    const gradient = this.mainCtx.createRadialGradient(
      w / 2, h / 2, w * 0.2,
      w / 2, h / 2, w * 0.9
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, `rgba(0, 0, 0, ${this.settings.vignetteIntensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${this.settings.vignetteIntensity})`);
    
    this.mainCtx.fillStyle = gradient;
    this.mainCtx.fillRect(0, 0, w, h);
  }
  
  private applyFog(w: number, h: number) {
    const density = this.settings.fogDensity;
    
    // Animated fog using perlin-like noise
    const fogTime = this.time * 0.3;
    
    this.mainCtx.save();
    this.mainCtx.globalAlpha = density;
    
    // Multiple fog layers for depth
    for (let layer = 0; layer < 3; layer++) {
      const layerOffset = layer * 0.3;
      const gradient = this.mainCtx.createRadialGradient(
        w / 2 + Math.sin(fogTime + layerOffset) * 100,
        h / 2 + Math.cos(fogTime * 0.7 + layerOffset) * 50,
        0,
        w / 2,
        h / 2,
        w * 0.8
      );
      
      gradient.addColorStop(0, 'rgba(30, 40, 60, 0.3)');
      gradient.addColorStop(0.5, 'rgba(20, 30, 50, 0.15)');
      gradient.addColorStop(1, 'rgba(10, 15, 25, 0)');
      
      this.mainCtx.fillStyle = gradient;
      this.mainCtx.fillRect(0, 0, w, h);
    }
    
    this.mainCtx.restore();
  }
  
  private applyColorGrading(w: number, h: number) {
    // Apply contrast and saturation using CSS filters
    this.mainCtx.filter = `contrast(${this.settings.contrast}) saturate(${this.settings.saturation})`;
    this.mainCtx.drawImage(this.mainCanvas, 0, 0);
    this.mainCtx.filter = 'none';
  }
  
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  private adjustColorAlpha(color: string, alpha: number): string {
    // Parse hex or rgb color and adjust alpha
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (color.startsWith('rgba(')) {
      return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }
    return color;
  }
  
  // ============================================================================
  // SPECIAL EFFECTS
  // ============================================================================
  
  // Electric arc effect
  drawLightningArc(x1: number, y1: number, x2: number, y2: number, segments: number = 8, intensity: number = 1) {
    const ctx = this.sceneCtx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / dist;
    const perpY = dx / dist;
    
    const points: { x: number; y: number }[] = [{ x: x1, y: y1 }];
    
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = (Math.random() - 0.5) * dist * 0.2;
      points.push({
        x: x1 + dx * t + perpX * jitter,
        y: y1 + dy * t + perpY * jitter,
      });
    }
    points.push({ x: x2, y: y2 });
    
    // Draw glow
    ctx.save();
    ctx.strokeStyle = `rgba(100, 150, 255, ${0.3 * intensity})`;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur = 20;
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    
    // Draw core
    ctx.strokeStyle = `rgba(200, 220, 255, ${intensity})`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.stroke();
    
    ctx.restore();
    
    // Add light at midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    this.addLight(midX, midY, dist * 0.4, 'rgba(100, 150, 255, 0.5)', intensity * 0.5);
  }
  
  // Explosion effect
  drawExplosion(x: number, y: number, radius: number, progress: number) {
    const ctx = this.sceneCtx;
    const currentRadius = radius * progress;
    const alpha = 1 - progress;
    
    ctx.save();
    
    // Outer glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
    gradient.addColorStop(0, `rgba(255, 200, 100, ${alpha})`);
    gradient.addColorStop(0.3, `rgba(255, 100, 50, ${alpha * 0.8})`);
    gradient.addColorStop(0.6, `rgba(200, 50, 0, ${alpha * 0.4})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Core
    const coreRadius = currentRadius * 0.3 * (1 - progress);
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    coreGradient.addColorStop(1, `rgba(255, 200, 100, ${alpha * 0.5})`);
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Add dynamic light
    this.addLight(x, y, currentRadius * 1.5, 'rgba(255, 150, 50, 0.8)', alpha);
  }
  
  // Fire effect
  drawFire(x: number, y: number, width: number, height: number, intensity: number = 1) {
    const ctx = this.sceneCtx;
    const time = this.time;
    
    ctx.save();
    
    for (let i = 0; i < 5; i++) {
      const flameX = x + Math.sin(time * 8 + i) * width * 0.2;
      const flameY = y - i * height * 0.15;
      const flameWidth = width * (1 - i * 0.15);
      const flameHeight = height * (1 - i * 0.1);
      const alpha = intensity * (1 - i * 0.15);
      
      const gradient = ctx.createRadialGradient(
        flameX, flameY + flameHeight * 0.5, 0,
        flameX, flameY, flameHeight
      );
      
      if (i < 2) {
        gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
        gradient.addColorStop(0.4, `rgba(255, 200, 50, ${alpha * 0.8})`);
        gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
      } else {
        gradient.addColorStop(0, `rgba(255, 150, 50, ${alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(200, 50, 0, ${alpha * 0.4})`);
        gradient.addColorStop(1, 'rgba(100, 0, 0, 0)');
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(flameX, flameY, flameWidth, flameHeight, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // Add flickering light
    this.addFlickeringLight(x, y, width * 3, 'rgba(255, 150, 50, 0.6)', intensity);
  }
  
  // Energy shield effect
  drawEnergyShield(x: number, y: number, radius: number, health: number, maxHealth: number) {
    const ctx = this.sceneCtx;
    const healthPercent = health / maxHealth;
    const time = this.time;
    
    ctx.save();
    
    // Hexagonal pattern
    const segments = 12;
    const flickerIntensity = healthPercent < 0.3 ? Math.random() * 0.5 + 0.5 : 1;
    
    for (let ring = 0; ring < 3; ring++) {
      const ringRadius = radius * (0.8 + ring * 0.1);
      const alpha = (0.3 - ring * 0.1) * healthPercent * flickerIntensity;
      
      ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2 + time * 0.5;
        const wobble = Math.sin(angle * 6 + time * 3) * 3 * (1 - healthPercent);
        const px = x + Math.cos(angle) * (ringRadius + wobble);
        const py = y + Math.sin(angle) * (ringRadius + wobble);
        
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    
    // Glow effect
    const glowGradient = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 1.2);
    glowGradient.addColorStop(0, 'rgba(0, 200, 255, 0)');
    glowGradient.addColorStop(0.5, `rgba(0, 200, 255, ${0.2 * healthPercent * flickerIntensity})`);
    glowGradient.addColorStop(1, 'rgba(0, 200, 255, 0)');
    
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Add pulsing light
    this.addPulsingLight(x, y, radius * 1.5, 'rgba(0, 200, 255, 0.3)', healthPercent * 0.5, 5);
  }
  
  // Laser beam effect
  drawLaserBeam(x1: number, y1: number, x2: number, y2: number, color: string = '#ff0000', width: number = 4) {
    const ctx = this.sceneCtx;
    const time = this.time;
    
    ctx.save();
    
    // Core beam
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Inner glow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = width * 0.3;
    ctx.shadowBlur = 5;
    ctx.stroke();
    
    // Animated particles along beam
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const particleCount = Math.floor(dist / 20);
    
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < particleCount; i++) {
      const t = ((i / particleCount) + time * 2) % 1;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const size = 2 + Math.random() * 2;
      
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // Add lights at endpoints
    this.addLight(x1, y1, 30, color, 0.5);
    this.addLight(x2, y2, 50, color, 0.7);
  }
  
  // Plasma ball effect
  drawPlasmaBall(x: number, y: number, radius: number, color: string = '#00ff88') {
    const ctx = this.sceneCtx;
    const time = this.time;
    
    ctx.save();
    
    // Outer plasma
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time * 2;
      const tentacleLength = radius * (0.5 + Math.sin(time * 5 + i) * 0.3);
      const endX = x + Math.cos(angle) * (radius + tentacleLength);
      const endY = y + Math.sin(angle) * (radius + tentacleLength);
      
      this.drawLightningArc(x, y, endX, endY, 4, 0.3);
    }
    
    // Core
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    coreGradient.addColorStop(0, '#ffffff');
    coreGradient.addColorStop(0.3, color);
    coreGradient.addColorStop(0.7, this.adjustColorAlpha(color, 0.5));
    coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    
    // Add pulsing light
    this.addPulsingLight(x, y, radius * 3, color, 0.6, 8);
  }
}

// ============================================================================
// ADVANCED PARTICLE SYSTEM
// ============================================================================

export type AdvancedParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  startSize: number;
  endSize: number;
  color: string;
  endColor: string;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
  drag: number;
  type: 'circle' | 'square' | 'triangle' | 'star' | 'spark' | 'smoke' | 'fire';
  blendMode: GlobalCompositeOperation;
  glow: boolean;
  glowSize: number;
  trail: boolean;
  trailLength: number;
  trailHistory: { x: number; y: number }[];
};

export class AdvancedParticleSystem {
  private particles: AdvancedParticle[] = [];
  private maxParticles: number;
  
  constructor(maxParticles: number = 1000) {
    this.maxParticles = maxParticles;
  }
  
  emit(options: Partial<AdvancedParticle> & { x: number; y: number }) {
    if (this.particles.length >= this.maxParticles) {
      this.particles.shift();
    }
    
    const particle: AdvancedParticle = {
      x: options.x,
      y: options.y,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      life: options.life ?? 1,
      maxLife: options.maxLife ?? options.life ?? 1,
      size: options.size ?? 5,
      startSize: options.startSize ?? options.size ?? 5,
      endSize: options.endSize ?? 0,
      color: options.color ?? '#ffffff',
      endColor: options.endColor ?? options.color ?? '#ffffff',
      rotation: options.rotation ?? 0,
      rotationSpeed: options.rotationSpeed ?? 0,
      gravity: options.gravity ?? 0,
      drag: options.drag ?? 0,
      type: options.type ?? 'circle',
      blendMode: options.blendMode ?? 'source-over',
      glow: options.glow ?? false,
      glowSize: options.glowSize ?? 10,
      trail: options.trail ?? false,
      trailLength: options.trailLength ?? 10,
      trailHistory: [],
    };
    
    this.particles.push(particle);
  }
  
  emitBurst(x: number, y: number, count: number, options: Partial<AdvancedParticle> = {}) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 50 + Math.random() * 100;
      
      this.emit({
        ...options,
        x,
        y,
        vx: Math.cos(angle) * speed + (options.vx ?? 0),
        vy: Math.sin(angle) * speed + (options.vy ?? 0),
      });
    }
  }
  
  emitCone(x: number, y: number, angle: number, spread: number, count: number, options: Partial<AdvancedParticle> = {}) {
    for (let i = 0; i < count; i++) {
      const particleAngle = angle + (Math.random() - 0.5) * spread;
      const speed = 50 + Math.random() * 100;
      
      this.emit({
        ...options,
        x,
        y,
        vx: Math.cos(particleAngle) * speed,
        vy: Math.sin(particleAngle) * speed,
      });
    }
  }
  
  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Store trail history
      if (p.trail) {
        p.trailHistory.push({ x: p.x, y: p.y });
        if (p.trailHistory.length > p.trailLength) {
          p.trailHistory.shift();
        }
      }
      
      // Physics
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= (1 - p.drag * dt);
      p.vy *= (1 - p.drag * dt);
      p.rotation += p.rotationSpeed * dt;
      p.life -= dt;
      
      // Update size
      const t = 1 - (p.life / p.maxLife);
      p.size = p.startSize + (p.endSize - p.startSize) * t;
      
      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
  
  render(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = Math.min(1, p.life / p.maxLife);
      const color = this.lerpColor(p.color, p.endColor, 1 - alpha);
      
      ctx.save();
      ctx.globalCompositeOperation = p.blendMode;
      ctx.globalAlpha = alpha;
      
      // Draw trail
      if (p.trail && p.trailHistory.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trailHistory[0].x, p.trailHistory[0].y);
        for (let i = 1; i < p.trailHistory.length; i++) {
          ctx.lineTo(p.trailHistory[i].x, p.trailHistory[i].y);
        }
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = p.size * 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      
      // Glow effect
      if (p.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = p.glowSize;
      }
      
      ctx.fillStyle = color;
      
      switch (p.type) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'square':
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          break;
          
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size, p.size);
          ctx.lineTo(-p.size, p.size);
          ctx.closePath();
          ctx.fill();
          break;
          
        case 'star':
          this.drawStar(ctx, 0, 0, 5, p.size, p.size * 0.5);
          break;
          
        case 'spark':
          ctx.beginPath();
          ctx.moveTo(-p.size * 2, 0);
          ctx.lineTo(p.size * 2, 0);
          ctx.moveTo(0, -p.size);
          ctx.lineTo(0, p.size);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
          
        case 'smoke':
          const smokeGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          smokeGradient.addColorStop(0, `rgba(100, 100, 100, ${alpha * 0.5})`);
          smokeGradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
          ctx.fillStyle = smokeGradient;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
          
        case 'fire':
          const fireGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          fireGradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
          fireGradient.addColorStop(0.4, `rgba(255, 150, 50, ${alpha * 0.8})`);
          fireGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
          ctx.fillStyle = fireGradient;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      
      ctx.restore();
    }
  }
  
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;
      
      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }
  
  private lerpColor(color1: string, color2: string, t: number): string {
    // Simple color interpolation
    const c1 = this.parseColor(color1);
    const c2 = this.parseColor(color2);
    
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  private parseColor(color: string): { r: number; g: number; b: number } {
    if (color.startsWith('#')) {
      return {
        r: parseInt(color.slice(1, 3), 16),
        g: parseInt(color.slice(3, 5), 16),
        b: parseInt(color.slice(5, 7), 16),
      };
    }
    if (color.startsWith('rgb')) {
      const match = color.match(/(\d+)/g);
      if (match) {
        return {
          r: parseInt(match[0]),
          g: parseInt(match[1]),
          b: parseInt(match[2]),
        };
      }
    }
    return { r: 255, g: 255, b: 255 };
  }
  
  getParticleCount(): number {
    return this.particles.length;
  }
  
  clear() {
    this.particles = [];
  }
}
