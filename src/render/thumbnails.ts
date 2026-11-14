import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWeapon } from './weaponModels';
import type { Pattern } from '../data/skins';

let renderer: THREE.WebGLRenderer | null = null;
let env: THREE.Texture | null = null;
const cache = new Map<string, string>();

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    const pm = new THREE.PMREMGenerator(renderer);
    env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  return renderer;
}

/** shared PMREM environment for reflective weapon materials */
export function sharedEnv(main: THREE.WebGLRenderer): THREE.Texture {
  const pm = new THREE.PMREMGenerator(main);
  return pm.fromScene(new RoomEnvironment(), 0.04).texture;
}

function fitCamera(obj: THREE.Object3D, w: number, h: number, margin = 1.12) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const aspect = w / h;
  // side view from +X: screen horizontal = z, vertical = y
  let halfW = (size.z / 2) * margin, halfH = (size.y / 2) * margin;
  if (halfW / halfH > aspect) halfH = halfW / aspect; else halfW = halfH * aspect;
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 10);
  cam.position.set(center.x + 3, center.y, center.z);
  cam.lookAt(center);
  return cam;
}

/** white silhouette icon like CS buy-menu icons */
export function weaponIcon(id: string, w = 256, h = 96): string {
  const key = `icon:${id}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key)!;
  const r = getRenderer();
  r.setSize(w, h, false);
  const scene = new THREE.Scene();
  const g = buildWeapon(id, 'default');
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = white; });
  scene.add(g);
  const cam = fitCamera(g, w, h, 1.08);
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** lit render of a weapon with a skin */
export function skinThumb(id: string, pattern: Pattern, w = 360, h = 200): string {
  const key = `skin:${id}:${pattern}:${w}x${h}`;
  if (cache.has(key)) return cache.get(key)!;
  const r = getRenderer();
  r.setSize(w, h, false);
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.5);
  d.position.set(3, 4, 2);
  scene.add(d);
  const g = buildWeapon(id, pattern);
  g.rotation.y = 0.12;
  g.rotation.z = -0.04;
  scene.add(g);
  const cam = fitCamera(g, w, h, 1.15);
  r.setClearColor(0x000000, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
