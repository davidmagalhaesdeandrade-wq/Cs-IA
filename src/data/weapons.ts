import type { ShotKind } from '../core/Audio';

export type Slot = 'primary' | 'secondary' | 'knife' | 'grenade' | 'c4';
export type Category = 'rifle' | 'smg' | 'sniper' | 'pistol' | 'heavy' | 'knife' | 'grenade' | 'c4';
export type TeamRestrict = 'T' | 'CT' | 'both';

export interface WeaponDef {
  id: string;
  name: string;
  slot: Slot;
  category: Category;
  price: number;
  team: TeamRestrict;
  damage: number;
  armorPen: number; // fraction of damage that goes through armor
  rpm: number;
  auto: boolean;
  mag: number;
  reserve: number;
  reloadTime: number;
  speed: number; // m/s max run speed holding it
  spread: number; // base inaccuracy standing (rad)
  moveSpread: number; // added at full run speed
  airSpread: number;
  fireSpread: number; // added per shot (decays)
  recoilUp: number; // rad per shot
  recoilSide: number;
  falloff: number; // damage multiplier per 10 m
  killReward: number;
  sound: ShotKind | 'knife' | 'none';
  equipTime: number;
  scope?: number[]; // fov levels
  pellets?: number;
  silenced?: boolean;
  range?: number;
  tracer?: boolean;
}

const W = (d: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'slot' | 'category'>): WeaponDef => ({
  price: 0, team: 'both', damage: 30, armorPen: 0.7, rpm: 600, auto: true, mag: 30, reserve: 90, reloadTime: 2.5,
  speed: 5.5, spread: 0.004, moveSpread: 0.08, airSpread: 0.25, fireSpread: 0.01, recoilUp: 0.018, recoilSide: 0.01,
  falloff: 0.97, killReward: 300, sound: 'rifle', equipTime: 0.9, tracer: true, ...d
});

export const WEAPONS: Record<string, WeaponDef> = {
  // ---------- rifles ----------
  ak47: W({ id: 'ak47', name: 'AK-47', slot: 'primary', category: 'rifle', price: 2700, team: 'T', damage: 36, armorPen: 0.775, rpm: 600, mag: 30, reserve: 90, reloadTime: 2.45, speed: 5.45, spread: 0.0045, moveSpread: 0.11, fireSpread: 0.011, recoilUp: 0.024, recoilSide: 0.014, falloff: 0.98, sound: 'rifle' }),
  m4a4: W({ id: 'm4a4', name: 'M4A4', slot: 'primary', category: 'rifle', price: 3000, team: 'CT', damage: 33, armorPen: 0.7, rpm: 666, mag: 30, reserve: 90, reloadTime: 3.0, speed: 5.6, spread: 0.0038, moveSpread: 0.095, fireSpread: 0.009, recoilUp: 0.019, recoilSide: 0.011, sound: 'rifle2' }),
  m4a1s: W({ id: 'm4a1s', name: 'M4A1-S', slot: 'primary', category: 'rifle', price: 2900, team: 'CT', damage: 38, armorPen: 0.7, rpm: 600, mag: 20, reserve: 80, reloadTime: 3.0, speed: 5.6, spread: 0.0032, moveSpread: 0.09, fireSpread: 0.008, recoilUp: 0.016, recoilSide: 0.008, sound: 'silenced', silenced: true, tracer: false }),
  galil: W({ id: 'galil', name: 'Galil AR', slot: 'primary', category: 'rifle', price: 1800, team: 'T', damage: 30, armorPen: 0.775, rpm: 666, mag: 35, reserve: 90, reloadTime: 2.9, speed: 5.5, spread: 0.006, moveSpread: 0.11, fireSpread: 0.011, recoilUp: 0.019, recoilSide: 0.013, sound: 'rifle2' }),
  famas: W({ id: 'famas', name: 'FAMAS', slot: 'primary', category: 'rifle', price: 2050, team: 'CT', damage: 30, armorPen: 0.7, rpm: 666, mag: 25, reserve: 90, reloadTime: 3.3, speed: 5.55, spread: 0.0055, moveSpread: 0.1, fireSpread: 0.010, recoilUp: 0.018, recoilSide: 0.011, sound: 'rifle2' }),
  // ---------- snipers ----------
  awp: W({ id: 'awp', name: 'AWP', slot: 'primary', category: 'sniper', price: 4750, damage: 115, armorPen: 0.975, rpm: 41, auto: false, mag: 5, reserve: 30, reloadTime: 3.6, speed: 4.6, spread: 0.0012, moveSpread: 0.22, airSpread: 0.4, fireSpread: 0.06, recoilUp: 0.07, recoilSide: 0.01, falloff: 0.995, killReward: 100, sound: 'sniper', scope: [40, 15], equipTime: 1.15 }),
  ssg08: W({ id: 'ssg08', name: 'SSG 08', slot: 'primary', category: 'sniper', price: 1700, damage: 88, armorPen: 0.85, rpm: 48, auto: false, mag: 10, reserve: 90, reloadTime: 3.4, speed: 5.9, spread: 0.0015, moveSpread: 0.14, airSpread: 0.02, fireSpread: 0.04, recoilUp: 0.05, recoilSide: 0.008, falloff: 0.99, sound: 'sniper', scope: [40, 15] }),
  // ---------- smgs / heavy ----------
  mac10: W({ id: 'mac10', name: 'MAC-10', slot: 'primary', category: 'smg', price: 1050, team: 'T', damage: 29, armorPen: 0.575, rpm: 800, mag: 30, reserve: 100, reloadTime: 2.6, speed: 6.1, spread: 0.009, moveSpread: 0.04, fireSpread: 0.012, recoilUp: 0.014, recoilSide: 0.012, falloff: 0.9, killReward: 600, sound: 'smg' }),
  mp9: W({ id: 'mp9', name: 'MP9', slot: 'primary', category: 'smg', price: 1250, team: 'CT', damage: 26, armorPen: 0.6, rpm: 857, mag: 30, reserve: 120, reloadTime: 2.1, speed: 6.1, spread: 0.008, moveSpread: 0.04, fireSpread: 0.011, recoilUp: 0.013, recoilSide: 0.011, falloff: 0.9, killReward: 600, sound: 'smg' }),
  p90: W({ id: 'p90', name: 'P90', slot: 'primary', category: 'smg', price: 2350, damage: 26, armorPen: 0.69, rpm: 857, mag: 50, reserve: 100, reloadTime: 3.3, speed: 5.9, spread: 0.008, moveSpread: 0.05, fireSpread: 0.009, recoilUp: 0.011, recoilSide: 0.01, falloff: 0.92, killReward: 300, sound: 'smg' }),
  nova: W({ id: 'nova', name: 'Nova', slot: 'primary', category: 'heavy', price: 1050, damage: 26, armorPen: 0.5, rpm: 68, auto: false, mag: 8, reserve: 32, reloadTime: 3.2, speed: 5.5, spread: 0.045, moveSpread: 0.04, fireSpread: 0.02, recoilUp: 0.06, recoilSide: 0.01, falloff: 0.7, killReward: 900, sound: 'shotgun', pellets: 9, range: 40 }),
  // ---------- pistols ----------
  glock: W({ id: 'glock', name: 'Glock-18', slot: 'secondary', category: 'pistol', price: 200, team: 'T', damage: 28, armorPen: 0.47, rpm: 400, auto: false, mag: 20, reserve: 120, reloadTime: 2.2, speed: 6.0, spread: 0.007, moveSpread: 0.05, fireSpread: 0.02, recoilUp: 0.018, recoilSide: 0.006, falloff: 0.88, sound: 'pistol', equipTime: 0.6 }),
  usps: W({ id: 'usps', name: 'USP-S', slot: 'secondary', category: 'pistol', price: 200, team: 'CT', damage: 35, armorPen: 0.505, rpm: 352, auto: false, mag: 12, reserve: 24, reloadTime: 2.2, speed: 6.0, spread: 0.0045, moveSpread: 0.05, fireSpread: 0.02, recoilUp: 0.02, recoilSide: 0.005, falloff: 0.92, sound: 'silencedPistol', silenced: true, equipTime: 0.6, tracer: false }),
  deagle: W({ id: 'deagle', name: 'Desert Eagle', slot: 'secondary', category: 'pistol', price: 700, damage: 53, armorPen: 0.93, rpm: 267, auto: false, mag: 7, reserve: 35, reloadTime: 2.2, speed: 5.9, spread: 0.006, moveSpread: 0.13, fireSpread: 0.05, recoilUp: 0.07, recoilSide: 0.012, falloff: 0.92, sound: 'deagle', equipTime: 0.7 }),
  // ---------- melee ----------
  knife: W({ id: 'knife', name: 'Faca', slot: 'knife', category: 'knife', damage: 40, armorPen: 0.85, rpm: 150, auto: true, mag: 0, reserve: 0, reloadTime: 0, speed: 6.3, killReward: 1500, sound: 'knife', equipTime: 0.5, range: 2.0, tracer: false }),
  // ---------- grenades ----------
  he: W({ id: 'he', name: 'Granada HE', slot: 'grenade', category: 'grenade', price: 300, damage: 98, armorPen: 0.57, rpm: 60, auto: false, mag: 1, reserve: 0, speed: 6.1, sound: 'none', equipTime: 0.5, tracer: false }),
  flash: W({ id: 'flash', name: 'Flashbang', slot: 'grenade', category: 'grenade', price: 200, damage: 0, rpm: 60, auto: false, mag: 1, reserve: 0, speed: 6.1, sound: 'none', equipTime: 0.5, tracer: false }),
  smoke: W({ id: 'smoke', name: 'Granada de Fumaça', slot: 'grenade', category: 'grenade', price: 300, damage: 0, rpm: 60, auto: false, mag: 1, reserve: 0, speed: 6.1, sound: 'none', equipTime: 0.5, tracer: false }),
  // ---------- bomb ----------
  c4: W({ id: 'c4', name: 'Explosivo C4', slot: 'c4', category: 'c4', damage: 0, mag: 1, reserve: 0, speed: 6.0, sound: 'none', equipTime: 0.6, auto: false, tracer: false })
};

export interface EquipDef { id: string; name: string; price: number; team: TeamRestrict; icon: string }
export const EQUIPMENT: EquipDef[] = [
  { id: 'kevlar', name: 'Colete', price: 650, team: 'both', icon: 'vest' },
  { id: 'kevlarHelmet', name: 'Colete + Capacete', price: 1000, team: 'both', icon: 'helmet' },
  { id: 'defuser', name: 'Kit de Desarme', price: 400, team: 'CT', icon: 'kit' }
];

export interface BuyColumn { title: string; items: string[] }
export const BUY_LAYOUT: BuyColumn[] = [
  { title: 'Equipamentos', items: ['kevlar', 'kevlarHelmet', 'defuser'] },
  { title: 'Pistolas', items: ['glock', 'usps', 'deagle'] },
  { title: 'Intermediárias', items: ['mac10', 'mp9', 'p90', 'nova'] },
  { title: 'Rifles', items: ['galil', 'famas', 'ak47', 'm4a4', 'm4a1s', 'ssg08', 'awp'] },
  { title: 'Granadas', items: ['flash', 'smoke', 'he'] }
];

export const GRENADE_LIMITS: Record<string, number> = { he: 1, flash: 2, smoke: 1 };
export const MAX_GRENADES = 4;

export const CATEGORY_LABEL: Record<Category, string> = {
  rifle: 'Rifle', smg: 'Submetralhadora', sniper: 'Rifle de Precisão', pistol: 'Pistola', heavy: 'Escopeta',
  knife: 'Faca', grenade: 'Granada', c4: 'Explosivo'
};
