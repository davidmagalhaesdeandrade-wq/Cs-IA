import * as THREE from 'three';
import type { GameSession } from './GameSession';
import { Actor, computeDamage, type HitGroup } from './Actor';
import type { WeaponDef } from '../data/weapons';
import { audio } from '../core/Audio';
import { dirFromYawPitch } from '../core/util';

const MAX_RANGE = 200;

/**
 * Recoil pattern offset (pitch, yaw) in radians for the n-th consecutive shot.
 * The barrel climbs for the first shots, then levels off and sways side to side.
 */
export function recoilOffset(def: WeaponDef, index: number): [number, number] {
  if (index <= 0 || def.category === 'knife' || def.category === 'grenade' || def.category === 'c4') return [0, 0];
  const climbShots = 9;
  const climb = Math.min(index, climbShots);
  const extra = Math.max(0, index - climbShots);
  const pitch = def.recoilUp * (climb + extra * 0.15);
  const swayAmp = def.recoilSide * Math.min(index, 14) * 0.45;
  const yaw = Math.sin(index * 0.55) * swayAmp + (index > 4 ? Math.sin(index * 0.21) * def.recoilSide * 2 : 0);
  return [pitch, yaw];
}

/** current inaccuracy cone (radians) for actor holding def */
function inaccuracy(a: Actor, def: WeaponDef, accurate: boolean) {
  const hsp = Math.hypot(a.vel.x, a.vel.z);
  const moveFrac = Math.min(1, hsp / Math.max(0.1, def.speed));
  let spread = def.spread + a.spreadHeat;
  // walking slowly is almost free, full speed costs the full moveSpread
  spread += def.moveSpread * Math.max(0, moveFrac - 0.3) / 0.7;
  if (!a.onGround) spread += def.airSpread;
  if (a.crouch > 0.5 && a.onGround) spread *= 0.8;
  if (def.category === 'sniper' && !accurate) spread += 0.09;
  return spread;
}

function jitter(dir: THREE.Vector3, cone: number, out: THREE.Vector3) {
  out.copy(dir);
  if (cone <= 0) return out;
  // random point in disc perpendicular to dir
  const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const u = new THREE.Vector3().crossVectors(right, dir).normalize();
  const r = cone * Math.sqrt(Math.random());
  const th = Math.random() * Math.PI * 2;
  out.addScaledVector(right, Math.cos(th) * r).addScaledVector(u, Math.sin(th) * r);
  return out.normalize();
}

interface BulletHit { actor: Actor | null; t: number; group: HitGroup | null; point: THREE.Vector3; normal: THREE.Vector3 | null; surf: string }

function traceBullet(s: GameSession, shooter: Actor, o: THREE.Vector3, d: THREE.Vector3, range: number): BulletHit | null {
  const wh = s.collision.raycast(o, d, range);
  let bestT = wh ? wh.t : range;
  let actor: Actor | null = null;
  let group: HitGroup | null = null;
  for (const v of s.actors) {
    if (v === shooter || !v.alive || v.team === shooter.team) continue;
    const h = v.hitTest(o, d, bestT);
    if (h && h.t < bestT) { bestT = h.t; actor = v; group = h.group; }
  }
  if (actor) return { actor, t: bestT, group, point: o.clone().addScaledVector(d, bestT), normal: null, surf: 'flesh' };
  if (wh) return { actor: null, t: wh.t, group: null, point: wh.point, normal: wh.normal, surf: wh.box.surf };
  return null;
}

/**
 * Fire one trigger pull of `def` from actor `a` along `dir`.
 * `accurate` = scoped (snipers) / bots; `muzzle` = world position used for tracers.
 */
export function fireBullets(s: GameSession, a: Actor, dir: THREE.Vector3, def: WeaponDef, accurate: boolean, muzzle: THREE.Vector3) {
  const o = a.eyePos();
  if (def.sound !== 'knife' && def.sound !== 'none') audio.shot(def.sound, a.isPlayer ? null : a.pos, a.isPlayer);
  s.noise(a, a.pos, def.silenced ? 10 : 45);

  const pellets = def.pellets ?? 1;
  const range = def.range ?? MAX_RANGE;
  const cone = inaccuracy(a, def, accurate);
  const d = new THREE.Vector3();
  let tracerDrawn = false;

  for (let i = 0; i < pellets; i++) {
    jitter(dir, pellets > 1 ? def.spread + cone * 0.5 : cone, d);
    const hit = traceBullet(s, a, o, d, range);
    const end = hit ? hit.point : o.clone().addScaledVector(d, range);

    if (def.tracer !== false && !tracerDrawn && (pellets === 1 || i === 0) && Math.random() < (a.isPlayer ? 0.6 : 0.8)) {
      s.effects.tracer(muzzle, end);
      tracerDrawn = true;
    }
    if (!hit) continue;

    if (hit.actor && hit.group) {
      const v = hit.actor;
      const dmg = computeDamage(def, def.damage, hit.group, hit.t, v);
      s.effects.bloodHit(hit.point, d, hit.group === 'head');
      // blood on the wall behind
      const behind = s.collision.raycast(hit.point, d, 3);
      if (behind && Math.random() < 0.6) s.effects.bloodSplat(behind.point, behind.normal);
      s.damage(v, a, dmg.hp, dmg.armor, def.id, hit.group, a.pos);
    } else if (hit.normal) {
      s.effects.impact(hit.point, hit.normal, hit.surf as 'stone');
      if (i === 0) audio.impact(hit.point, hit.surf);
    }
  }
}

/** knife swing (heavy = right-click stab). Backstabs deal much more damage. */
export function knifeAttack(s: GameSession, a: Actor, heavy: boolean) {
  const def = a.knife.def;
  const range = def.range ?? 2;
  const o = a.eyePos();
  let best: { v: Actor; t: number; group: HitGroup; d: THREE.Vector3 } | null = null;
  // a small fan of rays so melee is forgiving
  for (const [dy, dp] of [[0, 0], [0.18, 0], [-0.18, 0], [0, -0.25], [0, 0.15]]) {
    const d = dirFromYawPitch(a.yaw + dy, a.pitch + dp);
    const wh = s.collision.raycast(o, d, range);
    const max = wh ? wh.t : range;
    for (const v of s.actors) {
      if (v === a || !v.alive || v.team === a.team) continue;
      const h = v.hitTest(o, d, max);
      if (h && (!best || h.t < best.t)) best = { v, t: h.t, group: h.group, d };
    }
    if (best) break;
  }

  if (a.isPlayer) audio.knifeSwing(!!best);
  s.noise(a, a.pos, 8);

  if (!best) {
    const d = dirFromYawPitch(a.yaw, a.pitch);
    const wh = s.collision.raycast(o, d, range);
    if (wh) { s.effects.impact(wh.point, wh.normal, wh.box.surf); audio.impact(wh.point, wh.box.surf); }
    return;
  }

  const v = best.v;
  // backstab: attacker is behind the victim
  const toVictim = new THREE.Vector3(v.pos.x - a.pos.x, 0, v.pos.z - a.pos.z).normalize();
  const facing = dirFromYawPitch(v.yaw, 0);
  const back = toVictim.dot(facing) > 0.5;
  const base = heavy ? (back ? 180 : 65) : (back ? 90 : def.damage);
  // knife ignores hitgroup multipliers: treat as chest
  const dmg = computeDamage(def, base, 'chest', 0, v);
  const p = o.clone().addScaledVector(best.d, best.t);
  s.effects.bloodHit(p, best.d, false);
  s.damage(v, a, dmg.hp, dmg.armor, def.id, best.group === 'head' ? 'head' : 'chest', a.pos);
}
