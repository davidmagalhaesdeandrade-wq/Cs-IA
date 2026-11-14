import * as THREE from 'three';
import { Dust2Map, GW, GH, CELL, OX, OZ } from './Dust2';

const STEP = 0.55;

export class Nav {
  private collisionBlocked: Uint8Array;

  constructor(public map: Dust2Map) {
    this.collisionBlocked = new Uint8Array(GW * GH);
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const c = map.cell(x, z)!;
      if (!c.walk || c.blocked) continue;
      const p = map.cellCenter(x, z);
      if (map.collision.overlapAny(p.x, p.y + 0.02, p.z, 0.34, 1.7)) this.collisionBlocked[z * GW + x] = 1;
    }
  }

  walkable(x: number, z: number) {
    const c = this.map.cell(x, z);
    return !!c && c.walk && !c.blocked && this.collisionBlocked[z * GW + x] === 0;
  }
  private canStep(ax: number, az: number, bx: number, bz: number) {
    const a = this.map.cell(ax, az);
    if (!a || !this.walkable(ax, az) || !this.walkable(bx, bz)) return false;
    const b = this.map.cell(bx, bz)!;
    return Math.abs(a.h - b.h) <= STEP;
  }

  /** nearest walkable cell to a world position */
  nearestCell(p: THREE.Vector3): [number, number] | null {
    const [x, z] = this.map.worldToCell(p);
    if (x < 0 || z < 0 || x >= GW || z >= GH) return null;
    if (this.walkable(x, z)) return [x, z];
    for (let r = 1; r < Math.max(GW, GH); r++)
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.walkable(x + dx, z + dz)) return [x + dx, z + dz];
      }
    return null;
  }

  findPath(from: THREE.Vector3, to: THREE.Vector3, jitter = 0): THREE.Vector3[] | null {
    const start = this.nearestCell(from), target = this.nearestCell(to);
    if (!start || !target) return null;
    const [sx, sz] = start, [tx, tz] = target;
    const N = GW * GH;
    const g = new Float32Array(N).fill(Infinity);
    const f = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const idx = (x: number, z: number) => z * GW + x;
    const h = (x: number, z: number) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const open: number[] = [];
    const si = idx(sx, sz), ti = idx(tx, tz);
    g[si] = 0; f[si] = h(sx, sz);
    open.push(si);
    const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let iter = 0;
    while (open.length && iter++ < 5000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (cur === ti) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % GW, cz = (cur / GW) | 0;
      for (const [dx, dz, cost] of nb) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.canStep(cx, cz, nx, nz)) continue;
        if (dx && dz && (!this.canStep(cx, cz, cx + dx, cz) || !this.canStep(cx, cz, cx, cz + dz))) continue;
        const ni = idx(nx, nz);
        if (closed[ni]) continue;
        const ng = g[cur] + cost + (jitter ? Math.random() * jitter : 0);
        if (ng < g[ni]) {
          g[ni] = ng; f[ni] = ng + h(nx, nz); came[ni] = cur;
          open.push(ni);
        }
      }
    }
    if (si !== ti && came[ti] === -1) return null;
    const cells: [number, number][] = [];
    let c = ti;
    while (c !== -1 && c !== si) { cells.push([c % GW, (c / GW) | 0]); c = came[c]; }
    cells.reverse();
    const pts = cells.map(([x, z]) => this.map.cellCenter(x, z));
    const [goalX, goalZ] = this.map.worldToCell(to);
    const goal = goalX === tx && goalZ === tz &&
      !this.map.collision.overlapAny(to.x, to.y + 0.02, to.z, 0.34, 1.7)
      ? to.clone() : this.map.cellCenter(tx, tz);
    if (this.map.collision.overlapAny(goal.x, goal.y + 0.02, goal.z, 0.34, 1.7)) return null;
    pts.push(goal);
    return this.smooth(from, pts);
  }

  /** remove waypoints when straight line is clear on the grid (with clearance) */
  private smooth(from: THREE.Vector3, pts: THREE.Vector3[]) {
    const out: THREE.Vector3[] = [];
    let anchor = from.clone();
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      for (; j > i; j--) if (this.clearLine(anchor, pts[j])) break;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  clearLine(a: THREE.Vector3, b: THREE.Vector3) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const n = Math.ceil(len / 0.5);
    const px = -dz / (len || 1), pz = dx / (len || 1);
    let lastH: number | null = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      for (const off of [-0.45, 0, 0.45]) {
        const x = a.x + dx * t + px * off, z = a.z + dz * t + pz * off;
        const cx = Math.floor((x - OX) / CELL), cz = Math.floor((z - OZ) / CELL);
        if (!this.walkable(cx, cz)) return false;
        const hh = this.map.cells[cz][cx].h;
        if (this.map.collision.overlapAny(x, hh + 0.02, z, 0.34, 1.7)) return false;
        if (off === 0) {
          if (lastH !== null && Math.abs(hh - lastH) > STEP) return false;
          lastH = hh;
        }
      }
    }
    return true;
  }

  randomCellNear(cx: number, cz: number, r: number): THREE.Vector3 | null {
    for (let k = 0; k < 20; k++) {
      const x = cx + Math.round((Math.random() * 2 - 1) * r), z = cz + Math.round((Math.random() * 2 - 1) * r);
      if (this.walkable(x, z)) {
        const p = this.map.cellCenter(x, z);
        p.x += (Math.random() - 0.5) * 1.2; p.z += (Math.random() - 0.5) * 1.2;
        return p;
      }
    }
    return null;
  }
}
