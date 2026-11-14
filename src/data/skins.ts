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
  S('knife', 'fade', 'Karambit Fade', 'covert', 'Coleção Prisma AI', 'Modelo Karambit com lâmina curva e anel de dedo, em degradê anodizado de rosa a dourado.'),
  S('knife', 'tiger', 'Butterfly Tiger Stripe', 'covert', 'Coleção Selva AI', 'Modelo Butterfly com duas talas articuladas e inspeção de abertura, em listras pretas sobre laranja queimado.'),
  S('knife', 'bluesteel', 'Stiletto Blue Steel', 'covert', 'Coleção Forge AI', 'Modelo Stiletto com lâmina longa e estreita, em aço temperado azul-violeta.'),
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
  S('nova', 'redline', 'Crimson Pump', 'restricted', 'Coleção Phoenix AI', 'Polímero preto com linhas vermelhas de alta visibilidade.'),
  S('ak47', 'camo', 'Forest Grid', 'milspec', 'Coleção Frontier AI', 'Camuflagem de polímero em manchas verde-musgo, areia e carvão.'),
  S('ak47', 'dragon', 'Ember Wyrm', 'covert', 'Coleção Lenda AI', 'Escamas incandescentes e acabamento verde-petróleo com detalhes em cobre.'),
  S('m4a4', 'fade', 'Prism Shift', 'classified', 'Coleção Prisma AI', 'Degradê iridescente de ouro, magenta, violeta e azul.'),
  S('m4a4', 'dragon', 'Ashen Dragon', 'covert', 'Coleção Lenda AI', 'Escamas em tons de brasa com placas metálicas grafite.'),
  S('m4a1s', 'phantom', 'Silent Frost', 'classified', 'Coleção Spectre AI', 'Grafismos geométricos claros sobre acabamento branco acetinado.'),
  S('m4a1s', 'carbon', 'Carbon Silence', 'restricted', 'Coleção Metro AI', 'Fibra de carbono cruzada com ferragens pretas acetinadas.'),
  S('galil', 'fade', 'Dune Spectrum', 'restricted', 'Coleção Prisma AI', 'Transição dourada e violeta inspirada em metal anodizado.'),
  S('galil', 'tiger', 'Sand Predator', 'classified', 'Coleção Selva AI', 'Listras escuras de alto contraste sobre base areia.'),
  S('famas', 'camo', 'Urban Phantom', 'milspec', 'Coleção Metro AI', 'Camuflagem urbana em grafite, cinza-claro e aço.'),
  S('famas', 'dragon', 'Molten Scale', 'covert', 'Coleção Lenda AI', 'Escamas vermelhas e cobre com placas de polímero escuro.'),
  S('awp', 'fade', 'Solar Fade', 'covert', 'Coleção Prisma AI', 'Degradê metálico do dourado ao violeta e azul.'),
  S('awp', 'carbon', 'Longshot Carbon', 'restricted', 'Coleção Metro AI', 'Trama de carbono com detalhes técnicos em aço escovado.'),
  S('ssg08', 'camo', 'Recon Camo', 'milspec', 'Coleção Frontier AI', 'Camuflagem irregular em oliva, areia e carvão.'),
  S('ssg08', 'tiger', 'Tiger Recon', 'classified', 'Coleção Selva AI', 'Listras pretas agressivas sobre acabamento âmbar.'),
  S('mac10', 'fade', 'Voltage Fade', 'restricted', 'Coleção Prisma AI', 'Degradê rosa-violeta-azul em acabamento compacto.'),
  S('mac10', 'phantom', 'Ghostline', 'classified', 'Coleção Spectre AI', 'Base clara com traços geométricos grafite e ciano.'),
  S('mp9', 'fade', 'Neon Aurora', 'classified', 'Coleção Prisma AI', 'Gradiente iridescente com reflexos azulados.'),
  S('mp9', 'dragon', 'Dragon Circuit', 'covert', 'Coleção Lenda AI', 'Escamas flamejantes sobre placas pretas de polímero.'),
  S('p90', 'redline', 'Red Sector', 'restricted', 'Coleção Phoenix AI', 'Linhas vermelhas de alta visibilidade sobre corpo grafite.'),
  S('p90', 'carbon', 'Carbon Pulse', 'milspec', 'Coleção Metro AI', 'Trama de carbono com marcações industriais.'),
  S('nova', 'fade', 'Amber Tide', 'restricted', 'Coleção Prisma AI', 'Degradê âmbar e violeta sobre peças metálicas.'),
  S('nova', 'phantom', 'Cold Breach', 'classified', 'Coleção Spectre AI', 'Grafismos frios e angulares sobre acabamento branco.'),
  S('glock', 'neon', 'Night Runner', 'restricted', 'Coleção Synthwave AI', 'Circuitos ciano e magenta em base preta fosca.'),
  S('glock', 'tiger', 'Copper Fang', 'milspec', 'Coleção Selva AI', 'Listras escuras em cobre queimado.'),
  S('usps', 'fade', 'Quiet Spectrum', 'classified', 'Coleção Prisma AI', 'Degradê anodizado com acabamento acetinado no conjunto.'),
  S('usps', 'phantom', 'White Noise', 'restricted', 'Coleção Spectre AI', 'Padrão geométrico branco e grafite com detalhes ciano.'),
  S('deagle', 'fade', 'Royal Spectrum', 'covert', 'Coleção Prisma AI', 'Degradê metálico intenso com reflexos dourados.'),
  S('deagle', 'carbon', 'Heavy Carbon', 'restricted', 'Coleção Metro AI', 'Fibra de carbono com componentes metálicos escurecidos.'),
  S('knife', 'neon', 'Voltage Edge', 'covert', 'Coleção Synthwave AI', 'Lâmina com circuito neon e cabo preto texturizado.'),
  S('knife', 'dragon', 'Wyrm Fang', 'covert', 'Coleção Lenda AI', 'Lâmina escamada em tons de brasa e cabo escuro.'),
  S('knife', 'carbon', 'M9 Bayonet | Carbon', 'covert', 'Coleção Forge AI', 'Baioneta M9 de lâmina larga com guarda cruzada, canal de alívio e cabo texturizado em fibra de carbono.'),
];

export const skinById = (id: string) => SKINS.find((s) => s.id === id);
export const skinsFor = (weapon: string) => SKINS.filter((s) => s.weapon === weapon);

const KEY = 'ts2_equipped_skins_v1';
const OWNED_KEY = 'ts2_owned_skins_v1';
const WALLET_KEY = 'ts2_skin_credits_v1';

export const skinPrice = (skin: SkinDef): number => {
  const rarityBase: Record<Rarity, number> = {
    consumer: 0, industrial: 350, milspec: 800, restricted: 1_600,
    classified: 3_200, covert: 6_500, gold: 12_000
  };
  return skin.pattern === 'default' ? 0 : rarityBase[skin.rarity] * (skin.weapon === 'knife' ? 4 : 1);
};

class SkinManager {
  equipped: Record<string, string> = {};
  owned = new Set<string>();
  credits = 30_000;
  constructor() {
    this.owned = new Set(SKINS.filter((s) => s.pattern === 'default').map((s) => s.id));
    try {
      const owned = JSON.parse(localStorage.getItem(OWNED_KEY) || 'null');
      if (Array.isArray(owned)) for (const id of owned) if (typeof id === 'string' && skinById(id)) this.owned.add(id);
      const credits = Number(localStorage.getItem(WALLET_KEY));
      if (Number.isFinite(credits) && credits >= 0) this.credits = credits;
    } catch { /* keep a safe local default */ }
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      for (const [weapon, id] of Object.entries(parsed as Record<string, unknown>))
        if (typeof id === 'string' && skinById(id)?.weapon === weapon && this.owned.has(id)) this.equipped[weapon] = id;
    } catch { /* */ }
  }
  get(weapon: string): string {
    const id = this.equipped[weapon];
    if (id && skinById(id)?.weapon === weapon) return id;
    return `${weapon}_default`;
  }
  pattern(weapon: string): Pattern {
    const s = skinById(this.get(weapon));
    return s ? s.pattern : 'default';
  }
  equip(skinId: string): boolean {
    const s = skinById(skinId);
    if (!s || !this.owned.has(skinId)) return false;
    this.equipped[s.weapon] = s.id;
    this.persist();
    return true;
  }
  buy(skinId: string): boolean {
    const skin = skinById(skinId);
    if (!skin || skin.pattern === 'default' || this.owned.has(skinId)) return false;
    const price = skinPrice(skin);
    if (this.credits < price) return false;
    this.credits -= price;
    this.owned.add(skinId);
    this.persist();
    return true;
  }
  isOwned(skinId: string) { return this.owned.has(skinId); }
  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.equipped));
      localStorage.setItem(OWNED_KEY, JSON.stringify([...this.owned]));
      localStorage.setItem(WALLET_KEY, String(this.credits));
    } catch { /* local storage may be unavailable */ }
  }
}
export const skinManager = new SkinManager();
