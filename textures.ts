import * as THREE from 'three';
import type { Pattern } from '../data/skins';

// ---------- seeded RNG + periodic value noise ----------
let seed = 1337;
export function srand(s: number) { seed = s >>> 0 || 1; }
export function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

const perm = new Uint8Array(512);
(function initPerm() {
  srand(42);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
function hash(i: number, j: number) { return perm[(perm[i & 255] + (j & 255)) & 511] / 255; }
function vnoise(x: number, y: number, period: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = period;
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = hash(x0, y0), b = hash(x1, y0), c = hash(x0, y1), d = hash(x1, y1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** tileable fbm over [0,1)^2 — base frequency f cells per tile */
export function fbm(u: number, v: number, f = 4, oct = 4) {
  let s = 0, amp = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) {
    s += amp * vnoise(u * f, v * f, f);
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / tot;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function toTex(c: HTMLCanvasElement, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** fills pixels via callback returning [r,g,b,height] */
function paint(size: number, fn: (u: number, v: number, x: number, y: number) => [number, number, number, number]) {
  const c = canvas(size, size), b = canvas(size, size);
  const ctx = c.getContext('2d')!, bctx = b.getContext('2d')!;
  const img = ctx.createImageData(size, size), bimg = bctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, bl, h] = fn(x / size, y / size, x, y);
    const i = (y * size + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = 255;
    const hv = Math.max(0, Math.min(255, h * 255));
    bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = hv; bimg.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  return { c, b, ctx, bctx };
}

const cache = new Map<string, any>();
function cached<T>(key: string, fn: () => T): T {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export interface TexSet { map: THREE.Texture; bump: THREE.Texture }

/** Sun-bleached plaster/sandstone wall with exposed bricks and cracks */
export function wallTex(variant: 0 | 1 | 2 = 0): TexSet {
  return cached('wall' + variant, () => {
    srand(100 + variant);
    const base = variant === 0 ? hex('#d9c096') : variant === 1 ? hex('#e3d1ad') : hex('#c9a77a');
    const brick = hex('#c59a6a');
    const size = 512;
    const { c, b, ctx, bctx } = paint(size, (u, v) => {
      const n = fbm(u, v, 4, 5);
      const n2 = fbm(u + 0.37, v + 0.11, 8, 3);
      const patch = fbm(u + 0.5, v + 0.2, 3, 4);
      let col: RGB = [...base] as RGB;
      let h = 0.6 + n * 0.3;
      // exposed brick where plaster has fallen off
      if (patch > 0.67) {
        const rowH = 1 / 16;
        const row = Math.floor(v / rowH);
        const bu = u * 8 + (row % 2) * 0.5;
        const mortar = (v % rowH) / rowH < 0.12 || (bu % 1) < 0.06;
        const bn = hash(Math.floor(bu) & 255, row & 255);
        if (mortar) { col = [175, 155, 125]; h = 0.3; }
        else { col = [brick[0] * (0.85 + bn * 0.25), brick[1] * (0.85 + bn * 0.2), brick[2] * (0.85 + bn * 0.2)]; h = 0.45 + n2 * 0.2; }
        if (patch < 0.69) { h = 0.5; col = col.map((x) => x * 0.9) as RGB; }
      }
      const shade = 0.82 + n * 0.3 + (n2 - 0.5) * 0.12;
      const stain = Math.max(0, fbm(u * 0.5 + 0.3, v * 2.0, 2, 3) - 0.55) * 0.9;
      return [col[0] * shade * (1 - stain * 0.35), col[1] * shade * (1 - stain * 0.38), col[2] * shade * (1 - stain * 0.42), h];
    });
    // cracks
    for (let k = 0; k < 7; k++) {
      let x = rnd() * size, y = rnd() * size;
      ctx.strokeStyle = 'rgba(70,50,30,0.55)'; bctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 1.2; bctx.lineWidth = 1.5;
      ctx.beginPath(); bctx.beginPath(); ctx.moveTo(x, y); bctx.moveTo(x, y);
      const ang0 = rnd() * Math.PI * 2;
      for (let s = 0; s < 14; s++) {
        x += Math.cos(ang0 + (rnd() - 0.5) * 1.6) * 9; y += Math.sin(ang0 + (rnd() - 0.5) * 1.6) * 9;
        ctx.lineTo(x, y); bctx.lineTo(x, y);
      }
      ctx.stroke(); bctx.stroke();
    }
    return { map: toTex(c), bump: toTex(b, false) };
  });
}

export function floorSandTex(): TexSet {
  return cached('sand', () => {
    srand(7);
    const size = 512;
    const { c, b, ctx } = paint(size, (u, v) => {
      const n = fbm(u, v, 6, 5);
      const n2 = fbm(u + 0.3, v + 0.7, 24, 2);
      const tracks = Math.abs(Math.sin(u * Math.PI * 2 * 3 + fbm(u, v, 2, 2) * 2)) < 0.08 ? 0.92 : 1;
      const s = (0.78 + n * 0.32 + (n2 - 0.5) * 0.1) * tracks;
      return [214 * s, 186 * s, 140 * s, n * 0.7 + n2 * 0.3];
    });
    for (let i = 0; i < 900; i++) {
      const x = rnd() * size, y = rnd() * size, r = rnd() * 2.2 + 0.4;
      const g = 120 + rnd() * 80;
      ctx.fillStyle = `rgba(${g},${g * 0.85},${g * 0.65},0.6)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return { map: toTex(c), bump: toTex(b, false) };
  });
}

export function floorTileTex(): TexSet {
  return cached('tile', () => {
    srand(11);
    const size = 512;
    const tiles = 4;
    const { c, b } = paint(size, (u, v) => {
      const tu = u * tiles, tv = v * tiles;
      const row = Math.floor(tv);
      const off = (row % 2) * 0.5;
      const cu = tu + off;
      const fu = cu - Math.floor(cu), fv = tv - row;
      const gap = fu < 0.035 || fv < 0.035 || fu > 0.975 || fv > 0.975;
      const id = hash(Math.floor(cu) & 255, row & 255);
      const n = fbm(u, v, 8, 4);
      if (gap) return [150 * (0.8 + n * 0.3), 128 * (0.8 + n * 0.3), 96 * (0.8 + n * 0.3), 0.15];
      const s = 0.82 + id * 0.2 + (n - 0.5) * 0.25;
      return [205 * s, 180 * s, 140 * s, 0.6 + n * 0.3];
    });
    return { map: toTex(c), bump: toTex(b, false) };
  });
}

export function woodCrateTex(dark = false): TexSet {
  return cached('crate' + dark, () => {
    srand(dark ? 23 : 21);
    const size = 256;
    const base: RGB = dark ? [120, 88, 55] : [178, 135, 82];
    const { c, b, ctx, bctx } = paint(size, (u, v, x, y) => {
      const plank = Math.floor(v * 5);
      const pn = hash(plank, 3);
      const grain = Math.sin((u * 40 + fbm(u, v, 4, 3) * 8 + pn * 10)) * 0.5 + 0.5;
      const edge = (v * 5) % 1 < 0.04 ? 0.6 : 1;
      const s = (0.8 + grain * 0.15 + pn * 0.12) * edge;
      return [base[0] * s, base[1] * s, base[2] * s, 0.5 + grain * 0.2 * edge];
    });
    // frame
    ctx.strokeStyle = dark ? '#4a3420' : '#7a5530'; ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, size - 22, size - 22);
    bctx.strokeStyle = '#fff'; bctx.lineWidth = 22; bctx.strokeRect(11, 11, size - 22, size - 22);
    ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(size - 20, size - 20); ctx.stroke();
    bctx.lineWidth = 16; bctx.beginPath(); bctx.moveTo(20, 20); bctx.lineTo(size - 20, size - 20); bctx.stroke();
    // stencil
    ctx.fillStyle = 'rgba(40,30,20,0.45)';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(dark ? '7.62 x39' : 'FRAGILE ▲', 40, size - 40);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#3b3b3b';
      const p = [[20, 20], [size - 20, 20], [20, size - 20], [size - 20, size - 20]][i];
      ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 7); ctx.fill();
    }
    return { map: toTex(c, true, false), bump: toTex(b, false, false) };
  });
}

export function metalTex(color = '#3d6b78'): TexSet {
  return cached('metal' + color, () => {
    srand(5);
    const base = hex(color);
    const size = 256;
    const { c, b } = paint(size, (u, v) => {
      const rib = (u * 12) % 1 < 0.12 ? 0.75 : 1;
      const n = fbm(u, v, 6, 4);
      const rust = Math.max(0, fbm(u + 0.2, v + 0.4, 4, 4) - 0.58) * 3;
      const s = (0.8 + n * 0.3) * rib;
      const col: RGB = [base[0] * s, base[1] * s, base[2] * s];
      return [col[0] * (1 - rust) + 140 * rust, col[1] * (1 - rust) + 70 * rust, col[2] * (1 - rust) + 35 * rust, rib < 1 ? 0.2 : 0.6 + rust * 0.3];
    });
    return { map: toTex(c), bump: toTex(b, false) };
  });
}

export function concreteTex(): TexSet {
  return cached('concrete', () => {
    srand(9);
    const { c, b } = paint(256, (u, v) => {
      const n = fbm(u, v, 8, 4);
      const s = 0.75 + n * 0.35;
      return [150 * s, 138 * s, 120 * s, n];
    });
    return { map: toTex(c), bump: toTex(b, false) };
  });
}

export function fabricTex(): THREE.Texture {
  return cached('fabric', () => {
    srand(31);
    const { c } = paint(128, (u, v, x, y) => {
      const weave = ((x + y) % 4 < 2 ? 0.94 : 1.0) * ((x % 2) ? 0.97 : 1);
      const n = fbm(u, v, 4, 3);
      const s = (0.78 + n * 0.3) * weave * 255;
      return [s, s, s, 0];
    });
    return toTex(c);
  });
}

// ---------- weapon skin pattern textures ----------
export function patternTex(p: Pattern): THREE.Texture | null {
  if (p === 'default' || p === 'gold') return null;
  return cached('pat' + p, () => {
    srand(77 + p.length * 13);
    const W = 512, H = 256;
    const c = canvas(W, H);
    const ctx = c.getContext('2d')!;
    if (p === 'redline') {
      ctx.fillStyle = '#121214'; ctx.fillRect(0, 0, W, H);
      // carbon weave
      for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) {
        ctx.fillStyle = ((x + y) / 8) % 2 ? '#1b1b1e' : '#151517';
        ctx.fillRect(x, y, 8, 8);
      }
      ctx.strokeStyle = '#d4131c'; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        ctx.lineWidth = 6 + i * 2;
        ctx.beginPath();
        const y0 = 40 + i * 45;
        ctx.moveTo(-20, y0); ctx.bezierCurveTo(W * 0.3, y0 - 40, W * 0.6, y0 + 50, W + 20, y0 - 10);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); const y0 = 40 + i * 45 - 6;
        ctx.moveTo(-20, y0); ctx.bezierCurveTo(W * 0.3, y0 - 40, W * 0.6, y0 + 50, W + 20, y0 - 10); ctx.stroke();
      }
    } else if (p === 'camo') {
      ctx.fillStyle = '#8d9092'; ctx.fillRect(0, 0, W, H);
      const cols = ['#5d6164', '#c9cbcc', '#2f3234', '#a7abad'];
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = cols[i % 4];
        const x = rnd() * W, y = rnd() * H, s = 10 + rnd() * 36;
        ctx.beginPath();
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2, r = s * (0.6 + rnd() * 0.6);
          k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7) : ctx.moveTo(x + r, y);
        }
        ctx.fill();
      }
    } else if (p === 'bluesteel') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2a3b7a'); g.addColorStop(0.3, '#5b7bd6'); g.addColorStop(0.5, '#7b4fb8');
      g.addColorStop(0.7, '#3d6fb0'); g.addColorStop(1, '#c79a5a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(${rnd() > 0.5 ? '255,200,120' : '120,160,255'},${0.1 + rnd() * 0.2})`;
        ctx.beginPath(); ctx.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 60, 10 + rnd() * 30, rnd() * 3, 0, 7); ctx.fill();
      }
    } else if (p === 'phantom') {
      ctx.fillStyle = '#eceef0'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#25282c'; ctx.lineWidth = 3;
      for (let i = 0; i < 26; i++) {
        const x = rnd() * W, y = rnd() * H, s = 20 + rnd() * 60;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s * 0.4); ctx.lineTo(x + s * 0.2, y + s); ctx.closePath(); ctx.stroke();
      }
      ctx.fillStyle = '#9aa3ad';
      for (let i = 0; i < 14; i++) ctx.fillRect(rnd() * W, rnd() * H, 40 + rnd() * 80, 4);
      ctx.fillStyle = '#3ad1e6';
      for (let i = 0; i < 6; i++) ctx.fillRect(rnd() * W, rnd() * H, 30, 3);
    } else if (p === 'dragon') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0f3b3f'); g.addColorStop(1, '#0a2226');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // scales
      for (let y = 0; y < H + 20; y += 16) for (let x = 0; x < W + 20; x += 20) {
        const ox = (y / 16) % 2 ? 10 : 0;
        const inDragon = Math.sin((x + ox) / W * Math.PI * 2.4) * 60 + H / 2;
        const d = Math.abs(y - inDragon);
        if (d < 55) {
          const t = d / 55;
          ctx.fillStyle = t < 0.4 ? '#ffb02e' : t < 0.75 ? '#f26a1b' : '#b8261a';
          ctx.strokeStyle = '#4a0f08'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x + ox, y, 10, 0, Math.PI); ctx.fill(); ctx.stroke();
        }
      }
      // flames
      for (let i = 0; i < 22; i++) {
        const x = rnd() * W, y = rnd() * H;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, 30);
        gr.addColorStop(0, 'rgba(255,220,120,0.8)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(W * 0.78, H * 0.42, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a0500'; ctx.beginPath(); ctx.arc(W * 0.78, H * 0.42, 3, 0, 7); ctx.fill();
    } else if (p === 'fade') {
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, '#f5d76e'); g.addColorStop(0.35, '#f07ab8'); g.addColorStop(0.7, '#8b5cf6'); g.addColorStop(1, '#3b82f6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (p === 'tiger') {
      ctx.fillStyle = '#e08a2a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1a1208';
      for (let i = 0; i < 26; i++) {
        const x = (i / 26) * W + rnd() * 10;
        ctx.beginPath(); ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + 20 - rnd() * 40, H * 0.5, x + 8, H * (0.4 + rnd() * 0.6));
        ctx.lineTo(x + 14, 0); ctx.fill();
      }
    } else if (p === 'neon') {
      ctx.fillStyle = '#16161c'; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 3;
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = rnd() > 0.5 ? '#21f3ff' : '#ff2bd6';
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
        let x = rnd() * W, y = rnd() * H;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { if (k % 2) x += (rnd() - 0.5) * 120; else y += (rnd() - 0.5) * 80; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      }
      ctx.shadowBlur = 0;
    } else if (p === 'carbon') {
      for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) {
        const odd = ((x + y) / 6) % 2;
        const g = ctx.createLinearGradient(x, y, x + 6, y + 6);
        g.addColorStop(0, odd ? '#2c2f33' : '#1a1c1f'); g.addColorStop(1, odd ? '#1a1c1f' : '#2c2f33');
        ctx.fillStyle = g; ctx.fillRect(x, y, 6, 6);
      }
      ctx.fillStyle = '#c0c4c8'; ctx.font = 'bold 26px Bahnschrift, Arial'; ctx.fillText('OPS', W * 0.6, H * 0.6);
    }
    return toTex(c);
  });
}

// ---------- effect textures ----------
export function radialTex(key: string, stops: [number, string][], size = 64) {
  return cached('rad' + key, () => {
    const c = canvas(size, size);
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    return toTex(c, true, false);
  });
}

export function smokeTex() {
  return cached('smokepuff', () => {
    srand(55);
    const size = 128;
    const c = canvas(size, size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const n = fbm(x / size, y / size, 4, 4);
      const a = Math.max(0, 1 - d) * (0.55 + n * 0.6);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * a * 255 * 1.4);
    }
    ctx.putImageData(img, 0, 0);
    return toTex(c, true, false);
  });
}

export function muzzleTex() {
  return cached('muzzle', () => {
    const size = 128;
    const c = canvas(size, size);
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.2, 'rgba(255,210,120,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(size * 0.48, 0); ctx.lineTo(0, 6); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, size * 0.22, 0, 7); ctx.fill();
    return toTex(c, true, false);
  });
}

export function bulletHoleTex() {
  return cached('hole', () => {
    const size = 64;
    const c = canvas(size, size);
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(10,8,6,1)'); g.addColorStop(0.25, 'rgba(25,20,15,0.95)'); g.addColorStop(0.45, 'rgba(80,65,45,0.5)'); g.addColorStop(1, 'rgba(80,65,45,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(20,15,10,0.6)';
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 7;
      ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20); ctx.stroke();
    }
    return toTex(c, true, false);
  });
}

export function bloodTex() {
  return cached('blood', () => {
    const size = 128;
    const c = canvas(size, size);
    const ctx = c.getContext('2d')!;
    srand(3);
    for (let i = 0; i < 26; i++) {
      const r = rnd() * 14 + 3, a = rnd() * 7, d = rnd() * 40;
      ctx.fillStyle = `rgba(${110 + rnd() * 40},10,8,${0.6 + rnd() * 0.4})`;
      ctx.beginPath(); ctx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, 7); ctx.fill();
    }
    return toTex(c, true, false);
  });
}

/** spray-painted letter / symbol decal */
export function stencilTex(text: string, color = '#c3261d', arrow = false) {
  return cached('sten' + text + color + arrow, () => {
    const size = 256;
    const c = canvas(size, size);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.font = `bold ${arrow ? 120 : 190}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 6;
    ctx.fillText(text, size / 2, arrow ? size * 0.4 : size / 2 + 8);
    if (arrow) {
      ctx.beginPath(); ctx.moveTo(40, 200); ctx.lineTo(190, 200); ctx.lineTo(190, 180); ctx.lineTo(230, 210); ctx.lineTo(190, 240); ctx.lineTo(190, 220); ctx.lineTo(40, 220); ctx.fill();
    }
    // overspray dots
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = Math.random() * 0.4;
      ctx.beginPath(); ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 1.5, 0, 7); ctx.fill();
    }
    return toTex(c, true, false);
  });
}

export function signTex(text: string, bg = '#2f5d8a', fg = '#f1f1f1') {
  return cached('sign' + text + bg, () => {
    const c = canvas(256, 96);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = fg; ctx.lineWidth = 4; ctx.strokeRect(6, 6, 244, 84);
    ctx.fillStyle = fg; ctx.font = 'bold 40px Bahnschrift, Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 50);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; ctx.fillRect(Math.random() * 256, Math.random() * 96, 2, 2); }
    return toTex(c, true, false);
  });
}

export function leafTex() {
  return cached('leaf', () => {
    const c = canvas(128, 256);
    const ctx = c.getContext('2d')!;
    ctx.strokeStyle = '#3b5a22'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 256); ctx.stroke();
    for (let i = 0; i < 30; i++) {
      const y = 8 + i * 8;
      const len = 60 * Math.sin((i / 30) * Math.PI) + 6;
      ctx.strokeStyle = i % 2 ? '#4c7a2a' : '#5d8f33'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(64 - len, y + 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(64 + len, y + 18); ctx.stroke();
    }
    return toTex(c, true, false);
  });
}
