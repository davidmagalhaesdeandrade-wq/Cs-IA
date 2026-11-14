import * as THREE from 'three';
import type { GameSession } from './GameSession';
import { Actor, CROUCH_H, STAND_H } from './Actor';
import { fireBullets, recoilOffset } from './Combat';
import { clamp, dirFromYawPitch, pick, rand, wrapAngle, yawTo } from '../core/util';
import { audio } from '../core/Audio';

export type BotState = 'idle' | 'patrol' | 'moveToObjective' | 'hold' | 'seekEnemy' | 'attack' | 'takeCover' | 'plantBomb' | 'defuseBomb' | 'pickupBomb' | 'dead';
export type Difficulty = 'easy' | 'normal' | 'hard';

interface DiffParams { reaction: number; aimErr: number; aimErrMin: number; settle: number; turn: number; fireMul: number; head: number; burst: [number, number]; range: number; fov: number; cover: boolean; strafe: boolean }
export const DIFF: Record<Difficulty, DiffParams> = {
  easy: { reaction: 0.75, aimErr: 0.11, aimErrMin: 0.035, settle: 1.6, turn: 4, fireMul: 2.2, head: 0.08, burst: [2, 4], range: 45, fov: 100, cover: false, strafe: false },
  normal: { reaction: 0.42, aimErr: 0.07, aimErrMin: 0.018, settle: 1.0, turn: 7, fireMul: 1.35, head: 0.22, burst: [3, 6], range: 65, fov: 120, cover: true, strafe: false },
  hard: { reaction: 0.22, aimErr: 0.045, aimErrMin: 0.008, settle: 0.6, turn: 11, fireMul: 1.0, head: 0.4, burst: [4, 9], range: 85, fov: 140, cover: true, strafe: true }
};

const GRAVITY = 20;
const _v = new THREE.Vector3();

export class Bot {
  a: Actor;
  s: GameSession;
  p: DiffParams;
  state: BotState = 'idle';
  path: THREE.Vector3[] = [];
  goal: THREE.Vector3 | null = null;
  route: THREE.Vector3[] = [];
  target: Actor | null = null;
  targetSeen = 0;
  lastSeenT = -99;
  lastKnown: THREE.Vector3 | null = null;
  reactLeft = 0;
  aimYawErr = 0;
  aimPitchErr = 0;
  visTimer = Math.random() * 0.2;
  thinkTimer = 0;
  stuckTimer = 0;
  stuckRef = new THREE.Vector3();
  stuckCount = 0;
  burstLeft = 0;
  burstPause = 0;
  strafeDir = 1;
  strafeT = 0;
  holdYaw = 0;
  holdPoint: THREE.Vector3 | null = null;
  patrolT = 0;
  role: 'A' | 'B' | 'mid' | 'long' = 'A';
  startDelay = 0;
  stateT = 0;
  plantT = 0;
  coverT = 0;
  aimHead = false;
  wantCrouch = false;
  stepDist = 0;
  seekT = 0;
  grenadeCD = 0;

  constructor(s: GameSession, a: Actor, diff: Difficulty) {
    this.s = s;
    this.a = a;
    this.p = DIFF[diff];
  }

  setState(st: BotState) {
    if (this.state === st) return;
    this.state = st;
    this.stateT = 0;
    if (st !== 'attack') this.wantCrouch = false;
  }

  resetForRound() {
    this.state = 'idle';
    this.path = [];
    this.goal = null;
    this.target = null;
    this.lastKnown = null;
    this.burstLeft = 0;
    this.startDelay = rand(0, 2.5);
    this.stuckCount = 0;
    this.plantT = 0;
    this.grenadeCD = rand(5, 15);
  }

  navigateTo(p: THREE.Vector3, jitter = 0.6) {
    this.goal = p.clone();
    const path = this.s.nav.findPath(this.a.pos, p, jitter);
    this.path = path || [];
    this.stuckTimer = 0;
    this.stuckRef.copy(this.a.pos);
  }

  /** assign objective at round start */
  planRound(route: THREE.Vector3[], hold: THREE.Vector3, holdLookAt: THREE.Vector3) {
    this.route = route.map((v) => v.clone());
    this.holdPoint = hold.clone();
    this.holdYaw = yawTo(hold, holdLookAt);
  }

  private nextRouteGoal() {
    if (this.route.length) {
      const g = this.route.shift()!;
      this.navigateTo(g);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------
  update(dt: number) {
    const a = this.a, s = this.s, m = s.match;
    if (!a.alive) { this.state = 'dead'; return; }
    this.stateT += dt;
    if (a.flash > 0) a.flash -= dt;
    const w = a.weapon;
    // reload completion
    if (w.reloading && s.time >= w.reloadEnd) {
      const take = Math.min(w.def.mag - w.mag, w.reserve);
      w.mag += take; w.reserve -= take; w.reloading = false;
    }
    if (s.time - a.lastShot > 0.15) a.recoilIndex = Math.max(0, a.recoilIndex - dt * 14);
    a.spreadHeat = Math.max(0, a.spreadHeat - dt * 0.3);

    let moveDir: THREE.Vector3 | null = null;
    let speedMul = 1;
    let desiredYaw = a.yaw, desiredPitch = 0;

    if (m.phase === 'freeze') {
      this.state = 'idle';
      this.applyMovement(dt, null, 0);
      return;
    }

    // ---------------- perception ----------------
    this.visTimer -= dt;
    if (this.visTimer <= 0) {
      this.visTimer = 0.12 + Math.random() * 0.06;
      this.perceive();
    }

    // bomb related transitions
    const bomb = m.bomb;
    if (a.team === 'CT' && bomb.state === 'planted' && !['attack', 'defuseBomb'].includes(this.state)) {
      if (this.state !== 'moveToObjective' || !this.goal || this.goal.distanceTo(bomb.pos) > 2) {
        this.setState('moveToObjective');
        this.navigateTo(bomb.pos, 0.3);
      }
      if (a.pos.distanceTo(bomb.pos) < 1.5 && !this.target) this.setState('defuseBomb');
    }
    if (a.team === 'T' && bomb.state === 'dropped' && m.bombPickupBot === this && this.state !== 'attack' && this.state !== 'pickupBomb') {
      this.setState('pickupBomb');
      this.navigateTo(bomb.pos, 0.2);
    }

    switch (this.state) {
      case 'idle': {
        this.startDelay -= dt;
        if (this.startDelay <= 0) {
          this.setState('moveToObjective');
          if (!this.nextRouteGoal() && this.holdPoint) this.navigateTo(this.holdPoint);
        }
        break;
      }
      case 'moveToObjective':
      case 'pickupBomb':
      case 'patrol': {
        moveDir = this.followPath(dt);
        if (moveDir) desiredYaw = Math.atan2(-moveDir.x, -moveDir.z);
        speedMul = this.state === 'patrol' ? 0.5 : 1;
        if (!moveDir) {
          // reached
          if (this.state === 'pickupBomb') { this.setState('moveToObjective'); this.nextRouteGoal(); break; }
          if (this.state === 'moveToObjective' && this.nextRouteGoal()) break;
          if (a.team === 'CT' && bomb.state === 'planted') {
            if (a.pos.distanceTo(bomb.pos) < 1.6) this.setState('defuseBomb');
            else this.navigateTo(bomb.pos, 0.2);
            break;
          }
          if (a.team === 'T' && a.c4 && m.canPlant(a)) { this.setState('plantBomb'); this.plantT = 0; break; }
          if (a.team === 'T' && a.c4 && !m.canPlant(a)) { this.navigateTo(m.siteCenter(m.tSite)); break; }
          if (this.holdPoint && a.pos.distanceTo(this.holdPoint) > 2.5 && this.state === 'moveToObjective') { this.navigateTo(this.holdPoint); break; }
          this.setState('hold');
          this.patrolT = rand(5, 10);
        }
        break;
      }
      case 'hold': {
        desiredYaw = this.holdYaw + Math.sin(s.time * 0.6 + this.a.id) * 0.5;
        this.wantCrouch = false;
        this.patrolT -= dt;
        if (this.patrolT <= 0 && this.holdPoint) {
          const [cx, cz] = s.map.worldToCell(this.holdPoint);
          const p = s.nav.randomCellNear(cx, cz, 2);
          if (p) { this.navigateTo(p, 0.2); this.setState('patrol'); }
          this.patrolT = rand(6, 12);
        }
        if (w.mag < w.def.mag * 0.5 && !w.reloading) this.reload();
        break;
      }
      case 'seekEnemy': {
        this.seekT -= dt;
        moveDir = this.followPath(dt);
        if (moveDir) desiredYaw = Math.atan2(-moveDir.x, -moveDir.z);
        if (this.lastKnown) { desiredYaw = yawTo(a.pos, this.lastKnown); }
        speedMul = 0.8;
        if (!moveDir || this.seekT <= 0) {
          this.lastKnown = null;
          this.setState('moveToObjective');
          if (!this.nextRouteGoal() && this.holdPoint) this.navigateTo(this.holdPoint);
        }
        break;
      }
      case 'takeCover': {
        this.coverT -= dt;
        moveDir = this.followPath(dt);
        speedMul = 1;
        if (this.target) desiredYaw = yawTo(a.pos, this.target.pos);
        if (!w.reloading && w.mag < w.def.mag * 0.6) this.reload();
        if (this.coverT <= 0 || !moveDir) {
          this.setState(this.target ? 'attack' : 'hold');
        }
        break;
      }
      case 'plantBomb': {
        if (!a.c4 || !m.canPlant(a)) { this.setState('moveToObjective'); break; }
        if (a.slot !== 'c4') { a.slot = 'c4'; this.refreshModelWeapon(); }
        this.wantCrouch = true;
        const prev = this.plantT;
        this.plantT += dt;
        if (Math.floor(prev / 0.45) !== Math.floor(this.plantT / 0.45)) audio.beep(a.pos, 1800 + Math.random() * 600, 0.3);
        if (this.plantT >= m.plantTime) {
          m.plant(a);
          a.slot = a.bestSlot();
          this.refreshModelWeapon();
          this.wantCrouch = false;
          this.holdPoint = a.pos.clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
          const [cx, cz] = s.map.worldToCell(a.pos);
          const p = s.nav.randomCellNear(cx, cz, 3);
          if (p) { this.holdPoint = p; this.navigateTo(p); }
          this.setState('moveToObjective');
        }
        break;
      }
      case 'defuseBomb': {
        if (bomb.state !== 'planted') { this.setState('hold'); break; }
        if (a.pos.distanceTo(bomb.pos) > 1.8) { this.setState('moveToObjective'); this.navigateTo(bomb.pos, 0.2); break; }
        this.wantCrouch = true;
        desiredYaw = yawTo(a.pos, bomb.pos);
        desiredPitch = -0.6;
        if (bomb.defuser !== a) m.startDefuse(a);
        break;
      }
      case 'attack': {
        const t = this.target;
        if (!t || !t.alive) {
          this.target = null;
          if (this.lastKnown && this.stateT < 20 && (!t || t.alive)) { this.startSeek(); }
          else { this.setState('moveToObjective'); if (!this.nextRouteGoal() && this.holdPoint) this.navigateTo(this.holdPoint); }
          break;
        }
        const visible = s.time - this.lastSeenT < 0.25;
        if (!visible) {
          if (s.time - this.lastSeenT > 1.2) { this.startSeek(); break; }
        }
        // aim
        const aimPt = t.pos.clone();
        aimPt.y += this.aimHead ? t.eye + 0.02 : 1.15 - t.crouch * 0.3;
        const eye = a.eyePos();
        const settle = clamp(1 - (s.time - this.targetSeen) / this.p.settle, 0, 1);
        const err = this.p.aimErrMin + (this.p.aimErr - this.p.aimErrMin) * settle + (a.flash > 0 ? 0.3 : 0);
        desiredYaw = yawTo(eye, aimPt) + this.aimYawErr * err;
        const flat = Math.hypot(aimPt.x - eye.x, aimPt.z - eye.z);
        desiredPitch = Math.atan2(aimPt.y - eye.y, flat) + this.aimPitchErr * err * 0.6;
        // movement while fighting
        if (this.p.strafe && this.burstPause > 0) {
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = rand(0.35, 0.8); }
          const r = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw)).multiplyScalar(this.strafeDir);
          moveDir = r; speedMul = 0.9;
        }
        if (w.def.category === 'sniper' || this.p === DIFF.easy) moveDir = null;
        // cover when hurt
        if (this.p.cover && a.hp < 40 && this.stateT > 1 && Math.random() < dt * 0.8) {
          if (this.findCover(t)) break;
        }
        // Tactical utility: smoke to break enemy sightlines when pressured.
        this.grenadeCD -= dt;
        if (this.grenadeCD <= 0 && visible && a.grenades.length) {
          const dist = a.pos.distanceTo(t.pos);
          const smoke = a.grenades.find((g) => g.def.id === 'smoke');
          const he = a.grenades.find((g) => g.def.id === 'he' || g.def.id === 'flash');
          if (smoke && a.hp <= 55 && dist > 10 && dist < 30) {
            this.grenadeCD = rand(13, 20);
            const savePitch = a.pitch;
            a.yaw = yawTo(a.pos, t.pos);
            a.pitch = 0.12 + dist * 0.006;
            s.grenades.throw(a, 'smoke', Math.min(1, dist / 24 + 0.25));
            a.pitch = savePitch;
            a.grenades.splice(a.grenades.indexOf(smoke), 1);
            if (this.findCover(t)) break;
          } else if (he && dist > 8 && dist < 26) {
            this.grenadeCD = rand(10, 20);
            const savePitch = a.pitch;
            a.yaw = yawTo(a.pos, t.pos);
            a.pitch = 0.15 + dist * 0.008;
            s.grenades.throw(a, he.def.id as any, Math.min(1, dist / 22 + 0.3));
            a.pitch = savePitch;
            a.grenades.splice(a.grenades.indexOf(he), 1);
            break;
          } else this.grenadeCD = rand(4, 8);
        }
        // fire
        this.reactLeft -= dt;
        if (w.mag <= 0) { this.reload(); if (a.secondary && a.slot === 'primary' && a.secondary.mag > 0 && this.p !== DIFF.easy) { a.slot = 'secondary'; this.refreshModelWeapon(); } break; }
        if (visible && this.reactLeft <= 0 && !w.reloading) {
          const dyaw = Math.abs(wrapAngle(desiredYaw - a.yaw)), dp = Math.abs(desiredPitch - a.pitch);
          if (dyaw < 0.12 && dp < 0.12) this.tryFire();
        }
        break;
      }
    }

    // ------------- apply rotation + movement -------------
    const turn = this.p.turn * (this.state === 'attack' ? 1 : 0.6);
    const dy = wrapAngle(desiredYaw - a.yaw);
    a.yaw = wrapAngle(a.yaw + clamp(dy, -turn * dt, turn * dt));
    a.pitch += clamp(desiredPitch - a.pitch, -turn * dt, turn * dt);
    if (this.state === 'plantBomb' || this.state === 'defuseBomb') moveDir = null;
    this.applyMovement(dt, moveDir, speedMul);
  }

  private startSeek() {
    if (!this.lastKnown) { this.setState('hold'); return; }
    this.setState('seekEnemy');
    this.seekT = 6;
    const peek = this.findPeekPoint(this.lastKnown);
    this.navigateTo(peek || this.lastKnown, 0.2);
  }

  /** Choose a nearby walkable angle that opens line of sight to the last enemy position. */
  private findPeekPoint(target: THREE.Vector3): THREE.Vector3 | null {
    const [cx, cz] = this.s.map.worldToCell(target);
    const targetEye = target.clone().add(new THREE.Vector3(0, 1.25, 0));
    let best: THREE.Vector3 | null = null;
    let bestDistance = Infinity;
    for (let k = 0; k < 24; k++) {
      const p = this.s.nav.randomCellNear(cx, cz, 3 + (k % 2));
      if (!p) continue;
      const distance = p.distanceTo(target);
      if (distance < 4 || distance > 13 || distance >= bestDistance) continue;
      const eye = p.clone().add(new THREE.Vector3(0, 1.5, 0));
      if (!this.s.collision.lineOfSight(eye, targetEye)) continue;
      best = p;
      bestDistance = distance;
    }
    return best;
  }

  private findCover(t: Actor): boolean {
    const s = this.s, a = this.a;
    const [cx, cz] = s.map.worldToCell(a.pos);
    const tEye = t.eyePos();
    for (let k = 0; k < 14; k++) {
      const p = s.nav.randomCellNear(cx, cz, 3);
      if (!p) continue;
      const e = p.clone(); e.y += 1.5;
      if (!s.collision.lineOfSight(tEye, e)) {
        this.navigateTo(p, 0.1);
        this.coverT = rand(1.4, 2.5);
        this.setState('takeCover');
        return true;
      }
    }
    return false;
  }

  reload() {
    const w = this.a.weapon;
    if (w.reloading || w.reserve <= 0 || w.mag >= w.def.mag || w.def.mag === 0) return;
    w.reloading = true;
    w.reloadEnd = this.s.time + w.def.reloadTime;
    audio.reload(w.def.reloadTime, this.a.pos, false);
  }

  private tryFire() {
    const a = this.a, s = this.s, w = a.weapon, d = w.def;
    if (s.time < w.nextFire) return;
    if (d.category === 'knife' || d.category === 'grenade' || d.category === 'c4') {
      a.slot = a.bestSlot(); this.refreshModelWeapon(); return;
    }
    if (this.burstPause > 0) { this.burstPause -= 1; }
    if (this.burstLeft <= 0) {
      this.burstLeft = Math.floor(rand(this.p.burst[0], this.p.burst[1] + 1));
      if (!d.auto) this.burstLeft = 1;
    }
    w.mag--;
    let gap = 60 / d.rpm;
    if (!d.auto) gap = Math.max(gap, 0.18 * this.p.fireMul + Math.random() * 0.15);
    w.nextFire = s.time + gap;
    this.burstLeft--;
    if (this.burstLeft <= 0) {
      w.nextFire += (d.auto ? rand(0.25, 0.55) : 0) * this.p.fireMul;
      this.aimYawErr = rand(-1, 1); this.aimPitchErr = rand(-1, 1);
      this.aimHead = Math.random() < this.p.head;
      this.burstPause = 2;
    }
    const [rp, ry] = recoilOffset(d, a.recoilIndex);
    const comp = this.p === DIFF.hard ? 0.35 : this.p === DIFF.normal ? 0.55 : 0.85;
    const dir = dirFromYawPitch(a.yaw + ry * comp, a.pitch + rp * comp);
    const noise = (this.p.aimErrMin * 0.6) * (Math.random() - 0.5);
    dir.x += noise; dir.y += noise * 0.5;
    dir.normalize();
    const mz = this.muzzleWorld();
    fireBullets(s, a, dir, d, true, mz);
    s.effects.muzzle3P(mz, dir, !!d.silenced);
    a.recoilIndex += 1;
    a.lastShot = s.time;
    a.spreadHeat = Math.min(0.08, a.spreadHeat + d.fireSpread * 0.7);
    if (a.model) a.model.flinchT = Math.max(a.model.flinchT, 0.15);
  }

  muzzleWorld() {
    const m = this.a.model;
    const mz = m && m.weapon ? m.weapon.getObjectByName('muzzle') : null;
    if (mz) return mz.getWorldPosition(new THREE.Vector3());
    return this.a.eyePos().addScaledVector(dirFromYawPitch(this.a.yaw, this.a.pitch), 0.8);
  }

  refreshModelWeapon() { this.s.refreshBotWeaponModel(this.a); }

  private perceive() {
    const a = this.a, s = this.s;
    if (a.flash > 0.4) return;
    const eye = a.eyePos();
    const fwd = dirFromYawPitch(a.yaw, 0);
    let best: Actor | null = null, bestD = Infinity;
    for (const e of s.actors) {
      if (!e.alive || e.team === a.team) continue;
      const d = e.pos.distanceTo(a.pos);
      if (d > this.p.range) continue;
      const to = _v.copy(e.pos).sub(a.pos).setY(0).normalize();
      const ang = Math.acos(clamp(to.dot(fwd), -1, 1));
      const inFov = ang < (this.p.fov * Math.PI / 180) / 2 || d < 3 || (this.target === e && s.time - this.lastSeenT < 1);
      if (!inFov) continue;
      const head = e.eyePos();
      const chest = e.pos.clone(); chest.y += 1.1 - e.crouch * 0.3;
      let vis = s.collision.lineOfSight(eye, head) && !s.grenades.blocks(eye, head);
      if (!vis) vis = s.collision.lineOfSight(eye, chest) && !s.grenades.blocks(eye, chest);
      if (!vis) continue;
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best) {
      if (this.target !== best || s.time - this.lastSeenT > 1.5) {
        this.targetSeen = s.time;
        this.reactLeft = this.p.reaction * rand(0.8, 1.3);
        this.aimYawErr = rand(-1, 1);
        this.aimPitchErr = rand(-1, 1);
        this.aimHead = Math.random() < this.p.head;
      }
      this.target = best;
      this.lastSeenT = s.time;
      this.lastKnown = best.pos.clone();
      if (this.state !== 'attack' && this.state !== 'takeCover' && this.state !== 'defuseBomb') this.setState('attack');
      if (this.state === 'defuseBomb' && bestD < 25) { this.s.match.cancelDefuse(a); this.setState('attack'); }
      if (a.slot !== 'primary' && a.slot !== 'secondary') { a.slot = a.bestSlot(); this.refreshModelWeapon(); }
      if (this.p !== DIFF.easy && bestD > 12 && Math.random() < 0.3) this.wantCrouch = true;
    }
  }

  /** a sound was heard */
  hear(src: Actor, pos: THREE.Vector3) {
    if (!this.a.alive || src.team === this.a.team) return;
    if (this.state === 'attack' || this.state === 'plantBomb' || this.state === 'defuseBomb') return;
    if (this.state === 'hold' || this.state === 'patrol' || (this.state === 'moveToObjective' && Math.random() < 0.3)) {
      this.lastKnown = pos.clone();
      if (Math.random() < (this.a.team === 'CT' ? 0.55 : 0.35)) this.startSeek();
      else this.holdYaw = yawTo(this.a.pos, pos);
    }
  }

  private followPath(dt: number): THREE.Vector3 | null {
    const a = this.a;
    while (this.path.length) {
      const n = this.path[0];
      const dx = n.x - a.pos.x, dz = n.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < (this.path.length === 1 ? 0.5 : 0.9)) { this.path.shift(); continue; }
      // stuck detection
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.3) {
        if (this.stuckRef.distanceTo(a.pos) < 0.6) {
          this.stuckCount++;
          if (this.goal) this.navigateTo(this.goal, 2.5);
          if (this.stuckCount > 1 && a.onGround) a.vel.y = 6.3;
          if (this.stuckCount > 4) {
            this.stuckCount = 0;
            const [cx, cz] = this.s.map.worldToCell(a.pos);
            const p = this.s.nav.randomCellNear(cx, cz, 2);
            if (p) this.navigateTo(p, 1);
          }
        } else this.stuckCount = 0;
        this.stuckTimer = 0;
        this.stuckRef.copy(a.pos);
      }
      return new THREE.Vector3(dx / d, 0, dz / d);
    }
    return null;
  }

  private applyMovement(dt: number, dir: THREE.Vector3 | null, speedMul: number) {
    const a = this.a, s = this.s;
    a.crouching = this.wantCrouch;
    a.crouch += ((a.crouching ? 1 : 0) - a.crouch) * Math.min(1, dt * 10);
    a.height = a.crouching ? CROUCH_H : STAND_H;
    let max = a.maxSpeed() * speedMul;
    if (a.crouching) max *= 0.34;
    const targetVx = dir ? dir.x * max : 0, targetVz = dir ? dir.z * max : 0;
    const accel = a.onGround ? 30 : 3;
    a.vel.x += clamp(targetVx - a.vel.x, -accel * dt, accel * dt);
    a.vel.z += clamp(targetVz - a.vel.z, -accel * dt, accel * dt);
    a.vel.y -= GRAVITY * dt;
    const body = { pos: a.pos, vel: a.vel, radius: a.radius, height: a.height, onGround: a.onGround };
    s.collision.move(body, dt);
    a.onGround = body.onGround;
    // footsteps
    const sp = Math.hypot(a.vel.x, a.vel.z);
    if (a.onGround && sp > 3.2) {
      this.stepDist += sp * dt;
      if (this.stepDist > 2.1) {
        this.stepDist = 0;
        const c = s.map.cellAt(a.pos);
        if (a.pos.distanceTo(s.camera.position) < 30) audio.footstep(a.pos, c && c.tile ? 'stone' : 'sand', 1);
        s.noise(a, a.pos, 16);
      }
    }
    if (a.model) {
      a.model.root.position.copy(a.pos);
      a.model.root.rotation.y = a.yaw;
      a.model.update(dt, { speed: sp, crouch: a.crouch, pitch: a.pitch, dead: false, airborne: !a.onGround });
    }
  }
}

export const BOT_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango'];
export const pickName = (used: Set<string>) => {
  const free = BOT_NAMES.filter((n) => !used.has(n));
  const n = free.length ? pick(free) : 'Bot' + Math.floor(Math.random() * 99);
  used.add(n);
  return n;
};
