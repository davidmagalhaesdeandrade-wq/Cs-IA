export type Rarity = 'consumer' | 'industrial' | 'milspec' | 'restricted' | 'classified' | 'covert' | 'gold';
export type Pattern = 'default' | 'redline' | 'gold' | 'camo' | 'bluesteel' | 'phantom' | 'dragon' | 'fade' | 'tiger' | 'neon' | 'carbon';

export interface SkinDef {
  id: string;
  weapon: string;
  name: string;
  rarity: Rarity;
  pattern: Pattern;
  collection: string;
  desc: string;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  consumer: '#b0c3d9', industrial: '#5e98d9', milspec: '#4b69ff', restricted: '#8847ff',
  classified: '#d32ce6', covert: '#eb4b4b', gold: '#e4ae39'
};
export const RARITY_LABEL: Record<Rarity, string> = {
  consumer: 'Nível Consumidor', industrial: 'Nível Industrial', milspec: 'Nível Militar', restricted: 'Restrito',
  classified: 'Secreto', covert: 'Oculto', gold: 'Extraordinário'
};

const S = (weapon: string, pattern: Pattern, name: string, rarity: Rarity, collection: string, desc: string): SkinDef =>
  ({ id: `${weapon}_${pattern}`, weapon, pattern, name, rarity, collection, desc });

export const SKINS: SkinDef[] = [
  S('ak47', 'default', 'Default', 'consumer', 'Coleção Original', 'Acabamento clássico: aço oxidado e madeira de nogueira envernizada.'),
  S('ak47', 'redline', 'Redline Inspired', 'classified', 'Coleção Phoenix AI', 'Polímero preto fosco com faixas vermelhas pintadas à mão sobre a coronha e o guarda-mão.'),
  S('ak47', 'gold', 'Gold Edition', 'covert', 'Coleção Prestige AI', 'Receptor banhado a ouro polido com madeira ébano e detalhes escuros.'),
  S('ak47', 'neon', 'Neon Circuit', 'restricted', 'Coleção Synthwave AI', 'Circuitos neon ciano e magenta gravados sobre base grafite.'),
  S('m4a4', 'default', 'Default', 'consumer', 'Coleção Original', 'Anodizado preto padrão militar.'),
  S('m4a4', 'camo', 'Urban Camo', 'industrial', 'Coleção Metro AI', 'Camuflagem urbana em tons de cinza, branco e grafite.'),
  S('m4a4', 'bluesteel', 'Blue Steel', 'restricted', 'Coleção Forge AI', 'Aço temperado com reflexos azul-violeta.'),
  S('m4a1s', 'default', 'Default', 'consumer', 'Coleção Original', 'Anodizado preto com silenciador fosco.'),
  S('m4a1s', 'neon', 'Neon Circuit', 'classified', 'Coleção Synthwave AI', 'Linhas neon pulsantes sobre carbono.'),
  S('awp', 'default', 'Default', 'consumer', 'Coleção Original', 'Chassi verde-oliva de polímero e aço.'),
  S('awp', 'phantom', 'White Phantom', 'classified', 'Coleção Spectre AI', 'Branco perolado com grafismos geométricos em tinta grafite.'),
  S('awp', 'dragon', 'Dragon Inspired', 'covert', 'Coleção Lenda AI', 'Escamas e chamas de dragão em laranja e vermelho sobre fundo verde-petróleo — arte original.'),
  S('glock', 'default', 'Default', 'consumer', 'Coleção Original', 'Polímero preto padrão.'),
  S('glock', 'fade', 'Gradient Fade', 'restricted', 'Coleção Prisma AI', 'Degradê anodizado rosa, violeta e dourado.'),
  S('usps', 'default', 'Default', 'consumer', 'Coleção Original', 'Ferrolho preto e silenciador fosco.'),
  S('usps', 'carbon', 'Carbon Ops', 'milspec', 'Coleção Metro AI', 'Trama de fibra de carbono hidrográfica.'),
  S('deagle', 'default', 'Default', 'consumer', 'Coleção Original', 'Aço inox escovado.'),
  S('deagle', 'gold', 'Golden Eagle', 'covert', 'Coleção Prestige AI', 'Ouro polido com empunhadura escura.'),
  S('deagle', 'redline', 'Crimson Line', 'restricted', 'Coleção Phoenix AI', 'Preto fosco com faixas vermelhas.'),
  S('knife', 'default', 'Default', 'consumer', 'Coleção Original', 'Lâmina de aço com cabo emborrachado.'),
  S('knife', 'fade', 'Fade', 'covert', 'Coleção Prisma AI', 'Degradê anodizado de rosa a dourado.'),
  S('knife', 'tiger', 'Tiger Stripe', 'covert', 'Coleção Selva AI', 'Listras pretas sobre laranja queimado.'),
  S('knife', 'bluesteel', 'Blue Steel', 'covert', 'Coleção Forge AI', 'Aço temperado azul-violeta.')
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id);
export const skinsFor = (weapon: string) => SKINS.filter((s) => s.weapon === weapon);

const KEY = 'ts2_equipped_skins_v1';

class SkinManager {
  equipped: Record<string, string> = {};
  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.equipped = JSON.parse(raw);
    } catch { /* */ }
  }
  get(weapon: string): string {
    const id = this.equipped[weapon];
    if (id && skinById(id)) return id;
    return `${weapon}_default`;
  }
  pattern(weapon: string): Pattern {
    const s = skinById(this.get(weapon));
    return s ? s.pattern : 'default';
  }
  equip(skinId: string) {
    const s = skinById(skinId);
    if (!s) return;
    this.equipped[s.weapon] = s.id;
    try { localStorage.setItem(KEY, JSON.stringify(this.equipped)); } catch { /* */ }
  }
}
export const skinManager = new SkinManager();
