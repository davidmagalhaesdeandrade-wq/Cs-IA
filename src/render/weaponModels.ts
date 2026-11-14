import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Pattern } from '../data/skins';
import { patternTex, woodCrateTex } from './textures';

export interface Mats {
  receiver: THREE.Material;
  furniture: THREE.Material;
  metal: THREE.Material;
  dark: THREE.Material;
  mag: THREE.Material;
  rubber: THREE.Material;
  blade: THREE.Material;
  glass: THREE.Material;
  accent: THREE.Material;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
const matCache = new Map<string, Mats>();

let woodTex: THREE.Texture | null = null;
function wood() {
  if (!woodTex) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#6b3a1c'; ctx.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(${40 + Math.random() * 40},${18 + Math.random() * 20},8,${0.3 + Math.random() * 0.4})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const y = Math.random() * 64;
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x / 30 + i) * 3);
      ctx.stroke();
    }
    woodTex = new THREE.CanvasTexture(c);
    woodTex.colorSpace = THREE.SRGBColorSpace;
  }
  return woodTex;
}

/** materials for a given weapon + skin pattern */
export function getMats(weapon: string, pattern: Pattern): Mats {
  const key = weapon + ':' + pattern;
  if (matCache.has(key)) return matCache.get(key)!;
  const metal = std({ color: 0x3a3c40, metalness: 0.85, roughness: 0.38 });
  const dark = std({ color: 0x1c1d20, metalness: 0.6, roughness: 0.5 });
  const rubber = std({ color: 0x151515, metalness: 0.0, roughness: 0.9 });
  const glass = std({ color: 0x0a1a24, metalness: 0.9, roughness: 0.05, emissive: 0x051018 });
  let receiver: THREE.Material = std({ color: 0x2d2f33, metalness: 0.7, roughness: 0.42 });
  let furniture: THREE.Material = std({ color: 0x232427, metalness: 0.1, roughness: 0.75 });
  let mag: THREE.Material = dark;
  let blade: THREE.Material = std({ color: 0xc9ced4, metalness: 1, roughness: 0.18 });
  let accent: THREE.Material = dark;

  if (weapon === 'ak47' || weapon === 'galil') {
    furniture = std({ map: wood(), color: 0xffffff, metalness: 0.05, roughness: 0.55 });
    mag = std({ color: 0x2a2724, metalness: 0.6, roughness: 0.5 });
  }
  if (weapon === 'awp') furniture = std({ color: 0x4b5a3b, metalness: 0.15, roughness: 0.7 });
  if (weapon === 'ssg08') furniture = std({ color: 0x55606b, metalness: 0.3, roughness: 0.6 });
  if (weapon === 'deagle') receiver = std({ color: 0x9aa0a6, metalness: 1, roughness: 0.28 });
  if (weapon === 'p90' || weapon === 'famas') furniture = std({ color: 0x2b2d2a, metalness: 0.05, roughness: 0.8 });
  if (weapon === 'knife') furniture = std({ color: 0x1a1a1a, roughness: 0.85 });

  const tex = patternTex(pattern);
  switch (pattern) {
    case 'redline':
      receiver = std({ color: 0x141416, metalness: 0.5, roughness: 0.55 });
      furniture = std({ map: tex!, metalness: 0.2, roughness: 0.45 });
      mag = std({ color: 0x18181a, metalness: 0.5, roughness: 0.5 });
      accent = std({ color: 0xc8161e, metalness: 0.3, roughness: 0.4 });
      break;
    case 'gold':
      receiver = std({ color: 0xd9a63a, metalness: 1, roughness: 0.18 });
      furniture = std({ color: 0x24160d, metalness: 0.2, roughness: 0.4 });
      mag = std({ color: 0xc4952f, metalness: 1, roughness: 0.22 });
      accent = receiver;
      blade = receiver;
      break;
    case 'camo':
      receiver = std({ map: tex!, metalness: 0.25, roughness: 0.65 });
      furniture = std({ map: tex!, metalness: 0.1, roughness: 0.75 });
      mag = std({ color: 0x3a3d40, metalness: 0.4, roughness: 0.6 });
      break;
    case 'bluesteel':
      receiver = std({ map: tex!, metalness: 0.95, roughness: 0.22 });
      furniture = std({ color: 0x1e2433, metalness: 0.4, roughness: 0.5 });
      blade = std({ map: tex!, metalness: 1, roughness: 0.15 });
      break;
    case 'phantom':
      receiver = std({ map: tex!, metalness: 0.3, roughness: 0.3 });
      furniture = std({ map: tex!, metalness: 0.2, roughness: 0.35 });
      mag = std({ color: 0xe6e8ea, metalness: 0.3, roughness: 0.35 });
      break;
    case 'dragon':
      receiver = std({ map: tex!, metalness: 0.45, roughness: 0.35 });
      furniture = std({ map: tex!, metalness: 0.3, roughness: 0.4 });
      accent = std({ color: 0xff8a1c, metalness: 0.6, roughness: 0.3, emissive: 0x401000 });
      break;
    case 'fade':
      receiver = std({ map: tex!, metalness: 0.9, roughness: 0.2 });
      blade = std({ map: tex!, metalness: 1, roughness: 0.12 });
      break;
    case 'tiger':
      blade = std({ map: tex!, metalness: 0.9, roughness: 0.2 });
      receiver = blade;
      break;
    case 'neon':
      receiver = std({ map: tex!, emissiveMap: tex!, emissive: 0xffffff, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4 });
      furniture = std({ color: 0x1a1a22, metalness: 0.3, roughness: 0.5 });
      accent = std({ color: 0x21f3ff, emissive: 0x21f3ff, emissiveIntensity: 1.2 });
      break;
    case 'carbon':
      receiver = std({ map: tex!, metalness: 0.4, roughness: 0.4 });
      if (weapon === 'knife') furniture = std({ map: tex!, metalness: 0.15, roughness: 0.5 });
      break;
  }
  const m: Mats = { receiver, furniture, metal, dark, mag, rubber, blade, glass, accent };
  matCache.set(key, m);
  return m;
}

// ---------- geometry helpers ----------
const geoCache = new Map<string, THREE.BufferGeometry>();
function boxG(w: number, h: number, d: number, round: boolean) {
  const k = `${w.toFixed(4)}_${h.toFixed(4)}_${d.toFixed(4)}_${round}`;
  if (!geoCache.has(k)) {
    const r = Math.min(w, h, d) * 0.22;
    geoCache.set(k, round ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  }
  return geoCache.get(k)!;
}
function add(g: THREE.Object3D, mesh: THREE.Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, name?: string) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  if (name) mesh.name = name;
  g.add(mesh);
  return mesh;
}
const B = (g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, name?: string) =>
  add(g, new THREE.Mesh(boxG(w, h, d, true), m), x, y, z, rx, ry, rz, name);
const R = (g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, name?: string) =>
  add(g, new THREE.Mesh(boxG(w, h, d, true), m), x, y, z, rx, ry, rz, name);
/** cylinder along given axis */
function C(g: THREE.Object3D, r: number, len: number, m: THREE.Material, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'z', r2?: number, seg = 14) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, len, seg), m);
  const rx = axis === 'z' ? Math.PI / 2 : 0;
  const rz = axis === 'x' ? Math.PI / 2 : 0;
  return add(g, mesh, x, y, z, rx, 0, rz);
}
function muzzle(g: THREE.Object3D, x: number, y: number, z: number) {
  const o = new THREE.Object3D();
  o.name = 'muzzle';
  o.position.set(x, y, z);
  g.add(o);
}
/** marks where the left (support) hand should go, in weapon space */
function support(g: THREE.Object3D, x: number, y: number, z: number) {
  const o = new THREE.Object3D();
  o.name = 'support';
  o.position.set(x, y, z);
  g.add(o);
}

/** Low-profile Picatinny rail with individually machined cross slots. */
function topRail(g: THREE.Object3D, m: Mats, fromZ: number, toZ: number, y: number, width: number, slots: number) {
  const depth = Math.abs(toZ - fromZ);
  if (depth <= 0 || slots <= 0) return;
  B(g, width, 0.007, depth + 0.012, m.dark, 0, y, (fromZ + toZ) / 2);
  const slotDepth = Math.min(0.009, depth / (slots * 1.5));
  for (let i = 0; i < slots; i++) {
    const z = fromZ + (toZ - fromZ) * ((i + 0.5) / slots);
    B(g, width * 0.88, 0.0035, slotDepth, m.metal, 0, y + 0.005, z);
  }
}

/** Small flush pins make the receiver read as assembled metalwork. */
function receiverPins(g: THREE.Object3D, m: Mats, halfWidth: number, y: number, zPositions: number[]) {
  for (const x of [-halfWidth, halfWidth]) for (const z of zPositions) {
    C(g, 0.004, 0.003, m.metal, x, y, z, 'x', undefined, 8);
  }
}

// ---------- weapon builders (forward = -Z, origin = top of pistol grip) ----------
function buildAK(m: Mats, galil = false) {
  const g = new THREE.Group();
  R(g, 0.052, 0.075, 0.34, m.receiver, 0, 0, -0.06);
  R(g, 0.046, 0.032, 0.3, m.receiver, 0, 0.048, -0.07);
  B(g, 0.004, 0.02, 0.06, m.dark, 0.027, 0.02, -0.05); // ejection port
  R(g, 0.062, 0.056, 0.22, m.furniture, 0, 0.004, -0.33);
  R(g, 0.05, 0.032, 0.17, m.furniture, 0, 0.05, -0.335);
  B(g, 0.064, 0.012, 0.02, m.metal, 0, 0.004, -0.445);
  C(g, 0.011, 0.13, m.metal, 0, 0.05, -0.48);
  C(g, 0.0105, 0.36, m.metal, 0, 0.018, -0.6);
  B(g, 0.022, 0.032, 0.03, m.dark, 0, 0.032, -0.72);
  B(g, 0.006, 0.042, 0.006, m.dark, 0, 0.066, -0.72);
  C(g, 0.016, 0.06, m.dark, 0, 0.018, -0.8);
  B(g, 0.032, 0.02, 0.05, m.dark, 0, 0.072, -0.2);
  C(g, 0.006, 0.04, m.metal, 0.034, 0.025, -0.1, 'x');
  topRail(g, m, -0.17, -0.015, 0.078, 0.028, 8);
  B(g, 0.012, 0.018, 0.014, m.dark, 0, 0.084, -0.205); // rear sight notch
  B(g, 0.014, 0.016, 0.012, m.dark, 0, 0.088, -0.72); // front post
  receiverPins(g, m, 0.027, 0.012, [-0.16, -0.02]);
  B(g, 0.007, 0.026, 0.065, m.metal, 0.03, 0.004, 0.005, 0, 0, 0.12); // safety lever
  if (m.accent !== m.dark) B(g, 0.054, 0.006, 0.2, m.accent, 0, 0.068, -0.08);
  const mag = new THREE.Group();
  mag.name = 'mag';
  mag.position.set(0, -0.035, -0.12);
  for (let i = 0; i < 5; i++) B(mag, 0.034, 0.05, 0.075, m.mag, 0, -0.02 - i * 0.042, -i * 0.016 - i * i * 0.004, i * 0.12);
  g.add(mag);
  R(g, 0.034, 0.11, 0.05, galil ? m.dark : m.furniture, 0, -0.07, 0.055, -0.32);
  B(g, 0.008, 0.008, 0.07, m.dark, 0, -0.05, -0.015);
  B(g, 0.004, 0.024, 0.004, m.dark, 0, -0.04, -0.005);
  if (galil) {
    C(g, 0.012, 0.24, m.dark, 0, 0.0, 0.22);
    C(g, 0.012, 0.24, m.dark, 0, -0.06, 0.22);
    B(g, 0.044, 0.12, 0.025, m.rubber, 0, -0.03, 0.34);
  } else {
    R(g, 0.044, 0.075, 0.28, m.furniture, 0, -0.022, 0.25, 0.08);
    B(g, 0.048, 0.11, 0.02, m.dark, 0, -0.045, 0.39, 0.08);
  }
  support(g, 0, -0.03, -0.33);
  muzzle(g, 0, 0.018, -0.84);
  return g;
}

function buildM4(m: Mats, silenced: boolean) {
  const g = new THREE.Group();
  R(g, 0.05, 0.062, 0.24, m.receiver, 0, -0.008, -0.04);
  R(g, 0.052, 0.05, 0.3, m.receiver, 0, 0.05, -0.08);
  B(g, 0.024, 0.012, 0.3, m.dark, 0, 0.081, -0.09);
  for (let i = 0; i < 10; i++) B(g, 0.028, 0.006, 0.012, m.dark, 0, 0.09, -0.22 + i * 0.028);
  R(g, 0.062, 0.062, 0.26, m.furniture, 0, 0.035, -0.35);
  for (let i = 0; i < 3; i++) B(g, 0.064, 0.008, 0.24, m.dark, 0, 0.035 + (i - 1) * 0.022, -0.35);
  C(g, 0.0105, 0.3, m.metal, 0, 0.035, -0.6);
  B(g, 0.014, 0.065, 0.02, m.dark, 0, 0.085, -0.5, 0.25);
  B(g, 0.018, 0.022, 0.02, m.dark, 0, 0.11, -0.12);
  if (silenced) {
    C(g, 0.02, 0.24, m.dark, 0, 0.035, -0.84);
    C(g, 0.021, 0.02, m.accent !== m.dark ? m.accent : m.metal, 0, 0.035, -0.73);
    muzzle(g, 0, 0.035, -0.96);
  } else {
    C(g, 0.014, 0.06, m.dark, 0, 0.035, -0.78);
    muzzle(g, 0, 0.035, -0.82);
  }
  B(g, 0.004, 0.022, 0.06, m.dark, 0.027, 0.04, -0.06);
  B(g, 0.014, 0.022, 0.025, m.dark, 0, 0.105, 0.035); // rear aperture sight
  for (const x of [-1, 1]) for (let i = 0; i < 5; i++) {
    B(g, 0.007, 0.034, 0.012, m.dark, x * 0.034, 0.035, -0.25 - i * 0.038);
  }
  receiverPins(g, m, 0.026, -0.005, [-0.13, 0.02]);
  const mag = new THREE.Group();
  mag.name = 'mag';
  mag.position.set(0, -0.04, -0.11);
  const segs = silenced ? 3 : 4;
  for (let i = 0; i < segs; i++) B(mag, 0.03, 0.055, 0.068, m.mag, 0, -0.025 - i * 0.05, -i * 0.006, i * 0.05);
  g.add(mag);
  R(g, 0.034, 0.1, 0.045, m.furniture, 0, -0.065, 0.06, -0.38);
  B(g, 0.008, 0.008, 0.07, m.dark, 0, -0.045, -0.01);
  C(g, 0.017, 0.17, m.dark, 0, 0.025, 0.16);
  R(g, 0.046, 0.085, 0.16, m.furniture, 0, 0.0, 0.29);
  B(g, 0.05, 0.1, 0.016, m.rubber, 0, -0.005, 0.37);
  if (m.accent !== m.dark) B(g, 0.064, 0.01, 0.1, m.accent, 0, 0.0, -0.35);
  support(g, 0, 0.0, -0.36);
  return g;
}

function buildAWP(m: Mats, ssg = false) {
  const g = new THREE.Group();
  const s = ssg ? 0.82 : 1;
  R(g, 0.06 * s, 0.085 * s, 0.5, m.furniture, 0, -0.01, 0.0);
  R(g, 0.05 * s, 0.045, 0.3, m.furniture, 0, 0.025, 0.36);
  R(g, 0.05 * s, 0.045, 0.28, m.furniture, 0, -0.1, 0.38);
  R(g, 0.056 * s, 0.17, 0.04, m.furniture, 0, -0.035, 0.53);
  B(g, 0.06 * s, 0.17, 0.02, m.rubber, 0, -0.035, 0.56);
  R(g, 0.035, 0.1, 0.04, m.furniture, 0, -0.07, 0.2, -0.2);
  C(g, 0.022, 0.3, m.receiver, 0, 0.04, -0.06);
  C(g, ssg ? 0.01 : 0.013, 0.62, m.metal, 0, 0.042, -0.52);
  if (!ssg) R(g, 0.036, 0.032, 0.09, m.dark, 0, 0.042, -0.86);
  else C(g, 0.012, 0.05, m.dark, 0, 0.042, -0.85);
  // Scope rail and mounting blocks keep the optic integrated with the receiver.
  topRail(g, m, -0.17, 0.09, 0.064, 0.04, 7);
  receiverPins(g, m, 0.03 * s, -0.01, [-0.14, 0.12]);
  // scope
  C(g, 0.019, 0.3, m.dark, 0, 0.118, -0.05);
  C(g, 0.034, 0.1, m.dark, 0, 0.118, -0.24, 'z', 0.02);
  C(g, 0.028, 0.06, m.dark, 0, 0.118, 0.13);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), m.glass);
  add(g, lens, 0, 0.118, -0.292, 0, Math.PI, 0);
  C(g, 0.012, 0.035, m.dark, 0, 0.145, -0.05, 'y');
  C(g, 0.012, 0.035, m.dark, 0.03, 0.118, -0.05, 'x');
  B(g, 0.02, 0.04, 0.02, m.dark, 0, 0.08, -0.15);
  B(g, 0.02, 0.04, 0.02, m.dark, 0, 0.08, 0.05);
  const bolt = new THREE.Group();
  bolt.name = 'bolt';
  bolt.position.set(0.035, 0.045, 0.06);
  C(bolt, 0.006, 0.05, m.metal, 0.01, 0, 0, 'x');
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), m.metal);
  add(bolt, knob, 0.04, -0.005, 0);
  g.add(bolt);
  const mag = new THREE.Group();
  mag.name = 'mag';
  mag.position.set(0, -0.07, -0.03);
  B(mag, 0.05 * s, 0.06, 0.09, m.mag, 0, -0.01, 0);
  g.add(mag);
  C(g, 0.006, 0.18, m.dark, 0.015, -0.05, -0.38);
  C(g, 0.006, 0.18, m.dark, -0.015, -0.05, -0.38);
  if (m.accent !== m.dark) B(g, 0.062 * s, 0.01, 0.4, m.accent, 0, 0.033, 0.0);
  support(g, 0, -0.02, -0.22);
  muzzle(g, 0, 0.042, -0.92);
  return g;
}

function buildPistol(m: Mats, kind: 'glock' | 'usps' | 'deagle') {
  const g = new THREE.Group();
  const big = kind === 'deagle';
  const len = kind === 'glock' ? 0.19 : kind === 'usps' ? 0.2 : 0.26;
  const slide = new THREE.Group();
  slide.name = 'slide';
  R(slide, big ? 0.036 : 0.03, big ? 0.046 : 0.036, len, m.receiver, 0, 0, 0);
  for (let i = 0; i < 5; i++) B(slide, (big ? 0.037 : 0.031), 0.026, 0.004, m.dark, 0, -0.002, len / 2 - 0.02 - i * 0.008);
  B(slide, 0.006, 0.01, 0.008, m.dark, 0, big ? 0.028 : 0.022, -len / 2 + 0.01);
  B(slide, 0.018, 0.01, 0.008, m.dark, 0, big ? 0.028 : 0.022, len / 2 - 0.01);
  if (big) B(slide, 0.02, 0.012, len - 0.02, m.receiver, 0, 0.026, 0);
  B(slide, 0.012, 0.009, 0.008, m.dark, 0, big ? 0.03 : 0.024, -len / 2 + 0.012); // front sight
  B(slide, 0.014, 0.008, 0.01, m.dark, 0, big ? 0.03 : 0.024, len / 2 - 0.012); // rear notch
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.003, 6, 14), m.dark);
  add(g, guard, 0, -0.006, 0.002, 0, Math.PI / 2, 0); // trigger guard
  B(g, 0.006, 0.018, 0.008, m.metal, 0, -0.008, -0.002); // trigger
  slide.position.set(0, big ? 0.05 : 0.045, -len / 2 + 0.03);
  g.add(slide);
  R(g, big ? 0.032 : 0.028, 0.026, len * 0.9, m.furniture === m.dark ? m.dark : (big ? m.dark : m.furniture), 0, big ? 0.015 : 0.016, -len / 2 + 0.035);
  R(g, big ? 0.036 : 0.031, big ? 0.125 : 0.11, big ? 0.056 : 0.05, kind === 'deagle' ? m.rubber : m.furniture, 0, -0.045, 0.025, -0.28);
  B(g, 0.007, 0.007, 0.05, m.dark, 0, -0.012, -0.015);
  const mag = new THREE.Group();
  mag.name = 'mag';
  mag.position.set(0, -0.06, 0.03);
  B(mag, 0.024, 0.06, 0.04, m.dark, 0, -0.04, 0, -0.28);
  g.add(mag);
  let mz = -len + 0.03;
  if (kind === 'usps') {
    C(g, 0.016, 0.16, m.dark, 0, 0.045, mz - 0.08);
    mz -= 0.16;
  }
  if (big) B(g, 0.012, 0.016, 0.02, m.dark, 0, 0.06, 0.04);
  muzzle(g, 0, big ? 0.05 : 0.045, mz);
  support(g, 0, -0.05, 0.03);
  return g;
}

function buildKnife(m: Mats, pattern: Pattern) {
  const g = new THREE.Group();
  // Os acabamentos especiais também definem a silhueta da faca equipada:
  // These original finishes select distinct silhouettes as well as blade finishes.
  const style = pattern === 'fade' ? 'karambit' : pattern === 'tiger' ? 'butterfly' : pattern === 'carbon' ? 'm9' : pattern === 'bluesteel' ? 'stiletto' : 'classic';
  g.userData.knifeStyle = style;

  let grip: THREE.Group | null = null;
  if (style !== 'butterfly') {
    grip = new THREE.Group();
    const handleLength = style === 'karambit' ? 0.13 : style === 'stiletto' ? 0.16 : style === 'm9' ? 0.17 : 0.145;
    R(grip, 0.027, 0.036, handleLength, m.furniture, 0, -0.004, 0.045, -0.08);
    R(grip, 0.029, 0.039, handleLength * 0.73, m.rubber, 0, -0.004, 0.055, -0.08);
    for (let i = 0; i < 6; i++) B(grip, 0.030, 0.003, 0.006, m.dark, 0, -0.018, 0.012 + i * 0.016, -0.08);
    R(grip, 0.034, 0.012, 0.018, m.metal, 0, -0.002, -0.035);
    C(grip, 0.014, 0.012, m.metal, 0, -0.004, 0.122);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), m.metal);
    add(grip, pommel, 0, -0.004, 0.132);
    g.add(grip);
  }

  if (style === 'karambit') {
    // Finger ring and a hooked, planar blade rather than a cylindrical proxy.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), m.metal);
    ring.position.set(0, -0.004, 0.145);
    grip?.add(ring);
    const profile = new THREE.Shape();
    profile.moveTo(0, -0.012);
    profile.quadraticCurveTo(0.085, -0.02, 0.17, -0.014);
    profile.quadraticCurveTo(0.235, -0.009, 0.24, -0.001);
    profile.quadraticCurveTo(0.222, 0.013, 0.19, 0.023);
    profile.quadraticCurveTo(0.177, 0.028, 0.16, 0.029);
    profile.quadraticCurveTo(0.181, 0.0135, 0.17, 0.006);
    profile.quadraticCurveTo(0.095, 0.0025, 0, 0.012);
    profile.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.007, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
    bladeGeo.rotateY(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, m.blade);
    blade.position.set(-0.0035, 0, -0.035);
    blade.name = 'blade';
    g.add(blade);
    const edgePath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.003, -0.012, -0.035), new THREE.Vector3(0.003, -0.019, -0.12),
      new THREE.Vector3(0.003, -0.014, -0.205), new THREE.Vector3(0.003, -0.001, -0.275),
      new THREE.Vector3(0.003, 0.018, -0.225), new THREE.Vector3(0.003, 0.026, -0.195)
    ]);
    const edge = new THREE.Mesh(new THREE.TubeGeometry(edgePath, 28, 0.002, 6, false), m.accent);
    g.add(edge);
    R(g, 0.07, 0.014, 0.018, m.metal, 0, -0.001, -0.035);
  } else if (style === 'butterfly') {
    // Two independent scales pivot around the tang; the blade stays centered.
    for (const side of [-1, 1]) {
      const handle = new THREE.Group();
      handle.name = side < 0 ? 'butterflyHandleLeft' : 'butterflyHandleRight';
      handle.position.set(side * 0.025, 0, -0.035);
      g.add(handle);
      R(handle, 0.018, 0.026, 0.15, m.furniture, 0, -0.004, 0.105, side * 0.08);
      R(handle, 0.019, 0.006, 0.128, m.rubber, 0, 0.010, 0.105, side * 0.08);
      for (const z of [0.065, 0.14]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 10), m.metal);
        screw.rotation.x = Math.PI / 2;
        add(handle, screw, 0, 0.015, z);
      }
      for (let i = 0; i < 4; i++) B(handle, 0.019, 0.003, 0.006, m.accent, 0, -0.018, 0.055 + i * 0.025);
      const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 12), m.metal);
      pivot.rotation.z = Math.PI / 2;
      add(handle, pivot, 0, 0.012, 0);
    }
    const profile = new THREE.Shape();
    profile.moveTo(0, -0.012);
    profile.lineTo(0.16, -0.014);
    profile.lineTo(0.245, -0.012);
    profile.lineTo(0.285, -0.003);
    profile.lineTo(0.265, 0.009);
    profile.lineTo(0.17, 0.013);
    profile.lineTo(0, 0.012);
    profile.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
    bladeGeo.rotateY(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, m.blade);
    blade.position.set(-0.004, 0.006, -0.035);
    blade.name = 'blade';
    g.add(blade);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, 0.19), m.dark);
    fuller.position.set(0.005, 0.008, -0.16);
    g.add(fuller);
  } else if (style === 'm9') {
    // Broad clip-point bayonet with a stepped guard and a forged spine.
    R(g, 0.09, 0.014, 0.025, m.metal, 0, 0.0, -0.035);
    C(g, 0.008, 0.025, m.metal, 0, 0.0, -0.04, 'z');
    const profile = new THREE.Shape();
    profile.moveTo(0, -0.012);
    profile.lineTo(0.055, -0.015);
    profile.lineTo(0.22, -0.013);
    profile.lineTo(0.295, -0.005);
    profile.lineTo(0.34, 0.004);
    profile.lineTo(0.292, 0.01);
    profile.lineTo(0.19, 0.014);
    profile.lineTo(0.045, 0.012);
    profile.closePath();
    const bladeGeo = new THREE.ExtrudeGeometry(profile, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
    bladeGeo.rotateY(Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeo, m.blade);
    blade.position.set(-0.004, 0.006, -0.035);
    blade.name = 'blade';
    g.add(blade);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.002, 0.23), m.dark);
    fuller.position.set(0.005, 0.008, -0.16);
    g.add(fuller);
  } else {
    // Lâmina reta de perfil estreito para stiletto e faca clássica.
    const bladeLength = style === 'stiletto' ? 0.27 : 0.215;
    const bladeWidth = style === 'stiletto' ? 0.012 : 0.019;
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.002, bladeWidth, bladeLength, 6, 1), m.blade);
    blade.rotation.x = Math.PI / 2;
    blade.position.set(0, 0.004, -0.035 - bladeLength * 0.48);
    blade.name = 'blade';
    g.add(blade);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, bladeLength * 0.62), m.dark);
    fuller.position.set(0, 0.014, -0.06 - bladeLength * 0.34);
    g.add(fuller);
    R(g, 0.068, 0.014, 0.018, m.metal, 0, -0.001, -0.035, 0, 0, -0.06);
  }
  for (const x of [-0.021, 0.021]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), m.accent);
    add(g, rivet, x, 0.016, 0.055);
  }
  // The three specialist silhouettes use distinct in-world scales to keep
  // blade + handle proportions close to a practical ~33–36 cm knife.
  if (style === 'karambit') g.scale.setScalar(0.82);
  else if (style === 'butterfly') g.scale.setScalar(0.74);
  else if (style === 'm9') g.scale.setScalar(0.68);
  return g;
}

function buildSMG(m: Mats, kind: 'mac10' | 'mp9' | 'p90') {
  const g = new THREE.Group();
  if (kind === 'p90') {
    R(g, 0.06, 0.1, 0.46, m.furniture, 0, 0.005, 0.02);
    R(g, 0.05, 0.03, 0.3, m.glass, 0, 0.07, -0.02, 0, 0, 0, 'mag');
    C(g, 0.011, 0.1, m.metal, 0, 0.02, -0.25);
    R(g, 0.03, 0.03, 0.06, m.dark, 0, 0.1, -0.1);
    B(g, 0.012, 0.018, 0.012, m.dark, 0, 0.116, -0.22); // front sight
    B(g, 0.014, 0.02, 0.012, m.dark, 0, 0.116, 0.245); // rear sight
    for (const x of [-1, 1]) {
      for (let i = 0; i < 5; i++) B(g, 0.006, 0.024, 0.014, m.dark, x * 0.062, 0.005, -0.12 + i * 0.045);
      for (const z of [-0.14, 0.14]) C(g, 0.004, 0.003, m.metal, x * 0.062, -0.005, z, 'x', undefined, 8);
    }
    B(g, 0.036, 0.09, 0.08, m.dark, 0, -0.07, 0.0);
    muzzle(g, 0, 0.02, -0.3);
    support(g, 0, -0.04, -0.15);
    return g;
  }
  const len = kind === 'mac10' ? 0.24 : 0.28;
  R(g, 0.05, 0.08, len, m.receiver, 0, 0.02, -len / 2 + 0.05);
  topRail(g, m, -len * 0.72, 0.02, 0.063, 0.026, 5);
  B(g, 0.01, 0.018, 0.012, m.dark, 0, 0.077, 0.015); // rear sight
  receiverPins(g, m, 0.026, 0.02, [-len * 0.48, 0.02]);
  C(g, 0.01, 0.07, m.metal, 0, 0.04, -len + 0.02);
  R(g, 0.034, 0.1, 0.045, m.furniture, 0, -0.065, 0.02, -0.15);
  const mag = new THREE.Group();
  mag.name = 'mag';
  mag.position.set(0, -0.08, 0.02);
  B(mag, 0.026, 0.13, 0.035, m.mag, 0, -0.06, 0, -0.15);
  g.add(mag);
  if (kind === 'mp9') {
    B(g, 0.02, 0.07, 0.03, m.dark, 0, -0.03, -0.17);
    C(g, 0.008, 0.18, m.dark, 0, 0.03, 0.17);
    B(g, 0.03, 0.06, 0.012, m.dark, 0, 0.0, 0.26);
  } else {
    C(g, 0.005, 0.2, m.dark, 0.022, 0.0, 0.15);
    C(g, 0.005, 0.2, m.dark, -0.022, 0.0, 0.15);
    B(g, 0.05, 0.05, 0.01, m.dark, 0, -0.01, 0.25);
  }
  muzzle(g, 0, 0.04, -len - 0.02);
  support(g, 0, -0.05, -0.12);
  return g;
}

function buildFamas(m: Mats) {
  const g = new THREE.Group();
  R(g, 0.055, 0.1, 0.6, m.furniture, 0, 0.0, 0.02);
  R(g, 0.03, 0.03, 0.4, m.dark, 0, 0.11, -0.02);
  B(g, 0.02, 0.06, 0.02, m.dark, 0, 0.07, -0.2);
  B(g, 0.02, 0.06, 0.02, m.dark, 0, 0.07, 0.15);
  topRail(g, m, -0.2, 0.12, 0.126, 0.03, 10);
  B(g, 0.014, 0.02, 0.014, m.dark, 0, 0.143, 0.09); // rear sight
  receiverPins(g, m, 0.028, 0.005, [-0.12, 0.12]);
  C(g, 0.011, 0.25, m.metal, 0, 0.02, -0.4);
  C(g, 0.006, 0.12, m.dark, 0.0, -0.05, -0.3);
  R(g, 0.034, 0.1, 0.045, m.dark, 0, -0.08, -0.05, -0.2);
  const mag = new THREE.Group();
  mag.name = 'mag';
  mag.position.set(0, -0.06, 0.13);
  B(mag, 0.028, 0.12, 0.06, m.mag, 0, -0.05, 0, 0.05);
  g.add(mag);
  muzzle(g, 0, 0.02, -0.54);
  support(g, 0, -0.05, -0.2);
  return g;
}

function buildNova(m: Mats) {
  const g = new THREE.Group();
  R(g, 0.05, 0.07, 0.3, m.receiver, 0, 0.01, -0.05);
  C(g, 0.014, 0.5, m.metal, 0, 0.03, -0.45);
  C(g, 0.014, 0.42, m.dark, 0, -0.005, -0.4);
  C(g, 0.016, 0.018, m.metal, 0, 0.03, -0.63); // barrel clamp
  const pump = R(g, 0.05, 0.05, 0.18, m.furniture, 0, -0.005, -0.38);
  pump.name = 'mag';
  for (let i = 0; i < 3; i++) B(g, 0.042, 0.003, 0.006, m.dark, 0, 0.023, -0.44 + i * 0.06); // pump ribs
  R(g, 0.034, 0.1, 0.045, m.furniture, 0, -0.065, 0.07, -0.35);
  R(g, 0.046, 0.09, 0.3, m.furniture, 0, -0.03, 0.26, 0.1);
  B(g, 0.012, 0.012, 0.012, m.metal, 0, 0.05, -0.69); // front bead
  receiverPins(g, m, 0.026, 0.01, [-0.12, 0.02]);
  muzzle(g, 0, 0.03, -0.71);
  support(g, 0, -0.03, -0.38);
  return g;
}

export function buildC4() {
  const g = new THREE.Group();
  const tan = std({ color: 0xc8b48a, roughness: 0.85 });
  const tape = std({ color: 0x3a3a35, roughness: 0.6 });
  const black = std({ color: 0x151515, roughness: 0.5, metalness: 0.4 });
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) R(g, 0.2, 0.04, 0.055, tan, 0, 0.02 + j * 0.042, -0.03 + i * 0.058);
  B(g, 0.025, 0.09, 0.122, tape, -0.06, 0.04, 0);
  B(g, 0.025, 0.09, 0.122, tape, 0.06, 0.04, 0);
  R(g, 0.1, 0.03, 0.08, black, 0, 0.1, 0);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.018), new THREE.MeshBasicMaterial({ color: 0x7dff6a }));
  lcd.position.set(0, 0.1155, -0.02);
  lcd.rotation.x = -Math.PI / 2;
  lcd.name = 'lcd';
  g.add(lcd);
  const key = std({ color: 0x555555, roughness: 0.6 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) B(g, 0.014, 0.006, 0.01, key, -0.02 + i * 0.02, 0.117, 0.006 + j * 0.013);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  led.position.set(0.04, 0.118, -0.025);
  led.name = 'led';
  g.add(led);
  const wireCols = [0xc81e1e, 0x1e5bc8, 0xd8c21e];
  wireCols.forEach((col, i) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04 + i * 0.02, 0.1, 0.04), new THREE.Vector3(-0.05 + i * 0.03, 0.12, 0.07),
      new THREE.Vector3(-0.07 + i * 0.05, 0.07, 0.07), new THREE.Vector3(-0.08 + i * 0.06, 0.05, 0.035)
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.003, 6), std({ color: col, roughness: 0.5 }));
    g.add(tube);
  });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  support(g, 0, 0.02, 0);
  muzzle(g, 0, 0.1, -0.08);
  return g;
}

function buildGrenade(kind: 'he' | 'flash' | 'smoke') {
  const g = new THREE.Group();
  const metalM = std({ color: 0x8a8d90, metalness: 0.8, roughness: 0.35 });
  if (kind === 'he') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 12), std({ color: 0x4b5a35, roughness: 0.6, metalness: 0.3 }));
    body.scale.y = 1.15;
    add(g, body, 0, 0.0, 0);
  } else {
    C(g, 0.023, 0.1, kind === 'flash' ? std({ color: 0x9aa1a8, metalness: 0.7, roughness: 0.35 }) : std({ color: 0x6f7a72, metalness: 0.5, roughness: 0.4 }), 0, 0, 0, 'y');
    if (kind === 'smoke') C(g, 0.0235, 0.015, std({ color: 0x3c8c3c }), 0, 0.02, 0, 'y');
    else for (let i = 0; i < 3; i++) C(g, 0.0235, 0.004, std({ color: 0x333333 }), 0, -0.03 + i * 0.03, 0, 'y');
  }
  C(g, 0.012, 0.025, metalM, 0, 0.052, 0, 'y');
  B(g, 0.008, 0.07, 0.014, metalM, 0.018, 0.03, 0, 0, 0, 0.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 6, 16), metalM);
  add(g, ring, -0.015, 0.06, 0, 0, Math.PI / 2, 0);
  support(g, 0, 0, 0);
  muzzle(g, 0, 0, -0.04);
  return g;
}

/** build a weapon model with the given skin pattern */
export function buildWeapon(id: string, pattern: Pattern = 'default'): THREE.Group {
  const m = getMats(id, pattern);
  let g: THREE.Group;
  switch (id) {
    case 'ak47': g = buildAK(m); break;
    case 'galil': g = buildAK(m, true); break;
    case 'm4a4': g = buildM4(m, false); break;
    case 'm4a1s': g = buildM4(m, true); break;
    case 'famas': g = buildFamas(m); break;
    case 'awp': g = buildAWP(m); break;
    case 'ssg08': g = buildAWP(m, true); break;
    case 'glock': g = buildPistol(m, 'glock'); break;
    case 'usps': g = buildPistol(m, 'usps'); break;
    case 'deagle': g = buildPistol(m, 'deagle'); break;
    case 'knife': g = buildKnife(m, pattern); break;
    case 'mac10': g = buildSMG(m, 'mac10'); break;
    case 'mp9': g = buildSMG(m, 'mp9'); break;
    case 'p90': g = buildSMG(m, 'p90'); break;
    case 'nova': g = buildNova(m); break;
    case 'c4': g = buildC4(); break;
    case 'he': case 'flash': case 'smoke': g = buildGrenade(id); break;
    default: g = buildAK(m);
  }
  g.name = 'weapon_' + id;
  g.userData.weaponId = id;
  return g;
}

/** crude wooden ammo crate prop used in menus */
export function propCrate(size = 1) {
  const t = woodCrateTex();
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 2, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}
