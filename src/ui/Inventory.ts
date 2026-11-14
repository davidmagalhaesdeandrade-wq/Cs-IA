import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SKINS, SkinDef, RARITY_COLOR, RARITY_LABEL, skinManager } from '../data/skins';
import { WEAPONS, CATEGORY_LABEL } from '../data/weapons';
import { skinThumb } from '../render/thumbnails';
import { buildWeapon } from '../render/weaponModels';
import { el } from '../core/util';
import { audio } from '../core/Audio';

const FILTERS: [string, string, (s: SkinDef) => boolean][] = [
  ['all', 'TODOS', () => true],
  ['rifle', 'RIFLES', (s) => WEAPONS[s.weapon].category === 'rifle'],
  ['pistol', 'PISTOLAS', (s) => WEAPONS[s.weapon].category === 'pistol'],
  ['sniper', 'SNIPERS', (s) => WEAPONS[s.weapon].category === 'sniper'],
  ['smg', 'SMGS', (s) => WEAPONS[s.weapon].category === 'smg'],
  ['heavy', 'ESCOPETAS', (s) => WEAPONS[s.weapon].category === 'heavy'],
  ['knife', 'FACAS', (s) => WEAPONS[s.weapon].category === 'knife']
];

export class InventoryScreen {
  root: HTMLDivElement;
  filter = 'all';
  viewer: ItemViewer | null = null;
  constructor(parent: HTMLElement, private onClose: () => void, private onEquip: () => void) {
    this.root = el('div', 'screen inventory');
    parent.appendChild(this.root);
    this.render();
    requestAnimationFrame(() => this.root.classList.add('show'));
  }

  render() {
    const f = FILTERS.find((x) => x[0] === this.filter)!;
    const items = SKINS.filter(f[2]);
    const cards = items.map((s) => {
      const eq = skinManager.get(s.weapon) === s.id;
      const w = WEAPONS[s.weapon];
      return `<div class="inv-card ${eq ? 'equipped' : ''}" style="--rc:${RARITY_COLOR[s.rarity]}" data-id="${s.id}">
        <div class="inv-img"><img src="${skinThumb(s.weapon, s.pattern)}" loading="lazy"></div>
        ${eq ? '<div class="inv-eq">EQUIPADO</div>' : ''}
        <div class="inv-info"><div class="inv-w">${w.name}</div><div class="inv-s">${s.name}</div><div class="inv-cat">${CATEGORY_LABEL[w.category]} · <span style="color:${RARITY_COLOR[s.rarity]}">${RARITY_LABEL[s.rarity]}</span></div></div>
        <div class="inv-actions"><button data-act="equip" ${eq ? 'disabled' : ''}>${eq ? 'EQUIPADO' : 'EQUIPAR'}</button><button data-act="inspect">INSPECIONAR</button></div>
        <div class="inv-rarity"></div>
      </div>`;
    }).join('');
    this.root.innerHTML = `
      <div class="screen-head"><h1>INVENTÁRIO</h1>
        <div class="inv-tabs">${FILTERS.map(([id, l]) => `<button data-f="${id}" class="${id === this.filter ? 'active' : ''}">${l}</button>`).join('')}</div>
        <span class="inv-count">${items.length} itens</span>
        <button class="close" data-act="back">✕ VOLTAR</button></div>
      <div class="inv-grid">${cards}</div>
      <div class="toast" data-k="toast"></div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-f]').forEach((b) => (b.onclick = () => { audio.ui('click'); this.filter = b.dataset.f!; this.render(); }));
    (this.root.querySelector('[data-act=back]') as HTMLButtonElement).onclick = () => { audio.ui('back'); this.onClose(); };
    this.root.querySelectorAll<HTMLDivElement>('.inv-card').forEach((c) => {
      c.onmouseenter = () => audio.ui('hover');
      const id = c.dataset.id!;
      (c.querySelector('[data-act=equip]') as HTMLButtonElement).onclick = (e) => { e.stopPropagation(); this.equip(id); };
      (c.querySelector('[data-act=inspect]') as HTMLButtonElement).onclick = (e) => { e.stopPropagation(); this.inspect(id); };
      c.ondblclick = () => this.inspect(id);
    });
  }

  equip(id: string) {
    const s = SKINS.find((x) => x.id === id)!;
    if (!s || !skinManager.equip(id)) return;
    audio.ui('equip');
    this.render();
    this.toast(`✔ ${WEAPONS[s.weapon].name} | ${s.name} equipada`);
    this.onEquip();
  }

  toast(t: string) {
    const e = this.root.querySelector('[data-k=toast]') as HTMLElement;
    e.textContent = t;
    e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 2200);
  }

  inspect(id: string) {
    audio.ui('click');
    this.viewer = new ItemViewer(this.root, id, () => { this.viewer = null; }, (sid) => this.equip(sid));
  }

  update(dt: number) { this.viewer?.update(dt); }
  destroy() { this.viewer?.destroy(); this.root.remove(); }
}

/** CS2-style item inspect: dedicated renderer, auto-rotate, drag to rotate, wheel zoom */
export class ItemViewer {
  root: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  model: THREE.Group;
  pivot = new THREE.Group();
  rotY = 0.6; rotX = 0.1; dist = 1.9; targetDist = 1.9;
  auto = true;
  dragging = false;
  lastX = 0; lastY = 0;
  private onResize = () => this.resize();

  constructor(parent: HTMLElement, skinId: string, private onClose: () => void, onEquip: (id: string) => void) {
    const s = SKINS.find((x) => x.id === skinId)!;
    const w = WEAPONS[s.weapon];
    this.root = el('div', 'viewer');
    this.root.innerHTML = `
      <canvas></canvas>
      <div class="viewer-head" style="--rc:${RARITY_COLOR[s.rarity]}">
        <div class="vh-badge">◆</div>
        <div><div class="vh-name">${w.name} <span>|</span> ${s.name}</div><div class="vh-col">${s.collection} · <span style="color:${RARITY_COLOR[s.rarity]}">${RARITY_LABEL[s.rarity]}</span></div></div>
      </div>
      <div class="viewer-desc">${s.desc}</div>
      <div class="viewer-bar">
        <button data-a="auto" class="active" title="Rotação automática">⟳</button>
        <button data-a="side" title="Vista lateral">◧</button>
        <button data-a="top" title="Vista superior">⬒</button>
        <button data-a="front" title="Vista frontal">◉</button>
        <button data-a="equip" class="primary">${skinManager.get(s.weapon) === s.id ? 'EQUIPADO' : 'EQUIPAR'}</button>
        <button data-a="close">FECHAR</button>
      </div>
      <div class="viewer-tip">Arraste para girar · Roda do mouse para zoom</div>`;
    parent.appendChild(this.root);
    const canvas = this.root.querySelector('canvas')!;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x0d1624);
    this.scene.fog = new THREE.Fog(0x0d1624, 3, 12);
    // warehouse backdrop: shelves of crates
    const shelfM = new THREE.MeshStandardMaterial({ color: 0x1f2c3c, roughness: 0.8 });
    const boxM = new THREE.MeshStandardMaterial({ color: 0x2b3a4c, roughness: 0.7 });
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), j % 2 ? boxM : shelfM);
      b.position.set(side * 2.6, j * 0.75 - 0.6, -i * 1.2 - 1);
      this.scene.add(b);
    }
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.08), new THREE.MeshBasicMaterial({ color: 0xdfeaff }));
      l.position.set(0, 2.2, -i * 1.6 - 1.5);
      this.scene.add(l);
    }
    this.scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x101820, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2, 3, 2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fb0ff, 2);
    rim.position.set(-2, 1, -3);
    this.scene.add(rim);
    this.model = buildWeapon(s.weapon, s.pattern);
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3());
    this.model.position.sub(c);
    const size = box.getSize(new THREE.Vector3()).length();
    this.targetDist = this.dist = size * 1.9 + 0.2;
    this.pivot.add(this.model);
    this.scene.add(this.pivot);
    this.resize();
    window.addEventListener('resize', this.onResize);
    canvas.addEventListener('mousedown', (e) => { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; this.setAuto(false); });
    window.addEventListener('mouseup', this.up);
    window.addEventListener('mousemove', this.move);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.targetDist = THREE.MathUtils.clamp(this.targetDist * (1 + Math.sign(e.deltaY) * 0.1), size * 0.6, size * 3.5); }, { passive: false });
    this.root.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => {
      b.onmouseenter = () => audio.ui('hover');
      b.onclick = () => {
        const a = b.dataset.a;
        audio.ui('click');
        if (a === 'close') this.destroy();
        else if (a === 'auto') this.setAuto(!this.auto);
        else if (a === 'side') { this.setAuto(false); this.rotY = Math.PI / 2; this.rotX = 0; }
        else if (a === 'top') { this.setAuto(false); this.rotY = Math.PI / 2; this.rotX = 1.2; }
        else if (a === 'front') { this.setAuto(false); this.rotY = 0.15; this.rotX = 0.05; }
        else if (a === 'equip') { onEquip(s.id); b.textContent = 'EQUIPADO'; }
      };
    });
    requestAnimationFrame(() => this.root.classList.add('show'));
  }
  private up = () => { this.dragging = false; };
  private move = (e: MouseEvent) => {
    if (!this.dragging) return;
    this.rotY += (e.clientX - this.lastX) * 0.01;
    this.rotX = THREE.MathUtils.clamp(this.rotX + (e.clientY - this.lastY) * 0.008, -1.3, 1.3);
    this.lastX = e.clientX; this.lastY = e.clientY;
  };
  setAuto(v: boolean) {
    this.auto = v;
    this.root.querySelector('[data-a=auto]')?.classList.toggle('active', v);
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  update(dt: number) {
    if (this.auto) this.rotY += dt * 0.45;
    this.dist += (this.targetDist - this.dist) * Math.min(1, dt * 8);
    this.pivot.rotation.set(this.rotX, this.rotY, 0);
    this.model.position.y = Math.sin(performance.now() / 900) * 0.01;
    this.camera.position.set(0.05, 0.05, this.dist);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
  destroy() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mouseup', this.up);
    window.removeEventListener('mousemove', this.move);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.root.remove();
    this.onClose();
  }
}
