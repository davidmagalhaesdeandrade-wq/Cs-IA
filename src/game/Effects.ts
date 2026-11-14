import * as THREE from 'three';
import { bulletHoleTex, bloodTex, muzzleTex, radialTex, smokeTex } from '../render/textures';
import type { Surface } from '../world/Collision';

class ParticleSystem {
  max: number;
  geo = new THREE.BufferGeometry();
  pos: Float32Array; col: Float32Array; size: Float32Array;
  vel: Float32Array; life: Float32Array; maxLife: Float32Array; grav: Float32Array; drag: Float32Array; baseSize: Float32Array; grow: Float32Array; baseA: Float32Array;
  points: THREE.Points;
  cursor = 0;
  mat: THREE.ShaderMaterial;
  constructor(max: number, additive: boolean, tex: THREE.Texture) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.baseA = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 800 }, map: { value: tex } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vColor; uniform float scale;
        void main(){ vColor = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = min(512.0, size * scale / max(0.1, -mv.z)); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a); if(gl_FragColor.a < 0.01) discard; }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  spawn(p: THREE.Vector3, v: THREE.Vector3, life: number, size: number, r: number, g: number, b: number, a: number, grav = 9.8, drag = 0.5, grow = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.col[i * 4 + 3] = a;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
    this.baseSize[i] = size; this.size[i] = size; this.grow[i] = grow; this.baseA[i] = a;
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) { this.size[i] = 0; this.col[i * 4 + 3] = 0; } continue; }
      this.life[i] -= dt;
      const k = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 4 + 3] = this.baseA[i] * Math.min(1, t * 2);
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * (1 - t));
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
  }
}

class DecalPool {
  mesh: THREE.InstancedMesh;
  i = 0;
  constructor(max: number, tex: THREE.Texture, size: number) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size), mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  add(p: THREE.Vector3, n: THREE.Vector3, scale = 1) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * 6.28));
    m.compose(p.clone().addScaledVector(n, 0.01), q, new THREE.Vector3(scale, scale, scale));
    this.mesh.setMatrixAt(this.i, m);
    this.i = (this.i + 1) % this.mesh.instanceMatrix.count;
    this.mesh.count = Math.min(this.mesh.instanceMatrix.count, this.mesh.count + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

interface Tracer { a: THREE.Vector3; b: THREE.Vector3; t: number }
interface Flash { sprite: THREE.Sprite; t: number; max: number; grow: number }

export class Effects {
  scene: THREE.Scene;
  add: ParticleSystem;
  norm: ParticleSystem;
  smoke: ParticleSystem;
  holes: DecalPool;
  blood: DecalPool;
  tracers: Tracer[] = [];
  tracerGeo: THREE.BufferGeometry;
  tracerLines: THREE.LineSegments;
  lights: THREE.PointLight[] = [];
  lightT: number[] = [];
  flashes: Flash[] = [];
  private v = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const soft = radialTex('soft', [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    this.add = new ParticleSystem(800, true, soft);
    this.norm = new ParticleSystem(900, false, soft);
    this.smoke = new ParticleSystem(500, false, smokeTex());
    scene.add(this.add.points, this.norm.points, this.smoke.points);
    this.holes = new DecalPool(220, bulletHoleTex(), 0.11);
    this.blood = new DecalPool(40, bloodTex(), 1.0);
    scene.add(this.holes.mesh, this.blood.mesh);
    const N = 48;
    this.tracerGeo = new THREE.BufferGeometry();
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.tracerLines = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.tracerLines.frustumCulled = false;
    scene.add(this.tracerLines);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 9, 2);
      scene.add(l);
      this.lights.push(l);
      this.lightT.push(0);
    }
  }

  setScale(h: number, fov: number) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.add.mat.uniforms.scale.value = s;
    this.norm.mat.uniforms.scale.value = s;
    this.smoke.mat.uniforms.scale.value = s;
  }

  light(p: THREE.Vector3, intensity: number, color = 0xffb060, dist = 9) {
    let idx = 0;
    for (let i = 1; i < this.lights.length; i++) if (this.lightT[i] < this.lightT[idx]) idx = i;
    const l = this.lights[idx];
    l.position.copy(p);
    l.color.setHex(color);
    l.distance = dist;
    l.intensity = intensity;
    l.userData.base = intensity;
    this.lightT[idx] = 1;
  }

  impact(p: THREE.Vector3, n: THREE.Vector3, surf: Surface) {
    this.holes.add(p, n, 0.8 + Math.random() * 0.5);
    const rnd = () => (Math.random() - 0.5);
    const dustCol = surf === 'wood' ? [0.55, 0.42, 0.28] : surf === 'metal' ? [0.6, 0.6, 0.6] : [0.82, 0.72, 0.55];
    for (let i = 0; i < 6; i++) {
      this.v.set(n.x * 2 + rnd() * 2, n.y * 2 + Math.random() * 2, n.z * 2 + rnd() * 2);
      this.norm.spawn(p, this.v, 0.5 + Math.random() * 0.5, 0.08 + Math.random() * 0.1, dustCol[0], dustCol[1], dustCol[2], 0.7, 3, 2.5, 3);
    }
    for (let i = 0; i < 4; i++) {
      this.v.set(n.x * 3 + rnd() * 4, n.y * 3 + Math.random() * 3, n.z * 3 + rnd() * 4);
      this.norm.spawn(p, this.v, 0.6, 0.025, dustCol[0] * 0.6, dustCol[1] * 0.6, dustCol[2] * 0.6, 1, 12, 0.5);
    }
    if (surf === 'metal' || Math.random() < 0.3) {
      for (let i = 0; i < (surf === 'metal' ? 10 : 4); i++) {
        this.v.set(n.x * 4 + rnd() * 6, n.y * 4 + Math.random() * 5, n.z * 4 + rnd() * 6);
        this.add.spawn(p, this.v, 0.25 + Math.random() * 0.2, 0.03, 1, 0.75, 0.35, 1, 14, 0.5);
      }
    }
  }

  bloodHit(p: THREE.Vector3, dir: THREE.Vector3, head: boolean) {
    const rnd = () => (Math.random() - 0.5);
    for (let i = 0; i < (head ? 22 : 12); i++) {
      this.v.set(dir.x * 2 + rnd() * 2.5, Math.random() * 2, dir.z * 2 + rnd() * 2.5);
      this.norm.spawn(p, this.v, 0.4 + Math.random() * 0.4, 0.05 + Math.random() * 0.06, 0.55, 0.03, 0.02, 0.95, 9, 1);
    }
    this.norm.spawn(p, this.v.set(0, 0.3, 0), 0.4, head ? 0.6 : 0.35, 0.5, 0.05, 0.04, 0.6, 0, 1, 1.5);
  }

  bloodSplat(p: THREE.Vector3, n: THREE.Vector3) { this.blood.add(p, n, 0.6 + Math.random() * 0.8); }

  tracer(a: THREE.Vector3, b: THREE.Vector3) {
    if (this.tracers.length > 40) this.tracers.shift();
    this.tracers.push({ a: a.clone(), b: b.clone(), t: 0.06 });
  }

  muzzle3P(p: THREE.Vector3, dir: THREE.Vector3, silenced: boolean) {
    if (!silenced) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: muzzleTex(), blending: THREE.AdditiveBlending, depthWrite: false, rotation: Math.random() * 6 }));
      s.position.copy(p).addScaledVector(dir, 0.05);
      s.scale.setScalar(0.45);
      this.scene.add(s);
      this.flashes.push({ sprite: s, t: 0.05, max: 0.05, grow: 0 });
      this.light(p, 8, 0xffa040, 7);
    }
    this.smoke.spawn(
      p,
      this.v.set(dir.x * (silenced ? 0.25 : 0.6), silenced ? 0.16 : 0.4, dir.z * (silenced ? 0.25 : 0.6)),
      silenced ? 0.28 : 0.6,
      silenced ? 0.07 : 0.12,
      0.8, 0.8, 0.8,
      silenced ? 0.1 : 0.25,
      -0.3, 1, 3
    );
  }

  explosion(p: THREE.Vector3, big = true) {
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('fire', [[0, 'rgba(255,250,220,1)'], [0.3, 'rgba(255,170,60,0.9)'], [0.7, 'rgba(200,60,10,0.4)'], [1, 'rgba(0,0,0,0)']], 128), blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.position.copy(p).add(this.v.set(0, 0.5, 0));
    fire.scale.setScalar(1);
    this.scene.add(fire);
    const S = big ? 14 : 6;
    this.flashes.push({ sprite: fire, t: big ? 0.6 : 0.35, max: big ? 0.6 : 0.35, grow: S });
    this.light(p.clone().add(this.v.set(0, 1.5, 0)), big ? 400 : 120, 0xffa040, big ? 45 : 20);
    const rnd = () => (Math.random() - 0.5);
    for (let i = 0; i < (big ? 120 : 50); i++) {
      this.v.set(rnd() * 22, Math.random() * 16, rnd() * 22).multiplyScalar(big ? 1 : 0.6);
      this.add.spawn(p, this.v, 0.4 + Math.random() * 0.9, 0.08 + Math.random() * 0.1, 1, 0.6 + Math.random() * 0.3, 0.2, 1, 12, 1.5);
    }
    for (let i = 0; i < (big ? 70 : 26); i++) {
      this.v.set(rnd() * 6, 1 + Math.random() * 4, rnd() * 6);
      const c = 0.2 + Math.random() * 0.2;
      this.smoke.spawn(p.clone().add(new THREE.Vector3(rnd() * 2, Math.random() * 2, rnd() * 2)), this.v, 2.5 + Math.random() * 3, big ? 2.5 : 1.4, c, c * 0.95, c * 0.9, 0.75, -0.5, 0.8, 2.5);
    }
    for (let i = 0; i < 40; i++) {
      this.v.set(rnd() * 10, Math.random() * 8, rnd() * 10);
      this.norm.spawn(p, this.v, 1.2, 0.06, 0.4, 0.33, 0.25, 1, 12, 0.3);
    }
  }

  update(dt: number) {
    this.add.update(dt);
    this.norm.update(dt);
    this.smoke.update(dt);
    for (let i = 0; i < this.lights.length; i++) {
      if (this.lightT[i] > 0) {
        this.lightT[i] = Math.max(0, this.lightT[i] - dt * 14);
        this.lights[i].intensity = (this.lights[i].userData.base || 0) * this.lightT[i];
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt;
      const k = Math.max(0, f.t / f.max);
      (f.sprite.material as THREE.SpriteMaterial).opacity = k;
      if (f.grow) f.sprite.scale.setScalar(1 + f.grow * (1 - k * k));
      if (f.t <= 0) { this.scene.remove(f.sprite); f.sprite.material.dispose(); this.flashes.splice(i, 1); }
    }
    const pos = this.tracerGeo.attributes.position as THREE.BufferAttribute;
    const col = this.tracerGeo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < 48; i++) {
      const tr = this.tracers[i];
      if (tr) {
        tr.t -= dt;
        const k = Math.max(0, tr.t / 0.06);
        // draw a short streak moving along the path
        const s = 1 - k;
        const a = tr.a.clone().lerp(tr.b, Math.max(0, s - 0.25));
        const b = tr.a.clone().lerp(tr.b, Math.min(1, s + 0.05));
        pos.setXYZ(i * 2, a.x, a.y, a.z); pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
        col.setXYZ(i * 2, 0.3 * k, 0.25 * k, 0.1 * k); col.setXYZ(i * 2 + 1, 1 * k, 0.85 * k, 0.5 * k);
      } else { pos.setXYZ(i * 2, 0, -100, 0); pos.setXYZ(i * 2 + 1, 0, -100, 0); }
    }
    this.tracers = this.tracers.filter((t) => t.t > 0);
    pos.needsUpdate = true; col.needsUpdate = true;
  }
}
