import * as THREE from 'three';
import { buildWeapon } from '../render/weaponModels';
import { muzzleTex, fabricTex } from '../render/textures';
import { WEAPONS } from '../data/weapons';
import type { Pattern } from '../data/skins';
import { clamp, damp } from '../core/util';

type Anim = 'idle' | 'equip' | 'reload' | 'inspect' | 'slash' | 'stab' | 'throw' | 'bolt' | 'plant';

const smooth = (t: number) => t * t * (3 - 2 * t);
const seg = (t: number, a: number, b: number) => smooth(clamp((t - a) / (b - a), 0, 1));

interface Arm { group: THREE.Group; fore: THREE.Mesh; sleeve: THREE.Mesh; hand: THREE.Group }

export class Viewmodel {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.01, 20);
  base = new THREE.Group();
  sway = new THREE.Group();
  anim = new THREE.Group();
  gun: THREE.Group | null = null;
  weaponId = '';
  state: Anim = 'idle';
  t = 0;
  dur = 1;
  kick = 0;
  kickVel = 0;
  slideT = 0;
  bobPhase = 0;
  land = 0;
  landVel = 0;
  swayX = 0; swayY = 0;
  flash: THREE.Sprite;
  flashT = 0;
  armL: Arm; armR: Arm;
  visible = true;
  magHome = new THREE.Vector3();
  boltHome = new THREE.Vector3();
  supportHome = new THREE.Vector3(0, -0.03, -0.3);
  private keyLight: THREE.DirectionalLight;
  private flashLight: THREE.PointLight;

  constructor(env: THREE.Texture | null) {
    this.scene.add(this.base);
    this.base.add(this.sway);
    this.sway.add(this.anim);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x8a6a48, 1.4));
    this.keyLight = new THREE.DirectionalLight(0xfff0d8, 2.4);
    this.keyLight.position.set(0.6, 1, 0.3);
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0xbfd4ff, 0.8);
    rim.position.set(-1, 0.4, -0.6);
    this.scene.add(rim);
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 2, 2);
    this.scene.add(this.flashLight);
    if (env) this.scene.environment = env;
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex(), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
    this.flash.visible = false;
    this.flash.renderOrder = 10;
    this.armL = this.mkArm();
    this.armR = this.mkArm();
  }

  private mkArm(): Arm {
    const group = new THREE.Group();
    const skinM = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.75, map: fabricTex() });
    const sleeveM = new THREE.MeshStandardMaterial({ color: 0x2b3447, roughness: 0.9, map: fabricTex() });
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 1, 10).translate(0, 0.5, 0), skinM);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1, 10).translate(0, 0.5, 0), sleeveM);
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.031, 14, 10), skinM);
    palm.scale.set(0.9, 0.62, 1.18);
    hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.027, 3, 7), skinM);
      finger.rotation.x = Math.PI / 2;
      finger.position.set(-0.019 + i * 0.0125, -0.004, -0.045);
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.026, 3, 7), skinM);
    thumb.rotation.set(0.35, 0, -0.85);
    thumb.position.set(-0.039, -0.002, -0.012);
    hand.add(thumb);
    group.add(fore, sleeve, hand);
    return { group, fore, sleeve, hand };
  }

  setTeamColors(sleeve: number, glove: number) {
    for (const a of [this.armL, this.armR]) {
      (a.sleeve.material as THREE.MeshStandardMaterial).color.setHex(sleeve);
      (a.fore.material as THREE.MeshStandardMaterial).color.setHex(glove);
      a.hand.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) (mesh.material as THREE.MeshStandardMaterial).color.setHex(glove); });
    }
  }

  private placeArm(a: Arm, hand: THREE.Vector3, elbow: THREE.Vector3) {
    const dir = elbow.clone().sub(hand);
    const len = dir.length();
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    a.fore.position.copy(hand); a.fore.quaternion.copy(q); a.fore.scale.set(1, len, 1);
    a.sleeve.position.copy(hand).addScaledVector(dir, len * 0.45); a.sleeve.quaternion.copy(q); a.sleeve.scale.set(1, len * 0.7, 1);
    a.hand.position.copy(hand); a.hand.quaternion.copy(q);
  }

  setWeapon(id: string, pattern: Pattern) {
    if (this.gun) this.anim.remove(this.gun);
    this.weaponId = id;
    const g = buildWeapon(id, pattern);
    g.traverse((o) => { o.castShadow = false; o.frustumCulled = false; });
    this.gun = g;
    this.anim.add(g);
    g.add(this.armL.group, this.armR.group);
    const mz = g.getObjectByName('muzzle');
    if (mz) mz.add(this.flash);
    const mag = g.getObjectByName('mag');
    if (mag) this.magHome.copy(mag.position);
    const bolt = g.getObjectByName('bolt');
    if (bolt) this.boltHome.copy(bolt.position);
    const sup = g.getObjectByName('support');
    this.supportHome.copy(sup ? sup.position : new THREE.Vector3(-0.05, -0.05, 0));
    const cat = WEAPONS[id].category;
    if (cat === 'pistol') this.base.position.set(0.15, -0.17, -0.44);
    else if (cat === 'knife') this.base.position.set(0.18, -0.19, -0.38);
    else if (cat === 'grenade') this.base.position.set(0.18, -0.18, -0.38);
    else if (cat === 'c4') this.base.position.set(0.06, -0.24, -0.42);
    else if (cat === 'sniper') this.base.position.set(0.17, -0.19, -0.42);
    else this.base.position.set(0.17, -0.19, -0.44);
    this.base.rotation.set(0, 0.05, 0);
    if (cat === 'c4') this.base.rotation.set(0.5, 0.3, 0);
    this.play('equip', WEAPONS[id].equipTime);
  }

  play(a: Anim, dur: number) {
    this.state = a;
    this.t = 0;
    this.dur = dur;
  }
  get busy() { return this.state !== 'idle' && this.state !== 'inspect'; }

  fire() {
    const def = WEAPONS[this.weaponId];
    if (!def) return;
    if (this.state === 'inspect') this.state = 'idle';
    const strength = def.category === 'sniper' ? 2.2 : def.id === 'deagle' ? 2 : def.category === 'pistol' ? 1.2 : 1;
    this.kickVel += 1.6 * strength;
    this.slideT = 1;
    if (!def.silenced) {
      this.flash.visible = true;
      this.flashT = 0.045;
      this.flash.scale.setScalar(def.category === 'pistol' ? 0.16 : 0.24 + Math.random() * 0.08);
      (this.flash.material as THREE.SpriteMaterial).rotation = Math.random() * 6.28;
      this.flashLight.intensity = 6;
    }
    if (def.category === 'sniper') this.play('bolt', 60 / def.rpm * 0.9);
    if (def.category === 'heavy') this.play('bolt', 60 / def.rpm * 0.9);
  }

  update(dt: number, p: { speed: number; maxSpeed: number; onGround: boolean; crouch: number; dx: number; dy: number; walking: boolean }) {
    if (!this.gun) return;
    this.t += dt;
    const k = clamp(this.t / this.dur, 0, 1);
    // spring kick
    this.kickVel += (-this.kick * 220 - this.kickVel * 22) * dt;
    this.kick += this.kickVel * dt;
    this.landVel += (-this.land * 160 - this.landVel * 16) * dt;
    this.land += this.landVel * dt;
    this.slideT = Math.max(0, this.slideT - dt * 14);
    // bob
    const moveK = p.onGround ? clamp(p.speed / Math.max(1, p.maxSpeed), 0, 1) : 0;
    this.bobPhase += dt * (6 + p.speed * 1.2) * (moveK > 0.05 ? 1 : 0);
    const bobAmp = moveK * (p.walking ? 0.4 : 1);
    // sway
    this.swayX = damp(this.swayX, clamp(-p.dx * 0.0009, -0.06, 0.06), 10, dt);
    this.swayY = damp(this.swayY, clamp(-p.dy * 0.0009, -0.05, 0.05), 10, dt);
    this.sway.position.set(Math.sin(this.bobPhase) * 0.011 * bobAmp + this.swayX * 0.3, -Math.abs(Math.cos(this.bobPhase)) * 0.009 * bobAmp + this.land * 0.6 - p.crouch * 0.008 + this.swayY * 0.2, 0);
    this.sway.rotation.set(this.swayY * 1.0, this.swayX * 1.2, Math.sin(this.bobPhase) * 0.012 * bobAmp + this.swayX * 0.5);
    // reset anim transform
    const a = this.anim;
    a.position.set(0, 0, this.kick * 0.045);
    a.rotation.set(this.kick * 0.09, 0, 0);
    const g = this.gun;
    const mag = g.getObjectByName('mag');
    const bolt = g.getObjectByName('bolt');
    const slide = g.getObjectByName('slide');
    if (slide) {
      if (slide.userData.z0 === undefined) slide.userData.z0 = slide.position.z;
      slide.position.z = slide.userData.z0 + this.slideT * 0.035;
    }
    if (mag) { mag.position.copy(this.magHome); mag.visible = true; }
    if (bolt) { bolt.position.copy(this.boltHome); bolt.rotation.set(0, 0, 0); }
    const butterflyLeft = g.getObjectByName('butterflyHandleLeft') as THREE.Group | null;
    const butterflyRight = g.getObjectByName('butterflyHandleRight') as THREE.Group | null;
    if (butterflyLeft) butterflyLeft.rotation.set(0, 0, 0);
    if (butterflyRight) butterflyRight.rotation.set(0, 0, 0);
    const hand = this.supportHome.clone();
    let rightHand = new THREE.Vector3(0, -0.055, 0.035);
    const cat = WEAPONS[this.weaponId].category;

    switch (this.state) {
      case 'equip': {
        const e = 1 - smooth(k);
        a.position.y -= 0.22 * e;
        a.rotation.x -= 0.9 * e;
        a.rotation.z += 0.3 * e;
        break;
      }
      case 'reload': {
        const tilt = seg(k, 0, 0.15) * (1 - seg(k, 0.85, 1));
        a.rotation.z += 0.55 * tilt;
        a.rotation.x += 0.18 * tilt;
        a.position.x -= 0.04 * tilt;
        a.position.y += 0.02 * tilt;
        if (mag) {
          const out = seg(k, 0.12, 0.3), back = seg(k, 0.5, 0.7);
          const drop = out * (1 - back);
          mag.position.y -= 0.35 * drop;
          mag.position.z += 0.05 * drop;
          mag.visible = !(k > 0.3 && k < 0.5);
          hand.lerp(mag.position.clone().add(new THREE.Vector3(0, -0.05, 0)), seg(k, 0.05, 0.15) * (1 - seg(k, 0.75, 0.85)));
          hand.y -= 0.3 * seg(k, 0.3, 0.38) * (1 - seg(k, 0.45, 0.55));
        }
        const boltT = seg(k, 0.78, 0.86) * (1 - seg(k, 0.88, 0.95));
        a.position.z += 0.025 * boltT;
        a.rotation.y -= 0.08 * boltT;
        if (cat === 'pistol' && slide) slide.position.z += 0.03 * boltT;
        break;
      }
      case 'bolt': {
        const b = seg(k, 0.15, 0.4) * (1 - seg(k, 0.6, 0.9));
        a.rotation.z += 0.25 * b;
        a.position.y -= 0.02 * b;
        if (bolt) { bolt.rotation.z = -1.2 * seg(k, 0.15, 0.3) * (1 - seg(k, 0.75, 0.9)); bolt.position.z += 0.07 * seg(k, 0.3, 0.45) * (1 - seg(k, 0.55, 0.7)); }
        if (mag && cat === 'heavy') mag.position.z += 0.1 * b;
        rightHand = rightHand.clone().lerp(new THREE.Vector3(0.05, 0.03, 0.08), b);
        break;
      }
      case 'inspect': {
        const show = seg(k, 0.0, 0.18) * (1 - seg(k, 0.82, 1));
        a.position.x -= (cat === 'knife' ? 0.075 : 0.1) * show;
        a.position.y += 0.03 * show;
        a.position.z += 0.06 * show;
        if (cat === 'knife') {
          const style = g.userData.knifeStyle;
          const turn = seg(k, 0.22, 0.48) * (1 - seg(k, 0.68, 0.88));
          const settle = seg(k, 0.08, 0.24) * (1 - seg(k, 0.78, 0.94));
          a.rotation.y += 0.45 * settle - 0.35 * turn;
          a.rotation.x += 0.12 * settle;
          if (style === 'butterfly') {
            const flourish = seg(k, 0.12, 0.28) * (1 - seg(k, 0.62, 0.8));
            const flick = Math.sin(seg(k, 0.18, 0.62) * Math.PI * 2);
            if (butterflyLeft) butterflyLeft.rotation.x = flick * 1.05 * flourish;
            if (butterflyRight) butterflyRight.rotation.x = -flick * 1.05 * flourish;
            a.rotation.z += 0.22 * turn;
          } else if (style === 'karambit') {
            const roll = Math.sin(seg(k, 0.18, 0.76) * Math.PI);
            a.rotation.z += 0.48 * roll;
            a.rotation.y += 0.28 * roll;
            a.position.y += 0.025 * roll;
          } else if (style === 'm9') {
            const reveal = Math.sin(seg(k, 0.16, 0.82) * Math.PI);
            a.rotation.y += 0.58 * reveal;
            a.rotation.z -= 0.16 * turn;
            a.position.y += 0.018 * turn;
            a.position.z += 0.025 * reveal;
          } else if (style === 'stiletto') {
            a.rotation.x += 0.2 * turn;
            a.rotation.y += 0.12 * turn;
          }
        } else {
          const p2 = seg(k, 0.4, 0.58);
          a.rotation.y += 0.95 - 1.9 * p2;
          a.rotation.z += 0.55 - 1.2 * p2;
          a.rotation.x += 0.15 * show;
        }
        break;
      }
      case 'slash': {
        const s = Math.sin(Math.min(1, k * 1.2) * Math.PI);
        a.rotation.z += 1.2 - k * 2.4 * (k < 0.8 ? 1 : 1);
        a.rotation.y += 0.6 * s;
        a.position.x -= 0.2 * smooth(clamp(k * 1.3, 0, 1)) * s;
        a.position.z -= 0.08 * s;
        if (k < 0.1) a.rotation.z = 1.2 * (k / 0.1);
        break;
      }
      case 'stab': {
        const wind = seg(k, 0, 0.3), go = seg(k, 0.3, 0.5), back = seg(k, 0.6, 1);
        a.position.z += 0.08 * wind - 0.35 * go * (1 - back);
        a.position.x -= 0.1 * go * (1 - back);
        a.rotation.x -= 0.4 * go * (1 - back);
        a.rotation.y += 0.3 * go * (1 - back);
        break;
      }
      case 'throw': {
        const wind = seg(k, 0, 0.4), go = seg(k, 0.4, 0.6);
        a.position.y += 0.08 * wind - 0.3 * go;
        a.position.z += 0.1 * wind - 0.4 * go;
        a.rotation.x += 0.8 * wind - 1.5 * go;
        g.visible = k < 0.6;
        break;
      }
      case 'plant': {
        a.position.y += Math.sin(this.t * 24) * 0.006;
        a.position.z -= 0.04;
        break;
      }
    }
    if (this.state !== 'throw') g.visible = this.visible;
    if (this.state !== 'idle' && this.state !== 'plant' && this.t >= this.dur) this.state = 'idle';
    // arms
    const L = this.armL, R = this.armR;
    const twoHanded = cat !== 'knife' && cat !== 'grenade';
    L.group.visible = twoHanded || this.state === 'reload';
    this.placeArm(R, rightHand, new THREE.Vector3(0.09, -0.3, 0.42));
    if (cat === 'pistol') this.placeArm(L, hand.clone().add(new THREE.Vector3(-0.025, -0.01, -0.01)), new THREE.Vector3(-0.2, -0.28, 0.32));
    else if (cat === 'c4') this.placeArm(L, new THREE.Vector3(-0.05, 0.03, -0.02), new THREE.Vector3(-0.18, -0.25, 0.3));
    else this.placeArm(L, hand, new THREE.Vector3(-0.22, -0.3, hand.z + 0.35));
    // muzzle flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) { this.flash.visible = false; this.flashLight.intensity = 0; }
      const mz = g.getObjectByName('muzzle');
      if (mz) mz.getWorldPosition(this.flashLight.position);
    }
  }

  render(renderer: THREE.WebGLRenderer) {
    if (!this.visible || !this.gun) return;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
