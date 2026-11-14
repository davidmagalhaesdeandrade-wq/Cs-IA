import * as THREE from 'three';
import { input } from '../core/Input';
import { settings } from '../core/Settings';
import { audio } from '../core/Audio';
import { clamp, damp, dirFromYawPitch } from '../core/util';
import type { GameSession } from './GameSession';
import { Actor, CROUCH_H, STAND_H, WeaponInst } from './Actor';
import { fireBullets, knifeAttack, recoilOffset } from './Combat';
import type { Slot } from '../data/weapons';
import { skinManager, skinById } from '../data/skins';

const GRAVITY = 20;
const JUMP_V = 6.3;
const ACCEL = 5.5;
const AIR_ACCEL = 12;
const FRICTION = 5.2;
const STOP_SPEED = 2.0;

export class PlayerController {
  a: Actor;
  s: GameSession;
  zoom = 0; // 0 none, 1, 2
  focus = 0;
  punchPitch = 0;
  punchYaw = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  stepDist = 0;
  smoothEye = 0;
  landDip = 0;
  wasGround = true;
  fallSpeed = 0;
  interact: 'none' | 'plant' | 'defuse' = 'none';
  interactT = 0;
  heldFire = false;
  pendingSwitch: Slot | null = null;
  rezoomAfterShot = 0;
  lastFootSurface = 'stone';
  crouchToggled = false;

  constructor(s: GameSession, a: Actor) {
    this.s = s;
    this.a = a;
  }

  get scoped() { return this.zoom > 0; }

  resetForRound() {
    this.zoom = 0; this.focus = 0;
    this.punchPitch = this.punchYaw = this.recoilPitch = this.recoilYaw = 0;
    this.interact = 'none'; this.interactT = 0;
    this.smoothEye = 0;
    this.crouchToggled = false;
  }

  equip(slot: Slot, force = false) {
    const a = this.a;
    if (!a.alive) return;
    if (!a.has(slot)) return;
    if (slot === 'grenade' && a.slot === 'grenade' && !force) {
      a.grenadeIndex = (a.grenadeIndex + 1) % a.grenades.length;
    } else if (slot === a.slot && !force) return;
    else {
      if (slot !== a.slot) a.lastSlot = a.slot;
      a.slot = slot;
      if (slot === 'grenade') a.grenadeIndex = Math.min(a.grenadeIndex, a.grenades.length - 1);
    }
    const w = a.weapon;
    w.reloading = false;
    this.zoom = 0;
    this.s.viewmodel.setWeapon(w.def.id, skinById(skinManager.get(w.def.id))?.pattern ?? 'default');
    w.nextFire = Math.max(w.nextFire, this.s.time + w.def.equipTime * 0.85);
    audio.equip(w.def.category);
    this.cancelInteract();
  }

  cancelInteract() {
    if (this.interact !== 'none') {
      this.interact = 'none';
      this.interactT = 0;
      this.s.match.cancelDefuse(this.a);
      if (this.s.viewmodel.state === 'plant') this.s.viewmodel.state = 'idle';
    }
  }

  reload() {
    const w = this.a.weapon;
    const d = w.def;
    if (w.reloading || d.mag <= 0 || w.mag >= d.mag || w.reserve <= 0) return;
    if (d.category === 'knife' || d.category === 'grenade' || d.category === 'c4') return;
    w.reloading = true;
    w.reloadEnd = this.s.time + d.reloadTime;
    this.zoom = 0;
    this.s.viewmodel.play('reload', d.reloadTime);
    audio.reload(d.reloadTime);
  }

  update(dt: number, lookEnabled: boolean, moveEnabled: boolean) {
    const a = this.a;
    const s = this.s;
    if (!a.alive) return;
    // ---------- look ----------
    if (lookEnabled) {
      const fov = s.currentFov();
      const zoomSens = fov / settings.data.fov;
      const k = settings.data.sensitivity * 0.022 * (Math.PI / 180) * zoomSens;
      a.yaw -= input.dx * k;
      a.pitch -= input.dy * k;
      a.pitch = clamp(a.pitch, -1.5, 1.5);
    }
    const frozen = s.match.phase === 'freeze' || this.interact !== 'none';
    // ---------- crouch / walk ----------
    let crouchKey = moveEnabled && (input.down('ControlLeft') || input.down('ControlRight') || input.down('KeyC'));
    if (settings.data.crouchToggle) {
      if (moveEnabled && (input.hit('ControlLeft') || input.hit('KeyC'))) this.crouchToggled = !this.crouchToggled;
      crouchKey = this.crouchToggled;
    }
    if (crouchKey) a.crouching = true;
    else if (a.crouching) {
      // stand only if headroom
      if (!s.collision.overlapAny(a.pos.x, a.pos.y, a.pos.z, a.radius - 0.02, STAND_H)) a.crouching = false;
    }
    a.crouch = damp(a.crouch, a.crouching ? 1 : 0, 14, dt);
    a.height = a.crouching ? CROUCH_H : STAND_H;
    a.walking = moveEnabled && (input.down('ShiftLeft') || input.down('ShiftRight'));

    // ---------- movement ----------
    let fx = 0, fz = 0;
    if (moveEnabled && !frozen) {
      if (input.down('KeyW')) fz += 1;
      if (input.down('KeyS')) fz -= 1;
      if (input.down('KeyD')) fx += 1;
      if (input.down('KeyA')) fx -= 1;
    }
    const fwd = new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
    const right = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    const wish = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx));
    if (wish.lengthSq() > 0) wish.normalize();
    let maxSpeed = a.maxSpeed();
    if (this.scoped) maxSpeed *= 0.6;
    if (a.walking) maxSpeed *= 0.52;
    if (a.crouching) maxSpeed *= 0.34;
    const v = a.vel;
    if (a.onGround) {
      // friction
      const sp = Math.hypot(v.x, v.z);
      if (sp > 0) {
        const control = Math.max(sp, STOP_SPEED);
        const drop = control * FRICTION * dt;
        const ns = Math.max(0, sp - drop) / sp;
        v.x *= ns; v.z *= ns;
      }
      const cur = v.x * wish.x + v.z * wish.z;
      const add = maxSpeed - cur;
      if (add > 0 && wish.lengthSq() > 0) {
        const acc = Math.min(ACCEL * maxSpeed * dt * 1.6, add);
        v.x += wish.x * acc; v.z += wish.z * acc;
      }
      if (moveEnabled && !frozen && input.hit('Space')) {
        v.y = JUMP_V;
        a.onGround = false;
        audio.jump();
      }
    } else {
      const wishSpd = Math.min(maxSpeed, 0.9);
      const cur = v.x * wish.x + v.z * wish.z;
      const add = wishSpd - cur;
      if (add > 0) {
        const acc = Math.min(AIR_ACCEL * maxSpeed * dt, add);
        v.x += wish.x * acc; v.z += wish.z * acc;
      }
    }
    v.y -= GRAVITY * dt;
    if (!a.onGround) this.fallSpeed = Math.max(this.fallSpeed, -v.y);
    const body = { pos: a.pos, vel: v, radius: a.radius, height: a.height, onGround: a.onGround };
    const preY = a.pos.y;
    s.collision.move(body, dt);
    a.onGround = body.onGround;
    // landing
    if (a.onGround && !this.wasGround) {
      const impact = this.fallSpeed;
      if (impact > 3) {
        s.viewmodel.landVel -= Math.min(0.6, impact * 0.06);
        this.landDip = Math.min(0.12, impact * 0.012);
        audio.land(Math.min(1, impact / 8));
      }
      if (impact > 13) s.damage(a, a, Math.round((impact - 13) * 9), 0, 'world', null, a.pos);
      this.fallSpeed = 0;
    }
    this.wasGround = a.onGround;
    // eye smoothing on steps
    const eyeTarget = a.pos.y + a.eye;
    const stepped = a.pos.y - preY;
    if (a.onGround && Math.abs(stepped) > 0.05 && Math.abs(stepped) < 0.7) this.smoothEye -= stepped;
    this.smoothEye = damp(this.smoothEye, 0, 18, dt);
    this.landDip = damp(this.landDip, 0, 8, dt);
    void eyeTarget;
    // footsteps
    const hsp = Math.hypot(v.x, v.z);
    if (a.onGround && hsp > 1) {
      this.stepDist += hsp * dt;
      if (this.stepDist > 2.1) {
        this.stepDist = 0;
        const quiet = a.walking || a.crouching;
        if (!quiet) {
          const c = s.map.cellAt(a.pos);
          audio.footstep(null, c && c.tile ? 'stone' : 'sand', 1);
          s.noise(a, a.pos, 18);
        }
      }
    }

    // ---------- weapons ----------
    this.updateWeapons(dt, moveEnabled);
    // decay recoil/punch
    const w = a.weapon;
    const sinceShot = s.time - a.lastShot;
    if (sinceShot > 0.12) {
      a.recoilIndex = Math.max(0, a.recoilIndex - dt * 14);
    }
    a.spreadHeat = damp(a.spreadHeat, 0, sinceShot > 0.1 ? 6 : 2, dt);
    const [rp, ry] = recoilOffset(w.def, a.recoilIndex);
    this.recoilPitch = damp(this.recoilPitch, rp, 30, dt);
    this.recoilYaw = damp(this.recoilYaw, ry, 30, dt);
    this.punchPitch = damp(this.punchPitch, 0, 12, dt);
    this.punchYaw = damp(this.punchYaw, 0, 12, dt);
  }

  private updateWeapons(dt: number, enabled: boolean) {
    const a = this.a, s = this.s, vm = s.viewmodel;
    const w = a.weapon;
    // reload finish
    if (w.reloading && s.time >= w.reloadEnd) {
      const need = w.def.mag - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take; w.reserve -= take;
      w.reloading = false;
    }
    if (!enabled) { this.heldFire = false; return; }
    // slot keys
    const sel: [string, Slot][] = [['Digit1', 'primary'], ['Digit2', 'secondary'], ['Digit3', 'knife'], ['Digit4', 'grenade'], ['Digit5', 'c4']];
    for (const [k, sl] of sel) if (input.hit(k)) this.equip(sl);
    if (input.hit('KeyQ')) this.equip(a.has(a.lastSlot) ? a.lastSlot : a.bestSlot());
    if (input.wheel !== 0) {
      const order: Slot[] = ['primary', 'secondary', 'knife', 'grenade', 'c4'].filter((x) => a.has(x as Slot)) as Slot[];
      let i = order.indexOf(a.slot);
      i = (i + (input.wheel > 0 ? 1 : -1) + order.length) % order.length;
      this.equip(order[i]);
    }
    if (input.hit('KeyR')) this.reload();
    if (input.hit('KeyF') && !w.reloading && vm.state === 'idle') vm.play('inspect', w.def.category === 'knife' ? 2.6 : 3.4);
    if (input.hit('KeyG')) s.dropActive(a);

    // interaction (plant / defuse / pickup)
    const eHeld = input.down('KeyE');
    const m = s.match;
    if (eHeld) {
      if (this.interact === 'none') {
        if (a.c4 && a.team === 'T' && m.canPlant(a)) {
          if (a.slot !== 'c4') this.equip('c4');
          this.interact = 'plant';
          this.interactT = 0;
          vm.play('plant', 99);
          a.vel.set(0, a.vel.y, 0);
        } else if (a.team === 'CT' && m.canDefuse(a)) {
          this.interact = 'defuse';
          m.startDefuse(a);
        } else if (input.hit('KeyE')) s.tryPickup(a, true);
      }
    } else if (this.interact !== 'none') this.cancelInteract();
    if (this.interact === 'plant') {
      if (!m.canPlant(a)) this.cancelInteract();
      else {
        const prev = this.interactT;
        this.interactT += dt;
        if (Math.floor(prev / 0.45) !== Math.floor(this.interactT / 0.45)) audio.keypad(Math.floor(this.interactT / 0.45));
        if (this.interactT >= m.plantTime) {
          this.interact = 'none';
          vm.state = 'idle';
          m.plant(a);
          this.equip(a.bestSlot(), true);
        }
      }
      return;
    }
    if (this.interact === 'defuse') {
      if (!m.canDefuse(a) && m.bomb.defuser !== a) this.cancelInteract();
      return;
    }

    // zoom / secondary
    if (input.mouseHit(2)) {
      if (w.def.scope) {
        this.zoom = (this.zoom + 1) % (w.def.scope.length + 1);
        audio.click(null, 0, 3500, 0.25);
      } else if (w.def.category === 'knife') {
        if (s.time >= w.nextFire) {
          w.nextFire = s.time + 1.0;
          vm.play('stab', 0.75);
          setTimeout(() => { if (a.alive) knifeAttack(s, a, true); }, 250);
        }
      }
    }
    this.focus = !w.def.scope && w.def.category !== 'knife' && input.mouse(2) && w.def.category !== 'grenade' ? 1 : 0;

    // fire
    const trig = input.mouse(0);
    const trigHit = input.mouseHit(0);
    if (!trig) this.heldFire = false;
    if (s.match.phase === 'freeze') return;
    if (w.def.category === 'c4') {
      if (trigHit && a.c4 && m.canPlant(a)) {
        this.interact = 'plant'; this.interactT = 0; vm.play('plant', 99);
      }
      return;
    }
    if (w.def.category === 'grenade') {
      if (trigHit && s.time >= w.nextFire && vm.state !== 'throw') {
        audio.pin();
        vm.play('throw', 0.55);
        w.nextFire = s.time + 1;
        const type = w.def.id as 'he' | 'flash' | 'smoke';
        setTimeout(() => {
          if (!a.alive) return;
          s.grenades.throw(a, type, 1);
          audio.throwWhoosh();
          const i = a.grenades.indexOf(w);
          if (i >= 0) a.grenades.splice(i, 1);
          if (a.grenades.length) { a.grenadeIndex = 0; this.equip('grenade', true); }
          else this.equip(a.has(a.lastSlot) && a.lastSlot !== 'grenade' ? a.lastSlot : a.bestSlot(), true);
        }, 300);
      }
      return;
    }
    if (w.def.category === 'knife') {
      if (trig && s.time >= w.nextFire) {
        w.nextFire = s.time + 0.4;
        vm.play('slash', 0.38);
        setTimeout(() => { if (a.alive) knifeAttack(s, a, false); }, 90);
      }
      return;
    }
    const wants = w.def.auto ? trig : trigHit;
    if (!wants) return;
    if (w.reloading) {
      return;
    }
    if (s.time < w.nextFire) return;
    if (w.mag <= 0) {
      if (trigHit) { audio.dryFire(); this.reload(); }
      return;
    }
    this.shoot(w);
  }

  private shoot(w: WeaponInst) {
    const a = this.a, s = this.s, d = w.def;
    w.mag--;
    w.nextFire = s.time + 60 / d.rpm;
    if (s.viewmodel.state === 'inspect') s.viewmodel.state = 'idle';
    // direction = view + recoil
    const [rp, ry] = recoilOffset(d, a.recoilIndex);
    const dir = dirFromYawPitch(a.yaw + ry + this.punchYaw * 0.0, a.pitch + rp);
    const mz = s.viewmodelMuzzleWorld();
    fireBullets(s, a, dir, d, this.scoped, mz);
    a.recoilIndex += 1;
    a.lastShot = s.time;
    a.spreadHeat = Math.min(0.12, a.spreadHeat + d.fireSpread);
    this.punchPitch += d.recoilUp * 0.55 + (d.category === 'sniper' ? 0.02 : 0);
    this.punchYaw += (Math.random() - 0.5) * d.recoilSide * 0.8;
    s.viewmodel.fire();
    s.effects.light(s.camera.position.clone().addScaledVector(dir, 1.2), d.silenced ? 0 : 5, 0xffa04a, 7);
    s.hud.crosshairKick(d.fireSpread);
    if (d.scope && this.zoom > 0) {
      const z = this.zoom;
      this.zoom = 0;
      setTimeout(() => { if (a.alive && a.weapon === w && w.mag > 0 && !w.reloading) this.zoom = z; }, 60000 / d.rpm * 0.9);
      audio.bolt(null, 0.35);
    } else if (d.scope || d.category === 'heavy') audio.bolt(null, 0.35);
    if (w.mag === 0 && w.reserve > 0) setTimeout(() => { if (a.weapon === w) this.reload(); }, 250);
  }

  /** current camera height offset for smoothing (step + land) */
  get eyeOffset() { return this.smoothEye - this.landDip; }
}
