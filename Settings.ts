export type Quality = 'low' | 'medium' | 'high';

export interface SettingsData {
  renderScale: number;
  quality: Quality;
  shadows: boolean;
  fov: number;
  sensitivity: number;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  crosshairColor: string;
  crosshairSize: number;
  crosshairGap: number;
  crosshairThickness: number;
  crosshairDot: boolean;
  crosshairDynamic: boolean;
  crouchToggle: boolean;
  showFps: boolean;
  playerName: string;
}

export const DEFAULT_SETTINGS: SettingsData = {
  renderScale: 1,
  quality: 'high',
  shadows: true,
  fov: 90,
  sensitivity: 2.0,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.45,
  crosshairColor: '#4dff6a',
  crosshairSize: 7,
  crosshairGap: 4,
  crosshairThickness: 2,
  crosshairDot: false,
  crosshairDynamic: true,
  crouchToggle: false,
  showFps: true,
  playerName: 'Player'
};

const KEY = 'ts2_settings_v1';

class SettingsManager {
  data: SettingsData = { ...DEFAULT_SETTINGS };
  private listeners: ((d: SettingsData) => void)[] = [];

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* storage unavailable */ }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* ignore */ }
  }
  apply(partial: Partial<SettingsData>) {
    this.data = { ...this.data, ...partial };
    this.save();
    this.listeners.forEach((l) => l(this.data));
  }
  onChange(fn: (d: SettingsData) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
}

export const settings = new SettingsManager();
settings.load();
