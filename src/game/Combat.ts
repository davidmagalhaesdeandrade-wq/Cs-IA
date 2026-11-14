import * as THREE from 'three';
import type { GameSession } from './GameSession';
import { Actor, HitGroup, computeDamage } from './Actor';
import type { WeaponDef } from '../data/weapons';
import { audio, ShotKind } from '../core/Audio';
import { dirFromYawPitch } from '../core/util';

const MAX_RANGE = 140;
const UNSCOPED_SNIPER_SPREAD = 0.075;

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Deterministic recoil pattern for a weapon at a (possibly fractional) shot index.
 * Returns [pitch, yaw] offsets in radians. Pitch climbs over the first shots and then
 * plateaus, while yaw sways left/right as the spray goes on.
 */
export function recoilOffset(def: WeaponDef, index: number): [number, number] {
  if (index <= 0 || def.category === 'knife' || def.category === 'grenade' || def.category === 'c4') return [0, 0];
  const n = Math.max(0, index - 1);
  const climb = Math.min(n, 9) + Math.max(0, Math.min(n, 30) - 9) * 0.2;
  const pitch = def.recoilUp * climb;
  const sway = Math.min(n, 12) / 4;
  const yaw = def.recoilSide * Math.sin(n * 0.5) * sway * (n > 9 ? 1.6 : 1);
  return [pitch, yaw];
}

/** current inaccuracy cone (radians) for an actor holding the given weapon */
export function currentSpread(a: Actor, def: WeaponDef, scoped: boolean): number {
  let base = def.spread;
  if (def.scope && !scoped) base = UNSCOPED_SNIPER_SPREAD;
  const speed = Math.hypot(a.vel.x, a.vel.z);
  const moveK = THREE.MathUtils.clamp((speed - 0.6) / Math.max(1, def.speed - 0.6), 0, 1);
  let spread = base + def.moveSpread * moveK * moveK * (a.isPlayer ? 1 : 0.5);
  if (!a.onGround) spread += def.airSpread;
  spread *= 1 - a.crouch * 0.25;
  spread += a.spreadHeat;
  return spread;
}

function jitter(dir: THREE.Vector3, cone: number, out: THREE.Vector3) {
  out.copy(dir);
  if (cone <= 0) return out;
  _side.crossVectors(dir, UP);
  if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
  _side.normalize();
  _up.crossVectors(_side, dir).normalize();
  const r = cone * Math.sqrt(Math.random());
  const ang = Math.random() * Math.PI * 2;
  out.addScaledVector(_side, Math.cos(ang) * r).addScaledVector(_up, Math.sin(ang) * r);
  return out.normalize();
}

interface TraceHit {
  t: number;
  actor: Actor | null;
  group: HitGroup | null;
  point: THREE.Vector3;
  normal: THREE.Vector3 | null;
  surf: string;
}

function trace(s: GameSession, shooter: Actor, o: THREE.Vector3, d: THREE.Vector3, range: number): TraceHit | null {
  const wh = s.collision.raycast(o, d, range);
  let bestT = wh ? wh.t : range;
  let actor: Actor | null = null;
  let group: HitGroup | null = null;
  for (const v of s.actors) {
    if (v === shooter || !v.alive) continue;
    // teammates don't block or take bullet damage
    if (v.team === shooter.team) continue;
    const h = v.hitTest(o, d, bestT);
    if (h && h.t < bestT) { bestT = h.t; actor = v; group = h.group; }
  }
  if (actor) {
    return { t: bestT, actor, group, point: o.clone().addScaledVector(d, bestT), normal: null, surf: 'flesh' };
  }
  if (wh) return { t: wh.t, actor: null, group: null, point: wh.point, normal: wh.normal, surf: wh.box.surf };
  return null;
}

/** fire one shot (or a shotgun blast) from actor `a` in direction `dir` */
export function fireBullets(s: GameSession, a: Actor, dir: THREE.Vector3, def: WeaponDef, scoped: boolean, muzzle: THREE.Vector3) {
  if (def.sound !== 'knife' && def.sound !== 'none') {
    audio.shot(def.sound as ShotKind, a.isPlayer ? null : muzzle, a.isPlayer);
  }
  s.noise(a, a.pos, def.silenced ? 10 : 45);

  const origin = a.eyePos(_o).clone();
  const pellets = def.pellets ?? 1;
  const range = def.range ?? MAX_RANGE;
  const cone = currentSpread(a, def, scoped);
  // accumulate damage per victim so shotgun blasts register as a single hit
  const hits = new Map<Actor, { hp: number; armor: number; group: HitGroup }>();

  for (let i = 0; i < pellets; i++) {
    const pd = jitter(dir, cone + (pellets > 1 ? def.spread : 0), _d).clone();
    const h = trace(s, a, origin, pd, range);
    const end = h ? h.point : _p.copy(origin).addScaledVector(pd, range).clone();

    if (def.tracer !== false && (pellets === 1 || i % 3 === 0) && (!a.isPlayer || Math.random() < 0.6)) {
      s.effects.tracer(muzzle, end);
    }
    if (!h) continue;

    if (h.actor && h.group) {
      const dmg = computeDamage(def, def.damage, h.group, h.t, h.actor);
      const prev = hits.get(h.actor);
      if (prev) {
        prev.hp += dmg.hp; prev.armor += dmg.armor;
        if (h.group === 'head') prev.group = 'head';
      } else hits.set(h.actor, { hp: dmg.hp, armor: dmg.armor, group: h.group });
      s.effects.bloodHit(h.point, pd, h.group === 'head');
      // blood splatter on a wall behind the victim
      const behind = s.collision.raycast(h.point, pd, 2.5);
      if (behind) s.effects.bloodSplat(behind.point.addScaledVector(behind.normal, 0.01), behind.normal);
    } else if (h.normal) {
      s.effects.impact(h.point.clone().addScaledVector(h.normal, 0.005), h.normal, h.surf as any);
      if (i === 0) audio.impact(h.point, h.surf);
    }
  }

  for (const [victim, d] of hits) {
    s.damage(victim, a, d.hp, d.armor, def.id, d.group, a.pos.clone());
  }
}

/** melee attack. `heavy` = right-click stab */
export function knifeAttack(s: GameSession, a: Actor, heavy: boolean) {
  const def = a.knife.def;
  const range = heavy ? 1.6 : def.range ?? 2.0;
  const origin = a.eyePos(new THREE.Vector3());
  const dir = dirFromYawPitch(a.yaw, a.pitch);
  const wh = s.collision.raycast(origin, dir, range);
  const maxT = wh ? wh.t : range;

  let target: Actor | null = null;
  let group: HitGroup | null = null;
  let bestT = maxT;
  // small cone so the knife is forgiving
  const offsets = [[0, 0], [0.12, 0], [-0.12, 0], [0, -0.15], [0, 0.1]];
  for (const [oy, op] of offsets) {
    const d = dirFromYawPitch(a.yaw + oy, a.pitch + op);
    for (const v of s.actors) {
      if (v === a || !v.alive || v.team === a.team) continue;
      const h = v.hitTest(origin, d, bestT);
      if (h && h.t < bestT) { bestT = h.t; target = v; group = h.group; }
    }
  }

  audio.knifeSwing(!!target || !!wh);
  if (target && group) {
    // backstab: attacker is behind the victim (victim facing away)
    const toAttacker = new THREE.Vector3(a.pos.x - target.pos.x, 0, a.pos.z - target.pos.z).normalize();
    const facing = dirFromYawPitch(target.yaw, 0);
    const back = toAttacker.dot(facing) < -0.3;
    const base = heavy ? (back ? 180 : 65) : (back ? 90 : def.damage);
    const dmg = computeDamage(def, base, group === 'head' ? 'head' : 'chest', 0, target);
    const p = origin.clone().addScaledVector(dir, bestT);
    s.effects.bloodHit(p, dir, group === 'head');
    s.damage(target, a, dmg.hp, dmg.armor, 'knife', group, a.pos.clone());
  } else if (wh) {
    s.effects.impact(wh.point.clone().addScaledVector(wh.normal, 0.005), wh.normal, wh.box.surf);
    audio.impact(wh.point, wh.box.surf);
  }
}
