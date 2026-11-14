import * as THREE from 'three';
import type { CollisionWorld } from '../world/Collision';
import type { Effects } from './Effects';
import type { Actor } from './Actor';
import { buildWeapon } from '../render/weaponModels';
import { smokeTex } from '../render/textures';
import { audio } from '../core/Audio';
import { dirFromYawPitch } from '../core/util';

export interface GrenadeCtx {
  collision: CollisionWorld;
  effects: Effects;
  scene: THREE.Scene;
  actors: () => Actor[];
  damage: (victim: Actor, attacker: Actor, hp: number, weapon: string, from: THREE.Vector3) => void;
  onFlash: (victim: Actor, seconds: number) => void;
}

interface Nade { type: 'he' | 'flash' | 'smoke'; owner: Actor; pos: THREE.Vector3; vel: THREE.Vector3; t: number; mesh: THREE.Object3D; still: number }
interface Smoke { pos: THREE.Vector3; t: number; group: THREE.Group; sprites: { s: THREE.Sprite; off: THREE.Vector3; ph: number }[] }

const SMOKE_TIME = 16;
export const SMOKE_RADIUS = 3.4;

export class Grenades {
  nades: Nade[] = [];
  smokes: Smoke[] = [];
  constructor(private ctx: GrenadeCtx) {}

  throw(owner: Actor, type: 'he' | 'flash' | 'smoke', strength = 1) {
    const eye = owner.eyePos();
    const dir = dirFromYawPitch(owner.yaw, owner.pitch + 0.08);
    const pos = eye.clone().addScaledVector(dir, 0.4);
    const vel = dir.multiplyScalar(17 * strength).add(owner.vel.clone().multiplyScalar(0.8));
    const mesh = buildWeapon(type);
    mesh.scale.setScalar(1.3);
    this.ctx.scene.add(mesh);
    mesh.position.copy(pos);
    this.nades.push({ type, owner, pos, vel, t: 0, mesh, still: 0 });
  }

  /** is the segment blocked by a smoke cloud? */
  blocks(a: THREE.Vector3, b: THREE.Vector3) {
    for (const s of this.smokes) {
      if (s.t < 0.8 || s.t > SMOKE_TIME - 0.8) continue;
      const c = s.pos;
      const d = _d.copy(b).sub(a);
      const len = d.length();
      d.divideScalar(len);
      const m = _m.copy(c).sub(a);
      const t = THREE.MathUtils.clamp(m.dot(d), 0, len);
      const closest = _c.copy(a).addScaledVector(d, t);
      // flattened ellipsoid
      const dx = closest.x - c.x, dy = (closest.y - c.y) * 1.4, dz = closest.z - c.z;
      if (dx * dx + dy * dy + dz * dz < SMOKE_RADIUS * SMOKE_RADIUS) return true;
    }
    return false;
  }

  /** 0..1 how deep a point is inside smoke */
  density(p: THREE.Vector3) {
    let best = 0;
    for (const s of this.smokes) {
      const k = s.t < 1 ? s.t : s.t > SMOKE_TIME - 2 ? (SMOKE_TIME - s.t) / 2 : 1;
      const dx = p.x - s.pos.x, dy = (p.y - s.pos.y) * 1.4, dz = p.z - s.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / SMOKE_RADIUS;
      best = Math.max(best, THREE.MathUtils.clamp((1.15 - d) * 2.5, 0, 1) * k);
    }
    return best;
  }

  update(dt: number) {
    const g = 16;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.t += dt;
      n.vel.y -= g * dt;
      const sp = n.vel.length();
      if (sp > 0.01) {
        const dir = n.vel.clone().divideScalar(sp);
        const hit = this.ctx.collision.raycast(n.pos, dir, sp * dt + 0.06);
        if (hit) {
          n.pos.copy(hit.point).addScaledVector(hit.normal, 0.07);
          const vn = hit.normal.clone().multiplyScalar(n.vel.dot(hit.normal));
          const vt = n.vel.clone().sub(vn);
          n.vel.copy(vt.multiplyScalar(0.6)).sub(vn.multiplyScalar(0.42));
          if (sp > 2.5) audio.bounce(n.pos);
        } else n.pos.addScaledVector(n.vel, dt);
      }
      n.mesh.position.copy(n.pos);
      n.mesh.rotation.x += dt * sp * 1.5;
      n.mesh.rotation.z += dt * sp * 0.7;
      if (n.vel.length() < 0.6) n.still += dt;
      const fuse = n.type === 'smoke' ? (n.still > 0.4 || n.t > 3.5) : n.t > 1.6;
      if (fuse) {
        this.detonate(n);
        this.ctx.scene.remove(n.mesh);
        this.nades.splice(i, 1);
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t += dt;
      const grow = Math.min(1, s.t / 1.2);
      const fade = s.t > SMOKE_TIME - 2 ? Math.max(0, (SMOKE_TIME - s.t) / 2) : 1;
      for (const sp of s.sprites) {
        sp.ph += dt * 0.2;
        sp.s.position.set(sp.off.x * (0.4 + grow * 0.6) + Math.sin(sp.ph) * 0.2, sp.off.y * (0.3 + grow * 0.7) + 0.2, sp.off.z * (0.4 + grow * 0.6) + Math.cos(sp.ph) * 0.2);
        (sp.s.material as THREE.SpriteMaterial).opacity = 0.92 * grow * fade;
        (sp.s.material as THREE.SpriteMaterial).rotation += dt * 0.05;
      }
      if (s.t > SMOKE_TIME) {
        this.ctx.scene.remove(s.group);
        s.sprites.forEach((sp) => sp.s.material.dispose());
        this.smokes.splice(i, 1);
      }
    }
  }

  private detonate(n: Nade) {
    const { effects } = this.ctx;
    if (n.type === 'he') {
      effects.explosion(n.pos, false);
      audio.explosion(n.pos, false);
      const R = 11;
      for (const a of this.ctx.actors()) {
        if (!a.alive) continue;
        const chest = a.pos.clone().add(new THREE.Vector3(0, 1.1, 0));
        const d = chest.distanceTo(n.pos);
        if (d > R) continue;
        if (!this.ctx.collision.lineOfSight(n.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), chest)) continue;
        let dmg = 98 * Math.pow(1 - d / R, 1.3);
        if (a.armor > 0) dmg *= 0.57;
        if (dmg >= 1) this.ctx.damage(a, n.owner, Math.round(dmg), 'he', n.pos);
      }
    } else if (n.type === 'flash') {
      effects.light(n.pos, 600, 0xffffff, 40);
      effects.add.spawn(n.pos, new THREE.Vector3(), 0.15, 3, 1, 1, 1, 1, 0, 0);
      let ring = 0;
      for (const a of this.ctx.actors()) {
        if (!a.alive) continue;
        const eye = a.eyePos();
        const d = eye.distanceTo(n.pos);
        if (d > 45) continue;
        if (!this.ctx.collision.lineOfSight(n.pos, eye) || this.blocks(n.pos, eye)) continue;
        const look = dirFromYawPitch(a.yaw, a.pitch);
        const to = n.pos.clone().sub(eye).normalize();
        const dot = look.dot(to);
        const angF = dot > 0.6 ? 1 : dot > 0 ? 0.7 : dot > -0.5 ? 0.35 : 0.15;
        const distF = THREE.MathUtils.clamp(1 - d / 45, 0, 1);
        const secs = 5.0 * angF * Math.pow(distF, 0.6);
        if (secs > 0.25) this.ctx.onFlash(a, secs);
        if (a.isPlayer) ring = secs / 5;
      }
      audio.flashbang(n.pos, ring);
    } else {
      audio.smokePop(n.pos);
      const group = new THREE.Group();
      const ground = this.ctx.collision.raycast(n.pos, new THREE.Vector3(0, -1, 0), 5);
      const base = ground ? ground.point.clone() : n.pos.clone();
      group.position.copy(base);
      const sprites: Smoke['sprites'] = [];
      const tex = smokeTex();
      for (let i = 0; i < 34; i++) {
        const shade = 0.72 + Math.random() * 0.18;
        const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(shade, shade * 0.98, shade * 0.95), transparent: true, depthWrite: false, opacity: 0, rotation: Math.random() * 6, fog: true });
        const s = new THREE.Sprite(m);
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 2.6;
        const off = new THREE.Vector3(Math.cos(a) * r, 0.4 + Math.random() * 2.6, Math.sin(a) * r);
        s.scale.setScalar(2.6 + Math.random() * 1.8);
        group.add(s);
        sprites.push({ s, off, ph: Math.random() * 6 });
      }
      this.ctx.scene.add(group);
      this.smokes.push({ pos: base.clone().add(new THREE.Vector3(0, 1.4, 0)), t: 0, group, sprites });
    }
  }

  clear() {
    for (const n of this.nades) this.ctx.scene.remove(n.mesh);
    for (const s of this.smokes) this.ctx.scene.remove(s.group);
    this.nades = [];
    this.smokes = [];
  }
}
const _d = new THREE.Vector3(), _m = new THREE.Vector3(), _c = new THREE.Vector3();
