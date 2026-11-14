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
  S('knife', 'bluesteel', 'Blue Steel', 'covert', 'Coleção Forge AI', 'Aço temperado azul-violeta.'),
  S('galil', 'default', 'Default', 'consumer', 'Coleção Original', 'Acabamento preto fosco com guarda-mão em polímero texturizado.'),
  S('famas', 'default', 'Default', 'consumer', 'Coleção Original', 'Acabamento militar preto com componentes de polímero.'),
  S('ssg08', 'default', 'Default', 'consumer', 'Coleção Original', 'Coronha de polímero verde-oliva e conjunto de aço fosco.'),
  S('mac10', 'default', 'Default', 'consumer', 'Coleção Original', 'Estrutura compacta em aço escurecido e empunhadura texturizada.'),
  S('mp9', 'default', 'Default', 'consumer', 'Coleção Original', 'Polímero preto fosco com ferragens em aço.'),
  S('p90', 'default', 'Default', 'consumer', 'Coleção Original', 'Corpo de polímero preto com detalhes industriais.'),
  S('nova', 'default', 'Default', 'consumer', 'Coleção Original', 'Madeira escura e cano de aço escovado.'),
  S('galil', 'dragon', 'Inferno Scale', 'covert', 'Coleção Lenda AI', 'Escamas incandescentes em relevo sobre polímero verde-petróleo.'),
  S('galil', 'carbon', 'Carbon Vector', 'restricted', 'Coleção Metro AI', 'Fibra de carbono cruzada com marcações técnicas em aço.'),
  S('famas', 'phantom', 'Arctic Phantom', 'classified', 'Coleção Spectre AI', 'Base branca acetinada com grafismos geométricos escuros.'),
  S('famas', 'neon', 'Pulse Grid', 'restricted', 'Coleção Synthwave AI', 'Circuitos luminosos ciano e magenta sobre grafite.'),
  S('ssg08', 'fade', 'Aurora Fade', 'classified', 'Coleção Prisma AI', 'Degradê iridescente aplicado ao corpo e à coronha.'),
  S('ssg08', 'bluesteel', 'Tempered Storm', 'restricted', 'Coleção Forge AI', 'Aço azulado com reflexos violeta e marcas de têmpera.'),
  S('mac10', 'tiger', 'Predator', 'restricted', 'Coleção Selva AI', 'Listras de tigre em laranja queimado e preto profundo.'),
  S('mac10', 'carbon', 'Carbon Rush', 'milspec', 'Coleção Metro AI', 'Trama de carbono com detalhes industriais.'),
  S('mp9', 'neon', 'Neon Vector', 'classified', 'Coleção Synthwave AI', 'Linhas elétricas em ciano e magenta sobre preto fosco.'),
  S('mp9', 'bluesteel', 'Blue Temper', 'restricted', 'Coleção Forge AI', 'Metal azulado com acabamento escovado.'),
  S('p90', 'phantom', 'Arctic Web', 'classified', 'Coleção Spectre AI', 'Grafismos angulares em branco, grafite e ciano.'),
  S('p90', 'dragon', 'Dragon Pulse', 'covert', 'Coleção Lenda AI', 'Escamas flamejantes com textura de alto contraste.'),
  S('nova', 'camo', 'Urban Breach', 'milspec', 'Coleção Metro AI', 'Camuflagem urbana irregular em cinza e carvão.'),
  S('nova', 'redline', 'Crimson Pump', 'restricted', 'Coleção Phoenix AI', 'Polímero preto com linhas vermelhas de alta visibilidade.')
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
