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

function buildKnife(m: Mats) {
  const g = new THREE.Group();
  R(g, 0.026, 0.034, 0.12, m.furniture, 0, -0.005, 0.03);
  for (let i = 0; i < 4; i++) B(g, 0.028, 0.004, 0.006, m.dark, 0, -0.005 + 0.012, 0.0 + i * 0.025);
  B(g, 0.05, 0.012, 0.012, m.metal, 0, -0.002, -0.035);
  C(g, 0.012, 0.01, m.metal, 0, -0.005, 0.095);
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.012);
  sh.lineTo(0, 0.02);
  sh.lineTo(0.13, 0.024);
  sh.quadraticCurveTo(0.18, 0.02, 0.205, -0.002);
  sh.quadraticCurveTo(0.16, -0.012, 0.11, -0.017);
  sh.lineTo(0.02, -0.016);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
  geo.translate(0, 0, -0.002);
  // planar UVs for patterns
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 0.21; uv[i * 2 + 1] = (pos.getY(i) + 0.02) / 0.05; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const blade = new THREE.Mesh(geo, m.blade);
  add(g, blade, 0, 0.0, -0.04, 0, Math.PI / 2, 0, 'blade');
  muzzle(g, 0, 0, -0.24);
  return g;
}

function buildSMG(m: Mats, kind: 'mac10' | 'mp9' | 'p90') {
  const g = new THREE.Group();
  if (kind === 'p90') {
    R(g, 0.06, 0.1, 0.46, m.furniture, 0, 0.005, 0.02);
    R(g, 0.05, 0.03, 0.3, m.glass, 0, 0.07, -0.02, 0, 0, 0, 'mag');
    C(g, 0.011, 0.1, m.metal, 0, 0.02, -0.25);
    R(g, 0.03, 0.03, 0.06, m.dark, 0, 0.1, -0.1);
    B(g, 0.036, 0.09, 0.08, m.dark, 0, -0.07, 0.0);
    muzzle(g, 0, 0.02, -0.3);
    support(g, 0, -0.04, -0.15);
    return g;
  }
  const len = kind === 'mac10' ? 0.24 : 0.28;
  R(g, 0.05, 0.08, len, m.receiver, 0, 0.02, -len / 2 + 0.05);
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
  const pump = R(g, 0.05, 0.05, 0.18, m.furniture, 0, -0.005, -0.38);
  pump.name = 'mag';
  R(g, 0.034, 0.1, 0.045, m.furniture, 0, -0.065, 0.07, -0.35);
  R(g, 0.046, 0.09, 0.3, m.furniture, 0, -0.03, 0.26, 0.1);
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
    case 'knife': g = buildKnife(m); break;
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
