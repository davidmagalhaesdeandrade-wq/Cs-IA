import * as THREE from 'three';
import { fabricTex } from './textures';

export type TeamId = 'T' | 'CT';

export interface AgentStyle {
  id: string;
  team: TeamId;
  name: string;
  desc: string;
  shirt: number;
  pants: number;
  vest: number;
  gear: number;
  mask: number;
  head: 'balaclava' | 'helmet' | 'gasmask' | 'cap';
  skin: number;
  boots: number;
  gloves: number;
}

export const AGENTS: AgentStyle[] = [
  { id: 't_phoenix', team: 'T', name: 'Phoenix Raider', desc: 'Camisa xadrez, colete leve e balaclava oliva.', shirt: 0x9a7e6a, pants: 0x4d4c33, vest: 0xb6a483, gear: 0x5a4a32, mask: 0x4a4a2e, head: 'balaclava', skin: 0xc79a7a, boots: 0x5a3f28, gloves: 0x3a3a34 },
  { id: 't_elite', team: 'T', name: 'Desert Elite', desc: 'Uniforme areia, lenço e máscara preta.', shirt: 0xb39a72, pants: 0x75634a, vest: 0x5b4f3c, gear: 0x3e3326, mask: 0x1d1d1d, head: 'balaclava', skin: 0xa77b5b, boots: 0x3b2c1e, gloves: 0x272522 },
  { id: 't_pro', team: 'T', name: 'The Professional', desc: 'Jaqueta escura, boné e equipamento urbano.', shirt: 0x2c2c30, pants: 0x3b3f47, vest: 0x1d1e21, gear: 0x7a1e1e, mask: 0x202020, head: 'cap', skin: 0xd2a587, boots: 0x161616, gloves: 0x111111 },
  { id: 'ct_gign', team: 'CT', name: 'Tactical Unit', desc: 'Uniforme azul-marinho, capacete balístico e óculos.', shirt: 0x2b3447, pants: 0x262e3d, vest: 0x1b1f26, gear: 0x313846, mask: 0x15171b, head: 'helmet', skin: 0xd3a68a, boots: 0x111214, gloves: 0x15161a },
  { id: 'ct_seal', team: 'CT', name: 'Naval Operator', desc: 'Camuflagem verde, capacete e colete de placas.', shirt: 0x4f5a40, pants: 0x46503a, vest: 0x5f6448, gear: 0x3d4430, mask: 0x2a2d24, head: 'helmet', skin: 0xc28f6e, boots: 0x3a3226, gloves: 0x2e2e26 },
  { id: 'ct_sas', team: 'CT', name: 'Special Air Unit', desc: 'Preto total, máscara de gás e lentes vermelhas.', shirt: 0x1e2024, pants: 0x1c1e22, vest: 0x2a2d31, gear: 0x3a3f45, mask: 0x111111, head: 'gasmask', skin: 0xc79a7a, boots: 0x0f0f10, gloves: 0x101010 }
];

const fab = () => fabricTex();
function mat(color: number, rough = 0.85, metal = 0, textured = true) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: textured ? fab() : null });
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

interface Limb { root: THREE.Group; mid: THREE.Group }

const UP_ARM = 0.31, LOW_ARM = 0.31;
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);

export interface CharState {
  speed: number;
  crouch: number;
  pitch: number;
  dead: boolean;
  airborne?: boolean;
}

export class CharacterModel {
  root = new THREE.Group();
  body = new THREE.Group();
  hips = new THREE.Group();
  spine = new THREE.Group();
  head = new THREE.Group();
  holder = new THREE.Group();
  armL: Limb; armR: Limb; legL: Limb; legR: Limb;
  weapon: THREE.Object3D | null = null;
  weaponKind: 'rifle' | 'pistol' | 'knife' | 'none' = 'none';
  phase = Math.random() * 10;
  breath = Math.random() * 10;
  flinchT = 0;
  deathT = 0;
  deathDir = 1;
  deathSide = 0;
  style: AgentStyle;

  constructor(style: AgentStyle) {
    this.style = style;
    const s = style;
    const shirt = mat(s.shirt), pants = mat(s.pants), vest = mat(s.vest, 0.8), gear = mat(s.gear, 0.75);
    const skin = new THREE.MeshStandardMaterial({ color: s.skin, roughness: 0.65 });
    const maskM = mat(s.mask, 0.9), boots = mat(s.boots, 0.7, 0, false), gloves = mat(s.gloves, 0.7);
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 });

    this.root.add(this.body);
    this.body.add(this.hips);
    this.hips.position.y = 0.95;
    // pelvis
    mesh(box(0.34, 0.18, 0.21), pants, this.hips, 0, 0.0, 0);
    mesh(box(0.36, 0.05, 0.23), gear, this.hips, 0, 0.08, 0); // belt
    mesh(box(0.08, 0.07, 0.05), gear, this.hips, 0.15, 0.02, -0.08); // pouch
    mesh(box(0.08, 0.12, 0.06), gear, this.hips, -0.19, -0.05, 0.02); // holster
    // legs
    const mkLeg = (side: number): Limb => {
      const root = new THREE.Group();
      root.position.set(0.1 * side, -0.05, 0);
      this.hips.add(root);
      mesh(cap(0.078, 0.3), pants, root, 0, -0.21, 0);
      if (s.team === 'T') mesh(box(0.1, 0.12, 0.05), gear, root, 0.07 * side, -0.24, 0.0, 0, 0, 0); // cargo pocket
      const mid = new THREE.Group();
      mid.position.y = -0.43;
      root.add(mid);
      mesh(cap(0.064, 0.32), pants, mid, 0, -0.21, 0);
      if (s.team === 'CT') mesh(box(0.11, 0.12, 0.05), dark, mid, 0, -0.02, -0.06); // knee pad
      mesh(box(0.11, 0.1, 0.26), boots, mid, 0, -0.44, -0.045);
      mesh(cap(0.066, 0.1), boots, mid, 0, -0.36, 0);
      return { root, mid };
    };
    this.legL = mkLeg(-1);
    this.legR = mkLeg(1);
    // torso
    this.hips.add(this.spine);
    this.spine.position.y = 0.06;
    const torso = mesh(cap(0.16, 0.26), shirt, this.spine, 0, 0.32, 0);
    torso.scale.set(1.22, 1, 0.78);
    mesh(cap(0.14, 0.08), shirt, this.spine, 0, 0.1, 0).scale.set(1.15, 1, 0.8);
    // vest
    if (s.team === 'CT' || s.id === 't_phoenix' || s.id === 't_elite') {
      const v = mesh(box(0.42, 0.38, 0.27), vest, this.spine, 0, 0.33, 0);
      v.scale.set(1, 1, 1);
      if (s.team === 'CT') {
        for (let i = 0; i < 3; i++) mesh(box(0.1, 0.12, 0.06), gear, this.spine, -0.12 + i * 0.12, 0.24, -0.16);
        mesh(box(0.32, 0.05, 0.03), dark, this.spine, 0, 0.42, -0.145);
        mesh(box(0.12, 0.08, 0.04), gear, this.spine, 0.14, 0.44, -0.15);
      } else {
        mesh(box(0.14, 0.1, 0.05), gear, this.spine, 0.1, 0.27, -0.15);
        mesh(box(0.1, 0.1, 0.05), gear, this.spine, -0.1, 0.27, -0.15);
      }
      mesh(box(0.08, 0.03, 0.3), vest, this.spine, 0.15, 0.52, 0);
      mesh(box(0.08, 0.03, 0.3), vest, this.spine, -0.15, 0.52, 0);
    } else {
      mesh(box(0.42, 0.42, 0.26), shirt, this.spine, 0, 0.32, 0); // jacket
      mesh(box(0.06, 0.4, 0.02), gear, this.spine, 0.06, 0.32, -0.135); // zipper strip
    }
    // backpack / radio
    mesh(box(0.26, 0.3, 0.1), gear, this.spine, 0, 0.32, 0.17);
    mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3), dark, this.spine, 0.1, 0.6, 0.2);
    // neck + head
    mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), s.head === 'cap' ? skin : maskM, this.spine, 0, 0.57, 0);
    this.head.position.y = 0.63;
    this.spine.add(this.head);
    const headM = s.head === 'cap' ? skin : maskM;
    const skull = mesh(new THREE.SphereGeometry(0.115, 18, 14), headM, this.head, 0, 0.1, 0);
    skull.scale.set(0.9, 1.08, 1.0);
    const eyeM = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 });
    const pupil = new THREE.MeshStandardMaterial({ color: 0x1b140f, roughness: 0.3 });
    if (s.head === 'balaclava' || s.head === 'helmet' || s.head === 'cap') {
      // eye opening (skin strip) + eyes
      const strip = mesh(box(0.15, 0.045, 0.04), skin, this.head, 0, 0.12, -0.092);
      strip.scale.z = 1;
      for (const sx of [-0.035, 0.035]) {
        mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeM, this.head, sx, 0.122, -0.108);
        mesh(new THREE.SphereGeometry(0.007, 6, 4), pupil, this.head, sx, 0.122, -0.12);
      }
      if (s.head !== 'cap') mesh(box(0.05, 0.02, 0.03), skin, this.head, 0, 0.045, -0.1); // mouth hole
      mesh(box(0.03, 0.04, 0.03), headM, this.head, 0, 0.09, -0.115); // nose
    }
    if (s.head === 'cap') {
      mesh(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(s.gear), this.head, 0, 0.14, 0);
      mesh(box(0.16, 0.012, 0.1), mat(s.gear), this.head, 0, 0.15, -0.13);
      mesh(box(0.15, 0.05, 0.03), dark, this.head, 0, 0.12, -0.115); // sunglasses
      mesh(box(0.06, 0.05, 0.03), skin, this.head, 0, 0.06, -0.1);
    }
    if (s.head === 'helmet') {
      const helmM = new THREE.MeshStandardMaterial({ color: s.gear, roughness: 0.6, metalness: 0.2 });
      mesh(new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), helmM, this.head, 0, 0.13, 0.005);
      mesh(new THREE.CylinderGeometry(0.137, 0.14, 0.03, 18), helmM, this.head, 0, 0.13, 0.005);
      mesh(box(0.14, 0.035, 0.03), dark, this.head, 0, 0.22, -0.125); // NVG mount
      const goggle = new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.1, metalness: 0.8 });
      mesh(box(0.16, 0.04, 0.03), goggle, this.head, 0, 0.17, -0.12);
      mesh(box(0.02, 0.06, 0.02), dark, this.head, 0.13, 0.14, 0); // headset
      mesh(box(0.02, 0.06, 0.02), dark, this.head, -0.13, 0.14, 0);
    }
    if (s.head === 'gasmask') {
      const gm = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
      for (const sx of [-0.04, 0.04]) {
        mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), gm, this.head, sx, 0.13, -0.1, Math.PI / 2);
        mesh(new THREE.CircleGeometry(0.024, 14), new THREE.MeshBasicMaterial({ color: 0xff2222 }), this.head, sx, 0.13, -0.117, 0, Math.PI);
      }
      mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.07, 12), gm, this.head, 0, 0.04, -0.12, Math.PI / 2.4);
      mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0x5d6247, roughness: 0.7 }), this.head, 0.06, 0.02, -0.15, Math.PI / 2.4, 0, -0.5);
      mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mat(s.gear), this.head, 0, 0.12, 0.01);
    }
    // arms
    const mkArm = (side: number): Limb => {
      const root = new THREE.Group();
      root.position.set(0.21 * side, 0.5, side < 0 ? -0.06 : 0);
      this.spine.add(root);
      mesh(new THREE.SphereGeometry(0.07, 10, 8), s.team === 'CT' ? vest : shirt, root, 0, -0.02, 0);
      mesh(cap(0.055, UP_ARM - 0.1), shirt, root, 0, -UP_ARM / 2, 0);
      const mid = new THREE.Group();
      mid.position.y = -UP_ARM;
      root.add(mid);
      mesh(cap(0.047, LOW_ARM - 0.12), shirt, mid, 0, -LOW_ARM / 2 + 0.02, 0);
      mesh(new THREE.SphereGeometry(0.048, 10, 8), gloves, mid, 0, -LOW_ARM + 0.04, 0).scale.set(0.9, 1.2, 1.1);
      return { root, mid };
    };
    this.armL = mkArm(-1);
    this.armR = mkArm(1);
    this.spine.add(this.holder);
    this.root.traverse((o) => { o.frustumCulled = true; });
  }

  setWeapon(obj: THREE.Object3D | null, kind: 'rifle' | 'pistol' | 'knife' | 'none') {
    if (this.weapon) this.holder.remove(this.weapon);
    this.weapon = obj;
    this.weaponKind = kind;
    if (obj) this.holder.add(obj);
    if (kind === 'rifle') this.holder.position.set(0.11, 0.44, -0.3);
    else if (kind === 'pistol') this.holder.position.set(0.02, 0.45, -0.5);
    else this.holder.position.set(0.2, 0.3, -0.38);
    this.holder.rotation.set(0, 0, 0);
    this.solveArms();
  }

  /** two-bone IK in spine space */
  private ik(limb: Limb, target: THREE.Vector3, pole: THREE.Vector3) {
    const S = _v1.copy(limb.root.position);
    const d = _v2.copy(target).sub(S);
    let dist = d.length();
    dist = Math.min(dist, UP_ARM + LOW_ARM - 0.005);
    d.normalize();
    const cosA = (UP_ARM * UP_ARM + dist * dist - LOW_ARM * LOW_ARM) / (2 * UP_ARM * dist);
    const a = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    const p = _v3.copy(pole).sub(d.clone().multiplyScalar(pole.dot(d))).normalize();
    const elbowDir = d.clone().multiplyScalar(Math.cos(a)).add(p.multiplyScalar(Math.sin(a))).normalize();
    limb.root.quaternion.setFromUnitVectors(DOWN, elbowDir);
    const E = S.clone().add(elbowDir.clone().multiplyScalar(UP_ARM));
    const fw = target.clone().sub(E).normalize();
    _q.copy(limb.root.quaternion).invert();
    fw.applyQuaternion(_q);
    limb.mid.quaternion.setFromUnitVectors(DOWN, fw);
  }

  solveArms() {
    const h = this.holder;
    const grip = new THREE.Vector3(0, -0.05, 0.035).add(h.position);
    let sup = new THREE.Vector3(-0.25, 0.1, -0.05);
    const s = this.weapon?.getObjectByName('support');
    if (s && this.weaponKind !== 'knife') sup = s.position.clone().add(h.position);
    if (this.weaponKind === 'none') {
      this.ik(this.armR, new THREE.Vector3(0.28, 0.0, -0.02), new THREE.Vector3(0, 0, 1));
      this.ik(this.armL, new THREE.Vector3(-0.28, 0.0, -0.02), new THREE.Vector3(0, 0, 1));
      return;
    }
    this.ik(this.armR, grip, new THREE.Vector3(1, -1, 0.4));
    this.ik(this.armL, sup, new THREE.Vector3(-1, -1, 0.2));
  }

  flinch() { this.flinchT = 1; }

  resetPose() {
    this.deathT = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.holder.visible = true;
  }

  update(dt: number, st: CharState) {
    if (st.dead) {
      if (this.deathT === 0) {
        this.deathDir = Math.random() < 0.65 ? 1 : -1;
        this.deathSide = (Math.random() - 0.5) * 0.8;
        this.holder.visible = false;
      }
      this.deathT = Math.min(1, this.deathT + dt * 2.2);
      const e = 1 - Math.pow(1 - this.deathT, 3);
      this.body.rotation.x = this.deathDir * e * 1.5;
      this.body.rotation.z = this.deathSide * e;
      this.body.position.y = e * 0.12;
      this.legL.root.rotation.x = -0.3 * e; this.legR.root.rotation.x = 0.2 * e;
      this.legL.mid.rotation.x = -0.4 * e; this.legR.mid.rotation.x = -0.9 * e;
      this.armL.root.rotation.set(-1.5 * e, 0, -0.8 * e);
      this.armR.root.rotation.set(-1.2 * e, 0, 0.9 * e);
      this.armL.mid.rotation.set(0, 0, 0); this.armR.mid.rotation.set(0, 0, 0);
      this.head.rotation.set(-0.4 * e * this.deathDir, 0.6 * e, 0);
      return;
    }
    const speed = st.speed;
    const amp = Math.min(1, speed / 5);
    this.phase += dt * (3 + speed * 1.25);
    this.breath += dt * 1.6;
    const c = st.crouch;
    const sw = Math.sin(this.phase);
    const air = st.airborne ? 1 : 0;
    // legs
    const crouchThigh = 1.05 * c, crouchKnee = -1.85 * c;
    this.legL.root.rotation.x = sw * 0.55 * amp + crouchThigh + air * 0.5;
    this.legR.root.rotation.x = -sw * 0.55 * amp + crouchThigh + air * 0.1;
    this.legL.mid.rotation.x = -(0.1 + Math.max(0, Math.sin(this.phase + 1.4)) * 0.9) * amp + crouchKnee - air * 0.9;
    this.legR.mid.rotation.x = -(0.1 + Math.max(0, Math.sin(this.phase + 1.4 + Math.PI)) * 0.9) * amp + crouchKnee - air * 0.4;
    this.hips.position.y = 0.95 - 0.4 * c + Math.abs(Math.cos(this.phase)) * 0.035 * amp + Math.sin(this.breath) * 0.003;
    this.hips.rotation.y = sw * 0.08 * amp;
    // spine follows aim pitch; breathing; flinch
    this.flinchT = Math.max(0, this.flinchT - dt * 5);
    this.spine.rotation.x = THREE.MathUtils.clamp(st.pitch, -0.9, 0.9) * 0.85 - 0.12 * c + Math.sin(this.breath) * 0.012 + this.flinchT * 0.25;
    this.spine.rotation.y = -this.hips.rotation.y;
    this.spine.rotation.z = this.flinchT * 0.1;
    this.head.rotation.x = THREE.MathUtils.clamp(st.pitch, -0.9, 0.9) * 0.2;
    this.head.rotation.y = Math.sin(this.breath * 0.3) * 0.05;
  }
}
