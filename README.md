# Tactical Strike 2 — CS2 AI Recreation

Uma recriação simplificada de Counter-Strike 2, offline, jogável no navegador
(TypeScript + Three.js + Vite). Tudo é procedural: texturas, modelos 3D, sons (Web Audio).

## Como rodar
```
npm install
npm run dev        # abre http://127.0.0.1:5173
```
Build de produção: `npm run build` e depois `npm run preview`.

## Controles
| Tecla | Ação |
|---|---|
| WASD / Mouse | Mover / olhar |
| Botão esq. / dir. | Atirar / luneta (AWP, SSG) · facada forte · foco |
| R | Recarregar |
| Espaço / Shift / Ctrl | Pular / andar em silêncio / agachar |
| E (segurar) | Plantar C4 (no bombsite) · desarmar · pegar arma |
| G | Soltar arma |
| B | Menu de compras (no spawn, durante o tempo de compra) |
| Tab | Placar |
| Esc | Pausa |
| 1 2 3 4 5 | Primária, pistola, faca, granadas, C4 |
| F / Q | Inspecionar / última arma |

## Conteúdo
- Menu principal 3D, seleção de mapas (só Dust II jogável), inventário com skins e visualizador 3D, equipamentos (agentes), configurações salvas.
- Dust II: base TR/CT, Long A, Short/Catwalk, Meio, Túneis, Portas B, bombsites A e B.
- Armas: AK-47, M4A4, M4A1-S, AWP, SSG 08, Galil, FAMAS, MAC-10, MP9, P90, Nova, Glock, USP-S, Desert Eagle, faca, HE, flash, smoke, C4.
- Rounds (primeiro a 7, troca de lados no round 7), economia, compra, bomba, bots com máquina de estados (fácil/normal/difícil), placar, kill feed, radar.
