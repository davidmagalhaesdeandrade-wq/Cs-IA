import * as THREE from 'three';
import { WEAPONS, WeaponDef, Slot } from '../data/weapons';
import type { CharacterModel } from '../render/characterModel';

export type Team = 'T' | 'CT';
export type HitGroup = 'head' | 'chest' | 'stomach' | 'arm' | 'leg';

export class WeaponInst {
  def: WeaponDef;
  mag: number;
  reserve: number;
  skin: string;
  nextFire = 0;
  reloading = false;
  reloadEnd = 0;
  constructor(id: string, skin = 'default') {
    this.def = WEAPONS[id];
    this.mag = this.def.mag;
    this.reserve = this.def.reserve;
    this.skin = skin;
  }
}

export const PLAYER_RADIUS = 0.36;
export const STAND_H = 1.8;
export const CROUCH_H = 1.25;
export const STAND_EYE = 1.64;
export const CROUCH_EYE = 1.14;

let nextId = 1;

export class Actor {
  id = nextId++;
  name: string;
  team: Team;
  isPlayer: boolean;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  hp = 100;
  armor = 0;
  helmet = false;
  kit = false;
  alive = true;
  crouch = 0; // 0..1 smooth
  crouching = false;
  walking = false;
  onGround = true;
  radius = PLAYER_RADIUS;
  height = STAND_H;
  money = 800;
  primary: WeaponInst | null = null;
  secondary: WeaponInst | null = null;
  knife = new WeaponInst('knife');
  grenades: WeaponInst[] = [];
  c4: WeaponInst | null = null;
  slot: Slot = 'secondary';
  lastSlot: Slot = 'knife';
  grenadeIndex = 0;
  kills = 0;
  deaths = 0;
  assists = 0;
  score = 0;
  mvps = 0;
  roundKills = 0;
  damageBy = new Map<number, number>();
  flash = 0; // remaining blind seconds
  flashMax = 0;
  model: CharacterModel | null = null;
  avatarColor: string;
  spreadHeat = 0;
  recoilIndex = 0;
  lastShot = -10;
  agentId = '';
  diedAt = -1;

  constructor(name: string, team: Team, isPlayer: boolean) {
    this.name = name;
    this.team = team;
    this.isPlayer = isPlayer;
    const hues = [12, 35, 200, 140, 280, 330, 60, 170, 230, 0];
    this.avatarColor = `hsl(${hues[this.id % hues.length]},55%,45%)`;
  }

  get eye() { return STAND_EYE - (STAND_EYE - CROUCH_EYE) * this.crouch; }
  eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eye, this.pos.z); }

  get weapon(): WeaponInst {
    switch (this.slot) {
      case 'primary': return this.primary || this.secondary || this.knife;
      case 'secondary': return this.secondary || this.knife;
      case 'grenade': return this.grenades[this.grenadeIndex] || this.knife;
      case 'c4': return this.c4 || this.knife;
      default: return this.knife;
    }
  }
  has(slot: Slot) {
    if (slot === 'primary') return !!this.primary;
    if (slot === 'secondary') return !!this.secondary;
    if (slot === 'grenade') return this.grenades.length > 0;
    if (slot === 'c4') return !!this.c4;
    return true;
  }
  bestSlot(): Slot {
    if (this.primary) return 'primary';
    if (this.secondary) return 'secondary';
    return 'knife';
  }

  maxSpeed() {
    const w = this.weapon.def;
    return w.speed;
  }

  /** ray test vs simplified hitboxes. returns distance & group. */
  hitTest(o: THREE.Vector3, d: THREE.Vector3, maxT: number): { t: number; group: HitGroup } | null {
    if (!this.alive) return null;
    const p = this.pos;
    const k = 1 - this.crouch * 0.3;
    const headY = p.y + (STAND_EYE + 0.04) - (STAND_EYE - CROUCH_EYE) * this.crouch;
    // quick bounding sphere reject
    const cx = p.x - o.x, cy = p.y + 0.9 - o.y, cz = p.z - o.z;
    const proj = cx * d.x + cy * d.y + cz * d.z;
    if (proj < 0 || proj > maxT + 1.5) return null;
    const dd = cx * cx + cy * cy + cz * cz - proj * proj;
    if (dd > 1.3 * 1.3) return null;
    let best: { t: number; group: HitGroup } | null = null;
    // head sphere (offset slightly forward)
    const fx = -Math.sin(this.yaw) * 0.03, fz = -Math.cos(this.yaw) * 0.03;
    const th = raySphere(o, d, p.x + fx, headY, p.z + fz, 0.135);
    if (th !== null && th < maxT) best = { t: th, group: 'head' };
    const boxes: [number, number, number, HitGroup][] = [
      // [yMin, yMax, halfWidth, group]
      [p.y + 1.12 * k, p.y + 1.5 * k, 0.24, 'chest'],
      [p.y + 0.82 * k, p.y + 1.12 * k, 0.2, 'stomach'],
      [p.y, p.y + 0.82 * k, 0.19, 'leg']
    ];
    for (const [y0, y1, hw, grp] of boxes) {
      const t = rayAABB(o, d, p.x - hw, y0, p.z - hw, p.x + hw, y1, p.z + hw);
      if (t !== null && t < maxT && (!best || t < best.t)) best = { t, group: grp };
    }
    return best;
  }
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number): number | null {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}
export function rayAABB(o: THREE.Vector3, d: THREE.Vector3, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number | null {
  const ix = 1 / (d.x || 1e-9), iy = 1 / (d.y || 1e-9), iz = 1 / (d.z || 1e-9);
  let t1 = (x0 - o.x) * ix, t2 = (x1 - o.x) * ix;
  let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
  t1 = (y0 - o.y) * iy; t2 = (y1 - o.y) * iy;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (z0 - o.z) * iz; t2 = (z1 - o.z) * iz;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  if (tmax < 0 || tmin > tmax) return null;
  return tmin >= 0 ? tmin : 0;
}

export const HIT_MULT: Record<HitGroup, number> = { head: 4, chest: 1, stomach: 1.25, arm: 1, leg: 0.75 };

/** CS-style armor model. returns {hp, armor} damage */
export function computeDamage(def: WeaponDef, base: number, group: HitGroup, dist: number, victim: Actor) {
  let dmg = base * HIT_MULT[group] * Math.pow(def.falloff, dist / 10);
  let armorDmg = 0;
  const armored = victim.armor > 0 && (group !== 'leg') && (group !== 'head' || victim.helmet);
  if (armored) {
    const reduced = dmg * def.armorPen;
    armorDmg = Math.min(victim.armor, (dmg - reduced) * 0.5);
    dmg = reduced;
  }
  return { hp: Math.max(1, Math.round(dmg)), armor: Math.round(armorDmg) };
}
