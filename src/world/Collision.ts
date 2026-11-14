import * as THREE from 'three';

export type Surface = 'stone' | 'sand' | 'wood' | 'metal';

export interface Box {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
  surf: Surface;
  /** Optional round horizontal footprint for cylindrical props. */
  circle?: { x: number; z: number; radius: number };
}

export interface RayHit {
  t: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  box: Box;
}

export interface Body {
  pos: THREE.Vector3; // feet center
  vel: THREE.Vector3;
  radius: number;
  height: number;
  onGround: boolean;
}

const EPS = 0.001;

/** Spatially-hashed set of axis-aligned boxes. All level geometry collision lives here. */
export class CollisionWorld {
  boxes: Box[] = [];
  private grid = new Map<number, Box[]>();
  private cell = 4;

  add(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, surf: Surface = 'stone'): Box {
    const b: Box = { minX, minY, minZ, maxX, maxY, maxZ, surf };
    this.boxes.push(b);
    const c = this.cell;
    for (let x = Math.floor(minX / c); x <= Math.floor(maxX / c); x++)
      for (let z = Math.floor(minZ / c); z <= Math.floor(maxZ / c); z++) {
        const k = this.key(x, z);
        let arr = this.grid.get(k);
        if (!arr) { arr = []; this.grid.set(k, arr); }
        arr.push(b);
      }
    return b;
  }

  addCylinder(x: number, minY: number, z: number, radius: number, maxY: number, surf: Surface = 'stone'): Box {
    const box = this.add(x - radius, minY, z - radius, x + radius, maxY, z + radius, surf);
    box.circle = { x, z, radius };
    return box;
  }
  private key(x: number, z: number) { return (x + 1000) * 4096 + (z + 1000); }

  private query(minX: number, minZ: number, maxX: number, maxZ: number, out: Set<Box>) {
    out.clear();
    const c = this.cell;
    for (let x = Math.floor(minX / c); x <= Math.floor(maxX / c); x++)
      for (let z = Math.floor(minZ / c); z <= Math.floor(maxZ / c); z++) {
        const arr = this.grid.get(this.key(x, z));
        if (arr) for (const b of arr) out.add(b);
      }
    return out;
  }
  private tmpSet = new Set<Box>();

  /** body AABB overlap test */
  overlapAny(x: number, y: number, z: number, r: number, h: number, ignoreBelowY = -Infinity): Box | null {
    const set = this.query(x - r, z - r, x + r, z + r, this.tmpSet);
    for (const b of set) {
      if (b.circle) {
        const dx = x - b.circle.x, dz = z - b.circle.z;
        const closestX = Math.max(-b.circle.radius, Math.min(dx, b.circle.radius));
        const closestZ = Math.max(-b.circle.radius, Math.min(dz, b.circle.radius));
        const ox = dx - closestX, oz = dz - closestZ;
        if (ox * ox + oz * oz >= r * r - EPS) continue;
      } else {
        if (x + r <= b.minX + EPS || x - r >= b.maxX - EPS) continue;
        if (z + r <= b.minZ + EPS || z - r >= b.maxZ - EPS) continue;
      }
      if (y + h <= b.minY + EPS || y >= b.maxY - EPS) continue;
      if (b.maxY <= ignoreBelowY) continue;
      return b;
    }
    return null;
  }

  /** highest box top under a point within maxDrop */
  groundHeight(x: number, y: number, z: number, r: number, maxDrop: number): number | null {
    const set = this.query(x - r, z - r, x + r, z + r, this.tmpSet);
    let best: number | null = null;
    for (const b of set) {
      if (b.circle) {
        const dx = x - b.circle.x, dz = z - b.circle.z;
        const ox = Math.max(Math.abs(dx) - r, 0), oz = Math.max(Math.abs(dz) - r, 0);
        if (ox * ox + oz * oz > b.circle.radius * b.circle.radius) continue;
      } else if (x + r <= b.minX || x - r >= b.maxX || z + r <= b.minZ || z - r >= b.maxZ) continue;
      if (b.maxY <= y + 0.05 && b.maxY >= y - maxDrop) {
        if (best === null || b.maxY > best) best = b.maxY;
      }
    }
    return best;
  }

  /** move a body with sliding, step-up and gravity handled by caller (vel.y). */
  move(body: Body, dt: number, stepHeight = 0.55, snapDown = true) {
    const steps = Math.max(1, Math.ceil((Math.abs(body.vel.x) + Math.abs(body.vel.z) + Math.abs(body.vel.y)) * dt / 0.2));
    const sdt = dt / steps;
    const wasGround = body.onGround;
    let hitWall = false;
    for (let s = 0; s < steps; s++) {
      hitWall = this.moveAxis(body, 'x', body.vel.x * sdt, stepHeight) || hitWall;
      hitWall = this.moveAxis(body, 'z', body.vel.z * sdt, stepHeight) || hitWall;
      // vertical
      const dy = body.vel.y * sdt;
      const p = body.pos;
      p.y += dy;
      const b = this.overlapAny(p.x, p.y, p.z, body.radius, body.height);
      if (b) {
        if (dy <= 0) { p.y = b.maxY; body.vel.y = 0; body.onGround = true; }
        else { p.y = b.minY - body.height - EPS; body.vel.y = 0; }
      } else {
        const g = this.groundHeight(p.x, p.y, p.z, body.radius - 0.02, 0.02);
        body.onGround = g !== null && body.vel.y <= 0;
      }
    }
    // snap down slopes/steps when walking
    if (snapDown && wasGround && !body.onGround && body.vel.y <= 0) {
      const g = this.groundHeight(body.pos.x, body.pos.y, body.pos.z, body.radius - 0.02, stepHeight + 0.05);
      if (g !== null) { body.pos.y = g; body.onGround = true; body.vel.y = 0; }
    }
    return hitWall;
  }

  private moveAxis(body: Body, axis: 'x' | 'z', d: number, stepHeight: number): boolean {
    if (d === 0) return false;
    const p = body.pos;
    const r = body.radius;
    p[axis] += d;
    const b = this.overlapAny(p.x, p.y, p.z, r, body.height);
    if (!b) return false;
    // try step-up
    if (body.onGround && b.maxY - p.y <= stepHeight && b.maxY - p.y > 0) {
      const ny = b.maxY + EPS;
      if (!this.overlapAny(p.x, ny, p.z, r, body.height)) { p.y = ny; return false; }
    }
    if (b.circle) {
      if (axis === 'x') {
        const dz = Math.max(Math.abs(p.z - b.circle.z) - r, 0);
        const remaining = b.circle.radius * b.circle.radius - dz * dz;
        if (remaining > 0) p.x = b.circle.x + Math.sign(d || (p.x - b.circle.x) || 1) * (r + Math.sqrt(remaining) + EPS);
      } else {
        const dx = Math.max(Math.abs(p.x - b.circle.x) - r, 0);
        const remaining = b.circle.radius * b.circle.radius - dx * dx;
        if (remaining > 0) p.z = b.circle.z + Math.sign(d || (p.z - b.circle.z) || 1) * (r + Math.sqrt(remaining) + EPS);
      }
      if (this.overlapAny(p.x, p.y, p.z, r, body.height)) p[axis] -= d;
      body.vel[axis] = 0;
      return true;
    }
    // clamp against box
    if (axis === 'x') p.x = d > 0 ? b.minX - r - EPS : b.maxX + r + EPS;
    else p.z = d > 0 ? b.minZ - r - EPS : b.maxZ + r + EPS;
    // re-check (corner cases): if still overlapping, revert
    if (this.overlapAny(p.x, p.y, p.z, r, body.height)) p[axis] -= d;
    body.vel[axis] = 0;
    return true;
  }

  /** slab-method raycast against all boxes along the ray */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
    let best: RayHit | null = null;
    let bestT = maxDist;
    const ex = origin.x + dir.x * maxDist, ez = origin.z + dir.z * maxDist;
    const set = this.queryRay(origin.x, origin.z, ex, ez);
    const ix = 1 / (dir.x || 1e-9), iy = 1 / (dir.y || 1e-9), iz = 1 / (dir.z || 1e-9);
    for (const b of set) {
      if (b.circle) {
        const t = this.rayCylinder(origin, dir, b, bestT);
        if (t === null) continue;
        bestT = t;
        const point = origin.clone().addScaledVector(dir, t);
        const normal = new THREE.Vector3(point.x - b.circle.x, 0, point.z - b.circle.z);
        if (Math.abs(point.y - b.maxY) < 1e-4) normal.y = 1;
        else if (Math.abs(point.y - b.minY) < 1e-4) normal.y = -1;
        else normal.normalize();
        best = { t, point, normal, box: b };
        continue;
      }
      let t1 = (b.minX - origin.x) * ix, t2 = (b.maxX - origin.x) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      let axis = 0;
      t1 = (b.minY - origin.y) * iy; t2 = (b.maxY - origin.y) * iy;
      const ymin = Math.min(t1, t2), ymax = Math.max(t1, t2);
      if (ymin > tmin) { tmin = ymin; axis = 1; }
      tmax = Math.min(tmax, ymax);
      t1 = (b.minZ - origin.z) * iz; t2 = (b.maxZ - origin.z) * iz;
      const zmin = Math.min(t1, t2), zmax = Math.max(t1, t2);
      if (zmin > tmin) { tmin = zmin; axis = 2; }
      tmax = Math.min(tmax, zmax);
      if (tmax < Math.max(tmin, 0) || tmin < 0 || tmin > bestT) continue;
      bestT = tmin;
      const n = new THREE.Vector3();
      if (axis === 0) n.x = -Math.sign(dir.x); else if (axis === 1) n.y = -Math.sign(dir.y); else n.z = -Math.sign(dir.z);
      best = { t: tmin, point: origin.clone().addScaledVector(dir, tmin), normal: n, box: b };
    }
    return best;
  }

  private rayCylinder(origin: THREE.Vector3, dir: THREE.Vector3, b: Box, maxT: number): number | null {
    const c = b.circle!;
    const ox = origin.x - c.x, oz = origin.z - c.z;
    const a = dir.x * dir.x + dir.z * dir.z;
    let best = Infinity;
    if (a > 1e-12) {
      const half = ox * dir.x + oz * dir.z;
      const disc = half * half - a * (ox * ox + oz * oz - c.radius * c.radius);
      if (disc >= 0) {
        const root = Math.sqrt(disc);
        for (const t of [(-half - root) / a, (-half + root) / a]) {
          const y = origin.y + dir.y * t;
          if (t >= 0 && t <= maxT && t < best && y >= b.minY && y <= b.maxY) best = t;
        }
      }
    }
    if (Math.abs(dir.y) > 1e-12) for (const y of [b.minY, b.maxY]) {
      const t = (y - origin.y) / dir.y;
      const x = origin.x + dir.x * t - c.x, z = origin.z + dir.z * t - c.z;
      if (t >= 0 && t <= maxT && t < best && x * x + z * z <= c.radius * c.radius) best = t;
    }
    return Number.isFinite(best) ? best : null;
  }

  private raySet = new Set<Box>();
  private queryRay(x0: number, z0: number, x1: number, z1: number) {
    // traverse grid cells along the segment (conservative: sample along the line)
    const out = this.raySet;
    out.clear();
    const c = this.cell;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.ceil(len / (c * 0.5)));
    let lastK = -1;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const cx = Math.floor((x0 + (x1 - x0) * t) / c), cz = Math.floor((z0 + (z1 - z0) * t) / c);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const k = this.key(cx + ox, cz + oz);
        if (k === lastK) continue;
        const arr = this.grid.get(k);
        if (arr) for (const b of arr) out.add(b);
      }
      lastK = this.key(cx, cz);
    }
    return out;
  }

  /** true if segment a->b is not blocked */
  lineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = _d.copy(b).sub(a);
    const len = d.length();
    if (len < 1e-4) return true;
    d.divideScalar(len);
    return this.raycast(a, d, len - 0.05) === null;
  }
}
const _d = new THREE.Vector3();
