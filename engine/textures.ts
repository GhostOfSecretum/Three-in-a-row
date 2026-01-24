const TEXTURE_SIZE = 64;

const WALL_PALETTE = [
  { r: 135, g: 54, b: 36 },  // brick
  { r: 92, g: 98, b: 104 },  // metal
  { r: 58, g: 112, b: 80 },  // tech
  { r: 160, g: 124, b: 52 }, // warning
];

export function getWallColor(
  tileId: number,
  texX: number,
  texY: number,
  shade: number
): string {
  const index = Math.max(0, Math.min(WALL_PALETTE.length - 1, tileId - 1));
  const base = WALL_PALETTE[index];

  // Simple procedural texture: checker + noise-like banding.
  const checker = ((texX ^ texY) & 8) === 0 ? 0.85 : 1.05;
  const stripe = ((texX + texY) % 16) < 8 ? 0.92 : 1.08;
  const brightness = Math.min(1.1, shade * checker * stripe);

  const r = Math.floor(base.r * brightness);
  const g = Math.floor(base.g * brightness);
  const b = Math.floor(base.b * brightness);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getTextureSize() {
  return TEXTURE_SIZE;
}
