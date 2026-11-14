import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld, Surface } from './Collision';
import { wallTex, floorSandTex, floorTileTex, woodCrateTex, metalTex, concreteTex, stencilTex, signTex, leafTex } from '../render/textures';
import type { Quality } from '../core/Settings';

export const CELL = 3;
export const GW = 36;
export const GH = 44;
export const OX = -(GW * CELL) / 2;
export const OZ = -(GH * CELL) / 2;

export type Tag = '' | 'T' | 'C' | 'A' | 'B';
export interface Cell {
  x: number; z: number;
  walk: boolean;
  h: number;
  tag: Tag;
  blocked: boolean;
  roof: boolean;
  wallH: number;
  tile: boolean;
}

// carve(x0,z0,x1,z1,height,tag?, tiled?)
const RECTS: [number, number, number, number, number, Tag?, boolean?][] = [
  [12, 35, 23, 42, 0, 'T'],           // T spawn
  [22, 33, 30, 36, 0],                // T -> outside long
  [27, 29, 34, 32, 0],                // outside long
  [31, 27, 32, 28, 0],                // long doors
  [30, 14, 34, 26, 0],                // long A
  [30, 12, 34, 13, 0.5],              // A ramp
  [24, 2, 34, 11, 1.0, '', true],     // A site area (raised)
  [19, 18, 20, 19, 0.5],              // catwalk stairs
  [21, 18, 24, 19, 1.0],              // catwalk
  [22, 12, 24, 17, 1.0],              // short A
  [15, 11, 18, 34, 0],                // mid
  [16, 9, 17, 10, 0],                 // mid doors
  [13, 2, 21, 8, 0, 'C', true],       // CT spawn
  [22, 3, 23, 6, 0.5],                // CT -> A
  [11, 4, 12, 5, 0],                  // B doors
  [1, 2, 10, 11, 0, '', true],        // B site area
  [3, 12, 6, 22, 0],                  // B tunnel exit
  [3, 23, 10, 30, 0],                 // upper tunnels
  [8, 31, 11, 36, 0],                 // tunnels -> T spawn
  [11, 24, 14, 26, 0]                 // lower tunnels
];
const SITE_A: [number, number, number, number] = [25, 3, 33, 10];
const SITE_B: [number, number, number, number] = [1, 2, 9, 10];
const ROOFS: [number, number, number, number, number][] = [
  [3, 23, 10, 29, 3.6], [11, 24, 14, 26, 3.4], [3, 17, 6, 22, 3.6]
];
const LINTELS: [number, number, number, number][] = [
  [16, 9, 17, 10], [31, 27, 32, 28], [11, 4, 12, 5], [22, 3, 23, 6]
];
// crates: cell x, z, stack height (1 or 2)
const CRATES: [number, number, number][] = [
  [27, 6, 1], [28, 6, 2], [31, 3, 2], [32, 3, 1], [32, 8, 1], [25, 9, 1],
  [3, 4, 2], [4, 4, 1], [3, 5, 1], [8, 8, 2], [9, 3, 1], [6, 10, 1],
  [16, 21, 1], [33, 22, 1], [30, 17, 2], [14, 37, 1], [21, 39, 2], [19, 4, 1],
  [33, 31, 2], [5, 26, 1], [17, 14, 1]
];

export const LOCATIONS: { name: string; r: [number, number, number, number] }[] = [
  { name: 'Bomb A', r: [24, 2, 34, 11] },
  { name: 'Bomb B', r: [1, 2, 10, 11] },
  { name: 'Base CT', r: [13, 2, 21, 8] },
  { name: 'Base TR', r: [12, 35, 23, 42] },
  { name: 'Long A', r: [30, 12, 34, 26] },
  { name: 'Portas Long', r: [31, 27, 32, 28] },
  { name: 'Fora do Long', r: [22, 29, 34, 36] },
  { name: 'Short A', r: [19, 12, 24, 19] },
  { name: 'Portas Meio', r: [16, 9, 17, 10] },
  { name: 'Meio', r: [15, 11, 18, 34] },
  { name: 'Portas B', r: [11, 4, 12, 5] },
  { name: 'Túnel B', r: [3, 12, 6, 22] },
  { name: 'Túneis Sup.', r: [3, 23, 10, 36] },
  { name: 'Túneis Inf.', r: [11, 24, 14, 26] },
  { name: 'CT → A', r: [22, 3, 23, 6] }
];

function hash2(x: number, z: number) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** builds a box with world-space UVs (texture scale in meters) */
function boxGeo(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, s: number, skipBottom = true) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], uvf: (p: number[]) => [number, number]) => {
    for (const p of [a, b, c, a, c, d]) { pos.push(...p); nor.push(...n); const t = uvf(p); uv.push(t[0] / s, t[1] / s); }
  };
  // +X
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], (p) => [-p[2], p[1]]);
  // -X
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], (p) => [p[2], p[1]]);
  // +Z
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], (p) => [p[0], p[1]]);
  // -Z
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], (p) => [-p[0], p[1]]);
  // +Y
  quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], (p) => [p[0], -p[2]]);
  if (!skipBottom) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], (p) => [p[0], p[2]]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

class GeoBucket {
  geos: THREE.BufferGeometry[] = [];
  constructor(public mat: THREE.Material, public shadow = true) {}
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, s = 4, skipBottom = true) {
    this.geos.push(boxGeo(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), s, skipBottom));
  }
  geo(g: THREE.BufferGeometry) {
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
    this.geos.push(ng);
  }
  build(parent: THREE.Object3D) {
    if (!this.geos.length) return;
    const merged = mergeGeometries(this.geos, false);
    const m = new THREE.Mesh(merged, this.mat);
    m.castShadow = this.shadow;
    m.receiveShadow = true;
    parent.add(m);
    this.geos.forEach((g) => g.dispose());
  }
}

export class Dust2Map {
  cells: Cell[][] = [];
  collision = new CollisionWorld();
  group = new THREE.Group();
  tSpawns: THREE.Vector3[] = [];
  ctSpawns: THREE.Vector3[] = [];
  siteCenters: Record<'A' | 'B', THREE.Vector3> = { A: new THREE.Vector3(), B: new THREE.Vector3() };
  sun!: THREE.DirectionalLight;
  lights: THREE.Light[] = [];

  constructor() {
    for (let z = 0; z < GH; z++) {
      const row: Cell[] = [];
      for (let x = 0; x < GW; x++) row.push({ x, z, walk: false, h: 0, tag: '', blocked: false, roof: false, wallH: 8, tile: false });
      this.cells.push(row);
    }
    for (const [x0, z0, x1, z1, h, tag, tile] of RECTS)
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const c = this.cells[z][x];
        c.walk = true; c.h = h;
        if (tag) c.tag = tag;
        if (tile) c.tile = true;
      }
    const tagRect = (r: number[], t: Tag) => { for (let z = r[1]; z <= r[3]; z++) for (let x = r[0]; x <= r[2]; x++) if (this.cells[z][x].walk) this.cells[z][x].tag = t; };
    tagRect(SITE_A, 'A');
    tagRect(SITE_B, 'B');
    for (const [x, z] of CRATES) this.cells[z][x].blocked = true;
    for (const [x0, z0, x1, z1] of ROOFS) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (this.cells[z][x].walk) this.cells[z][x].roof = true;
    // wall heights
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const c = this.cells[z][x];
      if (c.walk) continue;
      const h = hash2(Math.floor(x / 2), Math.floor(z / 2));
      c.wallH = 6.5 + Math.round(h * 7) * 0.5;
    }
    this.siteCenters.A = this.cellCenter(29, 6);
    this.siteCenters.B = this.cellCenter(5, 7);
    for (let z = 38; z <= 41; z++) for (let x = 14; x <= 21; x++) if (!this.cells[z][x].blocked) this.tSpawns.push(this.cellCenter(x, z));
    for (let z = 3; z <= 6; z++) for (let x = 14; x <= 20; x++) if (!this.cells[z][x].blocked) this.ctSpawns.push(this.cellCenter(x, z));
  }

  cell(x: number, z: number): Cell | null {
    if (x < 0 || z < 0 || x >= GW || z >= GH) return null;
    return this.cells[z][x];
  }
  worldToCell(p: THREE.Vector3): [number, number] {
    return [Math.floor((p.x - OX) / CELL), Math.floor((p.z - OZ) / CELL)];
  }
  cellAt(p: THREE.Vector3): Cell | null {
    const [x, z] = this.worldToCell(p);
    return this.cell(x, z);
  }
  cellCenter(x: number, z: number, out = new THREE.Vector3()) {
    const c = this.cell(x, z);
    return out.set(OX + (x + 0.5) * CELL, c ? c.h : 0, OZ + (z + 0.5) * CELL);
  }
  siteAt(p: THREE.Vector3): 'A' | 'B' | null {
    const c = this.cellAt(p);
    if (!c || !c.walk) return null;
    return c.tag === 'A' ? 'A' : c.tag === 'B' ? 'B' : null;
  }
  inBuyZone(p: THREE.Vector3, team: 'T' | 'CT') {
    const c = this.cellAt(p);
    if (!c) return false;
    return team === 'T' ? c.tag === 'T' || (c.z >= 33 && c.x >= 10 && c.x <= 24) : c.tag === 'C' || (c.z <= 9 && c.x >= 12 && c.x <= 22);
  }
  locationName(p: THREE.Vector3) {
    const [x, z] = this.worldToCell(p);
    for (const l of LOCATIONS) if (x >= l.r[0] && x <= l.r[2] && z >= l.r[1] && z <= l.r[3]) return l.name;
    return '';
  }

  build(scene: THREE.Scene, quality: Quality, shadows: boolean) {
    const g = this.group;
    scene.add(g);
    const wallT = [wallTex(0), wallTex(1), wallTex(2)];
    const wallMats = wallT.map((t) => new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 3, roughness: 0.93, color: 0xffffff }));
    const sand = floorSandTex(), tile = floorTileTex();
    const sandMat = new THREE.MeshStandardMaterial({ map: sand.map, bumpMap: sand.bump, bumpScale: 1.5, roughness: 0.97 });
    const tileMat = new THREE.MeshStandardMaterial({ map: tile.map, bumpMap: tile.bump, bumpScale: 2.5, roughness: 0.88 });
    const crateT = woodCrateTex(), crateT2 = woodCrateTex(true);
    const crateMat = new THREE.MeshStandardMaterial({ map: crateT.map, bumpMap: crateT.bump, bumpScale: 3, roughness: 0.85 });
    const crateMat2 = new THREE.MeshStandardMaterial({ map: crateT2.map, bumpMap: crateT2.bump, bumpScale: 3, roughness: 0.85 });
    const conc = concreteTex();
    const trimMat = new THREE.MeshStandardMaterial({ map: conc.map, bumpMap: conc.bump, bumpScale: 2, roughness: 0.95, color: 0xb8a68a });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.6, metalness: 0.2 });
    const woodMat = new THREE.MeshStandardMaterial({ map: crateT2.map, roughness: 0.8, color: 0xc89a6a });
    const doorT = metalTex('#3f6f7c');
    const doorMat = new THREE.MeshStandardMaterial({ map: doorT.map, bumpMap: doorT.bump, bumpScale: 2, roughness: 0.6, metalness: 0.4 });
    const doorT2 = metalTex('#7a4a2a');
    const doorMat2 = new THREE.MeshStandardMaterial({ map: doorT2.map, bumpMap: doorT2.bump, bumpScale: 2, roughness: 0.7, metalness: 0.3 });
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6d6a63, roughness: 0.5, metalness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ map: conc.map, roughness: 0.95, color: 0x9c8a70 });

    const walls = wallMats.map((m) => new GeoBucket(m));
    const floorSand = new GeoBucket(sandMat, false);
    const floorTile = new GeoBucket(tileMat, false);
    const trims = new GeoBucket(trimMat);
    const darks = new GeoBucket(darkMat);
    const woods = new GeoBucket(woodMat);
    const doors = new GeoBucket(doorMat);
    const doors2 = new GeoBucket(doorMat2);
    const pipes = new GeoBucket(pipeMat);
    const roofs = new GeoBucket(roofMat);
    const crates1 = new GeoBucket(crateMat);
    const crates2 = new GeoBucket(crateMat2);
    const col = this.collision;

    // ---------- walls (greedy merge by height) ----------
    const used: boolean[][] = this.cells.map((r) => r.map(() => false));
    const isWall = (x: number, z: number, h: number) => { const c = this.cell(x, z); return c && !c.walk && !used[z][x] && c.wallH === h; };
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const c = this.cells[z][x];
      if (c.walk || used[z][x]) continue;
      const h = c.wallH;
      let x1 = x;
      while (isWall(x1 + 1, z, h)) x1++;
      let z1 = z;
      outer: while (true) {
        for (let xx = x; xx <= x1; xx++) if (!isWall(xx, z1 + 1, h)) break outer;
        z1++;
      }
      for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) used[zz][xx] = true;
      const wx0 = OX + x * CELL, wz0 = OZ + z * CELL, wx1 = OX + (x1 + 1) * CELL, wz1 = OZ + (z1 + 1) * CELL;
      const variant = Math.floor(hash2(x * 3 + 1, z * 7 + 2) * 3);
      walls[variant].box(wx0, -1, wz0, wx1, h, wz1, 4);
      col.add(wx0, -1, wz0, wx1, h, wz1, 'stone');
    }
    // perimeter safety walls
    const W0 = OX, W1 = OX + GW * CELL, Z0 = OZ, Z1 = OZ + GH * CELL;
    col.add(W0 - 5, -5, Z0 - 5, W0, 50, Z1 + 5);
    col.add(W1, -5, Z0 - 5, W1 + 5, 50, Z1 + 5);
    col.add(W0, -5, Z0 - 5, W1, 50, Z0);
    col.add(W0, -5, Z1, W1, 50, Z1 + 5);
    col.add(W0, -6, Z0, W1, -1, Z1);

    // ---------- floors (greedy merge by height + material) ----------
    const usedF: boolean[][] = this.cells.map((r) => r.map(() => false));
    const isF = (x: number, z: number, h: number, t: boolean) => { const c = this.cell(x, z); return c && c.walk && !usedF[z][x] && c.h === h && c.tile === t; };
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const c = this.cells[z][x];
      if (!c.walk || usedF[z][x]) continue;
      let x1 = x;
      while (isF(x1 + 1, z, c.h, c.tile)) x1++;
      let z1 = z;
      outer2: while (true) {
        for (let xx = x; xx <= x1; xx++) if (!isF(xx, z1 + 1, c.h, c.tile)) break outer2;
        z1++;
      }
      for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) usedF[zz][xx] = true;
      const wx0 = OX + x * CELL, wz0 = OZ + z * CELL, wx1 = OX + (x1 + 1) * CELL, wz1 = OZ + (z1 + 1) * CELL;
      (c.tile ? floorTile : floorSand).box(wx0, -1, wz0, wx1, c.h, wz1, c.tile ? 4 : 6);
      col.add(wx0, -1, wz0, wx1, c.h, wz1, c.tile ? 'stone' : 'sand');
      // step edge trim
      if (c.h > 0) trims.box(wx0, c.h - 0.06, wz0, wx1, c.h + 0.0, wz1, 2);
    }

    // ---------- wall-face decoration ----------
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const c = this.cells[z][x];
      if (!c.walk) continue;
      for (const [dx, dz] of dirs) {
        const n = this.cell(x + dx, z + dz);
        if (!n || n.walk) continue;
        // face from the walkable cell toward the wall at (dx,dz); outward normal = (-dx,-dz)
        const cx = OX + (x + 0.5) * CELL, cz = OZ + (z + 0.5) * CELL;
        const bx = cx + dx * CELL / 2, bz = cz + dz * CELL / 2; // boundary center
        const nx = -dx, nz = -dz; // normal into walkable
        const along = dx !== 0 ? 'z' : 'x';
        // helper: box spanning along [a0,a1] (relative to boundary center), out [o0,o1], y [y0,y1]
        const fb = (bucket: GeoBucket, a0: number, a1: number, o0: number, o1: number, y0: number, y1: number, s = 2) => {
          if (along === 'z') bucket.box(bx + nx * o0, y0, bz + a0, bx + nx * o1, y1, bz + a1, s);
          else bucket.box(bx + a0, y0, bz + nz * o0, bx + a1, y1, bz + nz * o1, s);
        };
        const fh = c.h, H = n.wallH;
        const r = hash2(x * 13 + dx * 5 + 7, z * 17 + dz * 3 + 11);
        const r2 = hash2(x * 31 + dx, z * 29 + dz);
        // baseboard
        fb(trims, -1.5, 1.5, 0, 0.08, fh - 0.1, fh + 0.42, 2);
        // cornice / parapet cap
        fb(trims, -1.52, 1.52, -0.02, 0.2, H - 0.22, H, 2);
        fb(trims, -1.52, 1.52, -0.02, 0.1, H - 0.4, H - 0.3, 2);
        if (c.roof) continue;
        if (r < 0.2 && H - fh > 5) {
          // window with frame, glass and shutters
          const wy = fh + 3.2 + r2 * 0.6;
          fb(woods, -0.7, 0.7, 0, 0.07, wy - 0.05, wy + 1.55, 1);
          fb(darks, -0.55, 0.55, 0.05, 0.075, wy + 0.1, wy + 1.4, 1);
          fb(woods, -0.04, 0.04, 0.05, 0.1, wy + 0.1, wy + 1.4, 1);
          fb(trims, -0.8, 0.8, 0, 0.18, wy - 0.15, wy - 0.02, 1);
          if (r2 > 0.4) { fb(woods, -1.25, -0.72, 0.06, 0.1, wy, wy + 1.45, 1); fb(woods, 0.72, 1.25, 0.06, 0.1, wy, wy + 1.45, 1); }
          if (r2 > 0.75) { // balcony
            fb(trims, -1.0, 1.0, 0, 0.7, wy - 0.3, wy - 0.15, 1);
            fb(pipes, -1.0, 1.0, 0.65, 0.7, wy - 0.15, wy + 0.6, 1);
          }
        } else if (r < 0.27 && H - fh > 3) {
          // decorative door
          const mat = r2 > 0.5 ? doors : doors2;
          fb(trims, -0.85, 0.85, 0, 0.1, fh, fh + 2.65, 1);
          fb(mat, -0.7, 0.7, 0.05, 0.12, fh, fh + 2.5, 2.5);
          fb(darks, 0.45, 0.55, 0.12, 0.16, fh + 1.1, fh + 1.2, 1);
        } else if (r < 0.33) {
          // vertical pipe
          const a = (r2 - 0.5) * 2;
          if (along === 'z') pipes.geo(new THREE.CylinderGeometry(0.06, 0.06, H - fh, 8).translate(bx + nx * 0.12, fh + (H - fh) / 2, bz + a));
          else pipes.geo(new THREE.CylinderGeometry(0.06, 0.06, H - fh, 8).translate(bx + a, fh + (H - fh) / 2, bz + nz * 0.12));
        } else if (r < 0.37 && H - fh > 4) {
          // AC unit / electrical box
          const y = fh + 2.2 + r2;
          fb(pipes, -0.4, 0.4, 0, 0.35, y, y + 0.55, 1);
          fb(darks, -0.3, 0.3, 0.35, 0.36, y + 0.08, y + 0.47, 1);
        }
      }
    }

    // ---------- roofs (tunnels) ----------
    for (const [x0, z0, x1, z1, y] of ROOFS) {
      const wx0 = OX + x0 * CELL, wz0 = OZ + z0 * CELL, wx1 = OX + (x1 + 1) * CELL, wz1 = OZ + (z1 + 1) * CELL;
      roofs.box(wx0, y, wz0, wx1, y + 0.5, wz1, 4, false);
      col.add(wx0, y, wz0, wx1, y + 0.5, wz1, 'stone');
      for (let xx = x0; xx <= x1 + 1; xx += 2) woods.box(OX + xx * CELL - 0.12, y - 0.25, wz0, OX + xx * CELL + 0.12, y, wz1, 2); // beams
    }
    // ---------- lintels over doorways ----------
    for (const [x0, z0, x1, z1] of LINTELS) {
      const wx0 = OX + x0 * CELL, wz0 = OZ + z0 * CELL, wx1 = OX + (x1 + 1) * CELL, wz1 = OZ + (z1 + 1) * CELL;
      const fh = this.cells[z0][x0].h;
      let top = 99;
      for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) { const c = this.cell(x, z); if (c && !c.walk) top = Math.min(top, c.wallH); }
      top = Math.min(top, 7.5);
      walls[1].box(wx0, fh + 3.3, wz0, wx1, top, wz1, 4, false);
      col.add(wx0, fh + 3.3, wz0, wx1, top, wz1, 'stone');
      trims.box(wx0 - 0.1, fh + 3.15, wz0 - 0.1, wx1 + 0.1, fh + 3.35, wz1 + 0.1, 2, false);
    }
    // ---------- wooden doors (open, flat against walls) ----------
    const doorPanel = (x0: number, z0: number, x1: number, z1: number, h: number, mat: GeoBucket) => {
      mat.box(x0, h, z0, x1, h + 3.0, z1, 2.5);
      col.add(Math.min(x0, x1), h, Math.min(z0, z1), Math.max(x0, x1), h + 3.0, Math.max(z0, z1), 'wood');
    };
    { // long doors at x cols 31-32, z row 27
      const zA = OZ + 27 * CELL + 0.3;
      const xL = OX + 31 * CELL, xR = OX + 33 * CELL;
      doorPanel(xL, zA, xL + 0.12, zA + 2.6, 0, doors2);
      doorPanel(xR - 0.12, zA, xR, zA + 2.6, 0, doors2);
    }
    { // mid doors x cols 16-17, z row 10
      const zA = OZ + 10 * CELL + 0.2;
      const xL = OX + 16 * CELL, xR = OX + 18 * CELL;
      doorPanel(xL, zA, xL + 0.12, zA + 2.6, 0, doors);
      doorPanel(xR - 0.12, zA, xR, zA + 2.6, 0, doors);
    }
    { // B doors (broken)
      const xA = OX + 12 * CELL + 0.2;
      const zT = OZ + 4 * CELL;
      doorPanel(xA, zT, xA + 2.4, zT + 0.12, 0, woods);
    }

    // ---------- crates ----------
    for (const [x, z, stack] of CRATES) {
      const c = this.cells[z][x];
      const cx = OX + (x + 0.5) * CELL, cz = OZ + (z + 0.5) * CELL;
      const s = 2.3, hh = 1.15;
      const rot = (hash2(x, z) - 0.5) * 0.3;
      const bucket = hash2(z, x) > 0.5 ? crates1 : crates2;
      for (let i = 0; i < stack; i++) {
        const geo = new THREE.BoxGeometry(i ? s * 0.92 : s, hh, i ? s * 0.92 : s);
        geo.rotateY(i ? rot : 0);
        geo.translate(cx, c.h + hh * (i + 0.5), cz);
        bucket.geo(geo);
        // metal straps
        const strap = new THREE.BoxGeometry(0.08, hh + 0.02, s + 0.02);
        strap.rotateY(i ? rot : 0);
        strap.translate(cx + (i ? 0.3 : -0.5), c.h + hh * (i + 0.5), cz);
        darks.geo(strap);
      }
      col.add(cx - s / 2, c.h, cz - s / 2, cx + s / 2, c.h + hh * stack, cz + s / 2, 'wood');
    }

    // ---------- barrels ----------
    const barrelMats = [0x2f5d8a, 0x8a2f2f, 0x4f6b3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.5, map: metalTex('#ffffff').map }));
    const barrelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 14);
    let bi = 0;
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const c = this.cells[z][x];
      if (!c.walk || c.blocked || c.tag === 'T' || c.tag === 'C') continue;
      if (hash2(x * 7 + 3, z * 5 + 1) > 0.075) continue;
      // hug a wall corner if any
      let px = OX + (x + 0.5) * CELL, pz = OZ + (z + 0.5) * CELL;
      let hug = false;
      for (const [dx, dz] of dirs) {
        const n = this.cell(x + dx, z + dz);
        if (n && !n.walk) { px += dx * (CELL / 2 - 0.4); pz += dz * (CELL / 2 - 0.4); hug = true; break; }
      }
      if (!hug) continue;
      const m = new THREE.Mesh(barrelGeo, barrelMats[bi++ % 3]);
      m.position.set(px, c.h + 0.475, pz);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      col.add(px - 0.32, c.h, pz - 0.32, px + 0.32, c.h + 0.95, pz + 0.32, 'metal');
    }

    // ---------- palms ----------
    const palm = (x: number, z: number, h: number) => {
      const p = new THREE.Group();
      const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a6145, roughness: 0.95 });
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.012, 0.2 - i * 0.012, h / segs + 0.05, 8), trunkM);
        s.position.set(Math.sin(i * 0.25) * 0.25 * i / segs, (i + 0.5) * h / segs, 0);
        s.rotation.z = -0.05 * i / segs;
        s.castShadow = true;
        p.add(s);
      }
      const lm = new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
      for (let i = 0; i < 9; i++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.8, 1, 4), lm);
        const pos = leaf.geometry.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < pos.count; k++) { const yy = pos.getY(k); pos.setZ(k, -Math.pow((yy + 1.4) / 2.8, 2) * 0.9); }
        leaf.geometry.computeVertexNormals();
        leaf.geometry.translate(0, 1.4, 0);
        const holder = new THREE.Group();
        holder.position.set(0.25, h, 0);
        holder.rotation.y = (i / 9) * Math.PI * 2;
        leaf.rotation.x = 1.05;
        holder.add(leaf);
        leaf.castShadow = true;
        p.add(holder);
      }
      const c = this.cellAt(new THREE.Vector3(x, 0, z));
      p.position.set(x, c ? c.h : 0, z);
      g.add(p);
      col.add(x - 0.22, 0, z - 0.22, x + 0.22, h, z + 0.22, 'wood');
    };
    palm(OX + 12.3 * CELL, OZ + 42.6 * CELL, 7);
    palm(OX + 23.7 * CELL, OZ + 41.5 * CELL, 8);
    palm(OX + 13.3 * CELL, OZ + 2.4 * CELL, 7.5);
    palm(OX + 33.6 * CELL, OZ + 2.4 * CELL, 6.5);
    palm(OX + 1.4 * CELL, OZ + 2.4 * CELL, 7);

    // ---------- skyline towers outside the play area ----------
    const towerMat = wallMats[1];
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xcbb38a, roughness: 0.8 });
    const towers: [number, number, number, number][] = [
      [-62, -40, 22, 6], [60, -55, 18, 7], [-58, 30, 16, 8], [62, 40, 26, 5], [10, -76, 20, 9], [-20, 75, 17, 8], [35, 74, 24, 6], [-45, -74, 15, 10]
    ];
    for (const [x, z, h, w] of towers) {
      walls[(x + z) & 1 ? 0 : 2].box(x - w / 2, -1, z - w / 2, x + w / 2, h, z + w / 2, 4);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(w * 0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.position.set(x, h, z);
      g.add(dome);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        darks.box(x + Math.cos(a) * (w / 2 + 0.01) - (Math.abs(Math.sin(a)) * 0.6), h - 4, z + Math.sin(a) * (w / 2 + 0.01) - (Math.abs(Math.cos(a)) * 0.6),
          x + Math.cos(a) * (w / 2 + 0.05) + (Math.abs(Math.sin(a)) * 0.6), h - 2.4, z + Math.sin(a) * (w / 2 + 0.05) + (Math.abs(Math.cos(a)) * 0.6), 1);
      }
      void towerMat;
    }

    // ---------- hanging cables ----------
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
    const cables: [number, number, number, number, number][] = [
      [15, 20, 19, 20, 6], [15, 28, 19, 28, 5.5], [30, 20, 35, 20, 6.5], [27, 30, 35, 30, 6], [1, 6, 11, 6, 7], [13, 5, 22, 5, 6.5], [3, 15, 7, 15, 6]
    ];
    for (const [x0, z0, x1, z1, y] of cables) {
      const a = new THREE.Vector3(OX + x0 * CELL, y, OZ + (z0 + 0.5) * CELL);
      const b = new THREE.Vector3(OX + x1 * CELL, y, OZ + (z1 + 0.5) * CELL);
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.9;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.025, 5), cableMat);
      g.add(tube);
    }

    // ---------- site stencils & signs ----------
    const decal = (tex: THREE.Texture, x: number, y: number, z: number, size: number, rotY: number, onFloor: boolean) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.9 }));
      m.position.set(x, y, z);
      if (onFloor) m.rotation.set(-Math.PI / 2, 0, rotY);
      else m.rotation.y = rotY;
      m.receiveShadow = true;
      g.add(m);
    };
    const aC = this.cellCenter(29, 6), bC = this.cellCenter(5, 7);
    decal(stencilTex('A'), aC.x + 1.5, aC.y + 0.015, aC.z + 1.5, 3.2, 0.2, true);
    decal(stencilTex('B'), bC.x, bC.y + 0.015, bC.z + 1.5, 3.2, -0.1, true);
    // wall callouts
    decal(stencilTex('A', '#c3261d', true), OX + 35 * CELL - 0.03, 2.2, OZ + 20 * CELL, 2.4, -Math.PI / 2, false);
    decal(stencilTex('B', '#c3261d', true), OX + 3 * CELL + 0.03, 2.0, OZ + 18 * CELL, 2.4, Math.PI / 2, false);
    decal(stencilTex('A', '#c3261d', true), OX + 19 * CELL - 0.03, 2.0, OZ + 16 * CELL, 2.2, -Math.PI / 2, false);
    decal(stencilTex('B', '#c3261d', true), OX + 15 * CELL + 0.03, 2.0, OZ + 27.5 * CELL, 2.2, Math.PI / 2, false);
    const sign = (text: string, x: number, y: number, z: number, rotY: number, bg?: string) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: signTex(text, bg), roughness: 0.6, metalness: 0.2 }));
      m.position.set(x, y, z); m.rotation.y = rotY; g.add(m);
    };
    sign('MID', OX + 13.5 * CELL, 3.2, OZ + 35 * CELL + 0.03, 0, '#7a2a1f');
    sign('LONG A', OX + 25.5 * CELL, 3.4, OZ + 33 * CELL + 0.03, 0, '#2f5d8a');
    sign('B', OX + 12 * CELL - 0.03, 3.2, OZ + 33.5 * CELL, -Math.PI / 2, '#2f5d8a');

    // ---------- tunnel lamps ----------
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff1c4, emissive: 0xffd27a, emissiveIntensity: 2.5 });
    const lamps: [number, number, number][] = [[6.5, 26, 3.6], [12.5, 25, 3.4], [4.5, 19.5, 3.6]];
    for (const [x, z, y] of lamps) {
      const p = new THREE.Vector3(OX + x * CELL, y - 0.35, OZ + z * CELL);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lampMat);
      bulb.position.copy(p);
      g.add(bulb);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), darkMat);
      cord.position.set(p.x, p.y + 0.2, p.z);
      g.add(cord);
      const l = new THREE.PointLight(0xffc77a, 14, 13, 1.8);
      l.position.copy(p);
      g.add(l);
      this.lights.push(l);
    }

    // build merged meshes
    [...walls, floorSand, floorTile, trims, darks, woods, doors, doors2, pipes, roofs, crates1, crates2].forEach((b) => b.build(g));

    // ---------- sky + lighting ----------
    const skyGeo = new THREE.SphereGeometry(700, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: new THREE.Vector3(0.45, 0.75, 0.35).normalize() } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 zenith = vec3(0.20,0.45,0.85);
          vec3 horizon = vec3(0.80,0.84,0.86);
          vec3 ground = vec3(0.78,0.70,0.58);
          vec3 col = h > 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon, ground, min(1.0, -h*5.0));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0,0.9,0.7) * pow(s, 600.0) * 4.0 + vec3(1.0,0.85,0.6) * pow(s, 12.0) * 0.25;
          // soft clouds band
          float c = sin(vDir.x*9.0 + vDir.z*4.0) * sin(vDir.z*7.0 - vDir.x*3.0);
          col = mix(col, vec3(0.97), smoothstep(0.55, 0.95, c) * smoothstep(0.05, 0.25, h) * (1.0 - smoothstep(0.35, 0.7, h)) * 0.5);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    scene.add(sky);
    scene.fog = new THREE.Fog(0xd8d0bf, 90, 420);
    scene.background = new THREE.Color(0xbcd0e6);

    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xb08a5a, 1.25);
    scene.add(hemi);
    const amb = new THREE.AmbientLight(0xfff0dd, 0.25);
    scene.add(amb);
    const sun = new THREE.DirectionalLight(0xfff0d6, 3.2);
    sun.position.set(45, 75, 32);
    sun.target.position.set(0, 0, 0);
    scene.add(sun, sun.target);
    sun.castShadow = shadows;
    const sz = quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024;
    sun.shadow.mapSize.set(sz, sz);
    const sc = sun.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    this.sun = sun;
  }
}
