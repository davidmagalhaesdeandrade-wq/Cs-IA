# Conta e painel no deploy de teste

O código de conta usa Supabase como PostgreSQL e Netlify Functions como única camada com acesso à chave privada. Nunca coloque a `service_role key`, a senha do administrador ou os códigos de sessão no repositório nem no código do navegador.

## Configuração necessária

1. Crie um projeto Supabase para o ambiente de teste e execute, nesta ordem, `supabase/migrations/20261114_game_accounts.sql` e `supabase/migrations/20261115_persistent_inventory.sql` no SQL Editor. A segunda migração cria e popula o catálogo original do jogo, o inventário, as skins equipadas e operações transacionais de compra.
2. No Netlify, configure as variáveis abaixo para o contexto da branch `feature/visual-mobile-overhaul`:
   - `SUPABASE_URL`: URL do projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave privada `service_role` desse projeto.
   - `AUTH_TOKEN_SECRET`: segredo aleatório de pelo menos 32 bytes para assinar sessões.
   - `ADMIN_BOOTSTRAP_CODE`: código aleatório temporário usado uma vez ao cadastrar a conta `Goat`.
3. Gere um deploy de branch no Netlify. Sem essas variáveis, o endpoint retorna “Serviço de conta ainda não configurado”; isso evita cair silenciosamente em autenticação local insegura.
4. Abra **CONTA → CADASTRAR**, crie `Goat` com a senha escolhida e informe o código inicial. O banco grava somente o hash bcrypt da senha. Depois que a conta for criada, remova `ADMIN_BOOTSTRAP_CODE` das variáveis do deploy.
5. Para conceder administração a outra conta, entre como `Goat` e use **PAINEL → JOGADORES → TORNAR ADMIN**. Cada alteração fica em `game_admin_logs`.
6. As compras, saldo, inventário e acabamentos equipados de contas autenticadas são lidos e gravados no Supabase. Ao entrar na mesma conta em outro dispositivo, a loja sincroniza estes dados automaticamente. Convidados não podem comprar skins persistentes.

As sessões usam cookie `HttpOnly`, `SameSite=Lax`, com validade de oito horas. O campo de nome no login bloqueia cópia e colagem na interface; a unicidade real do nome é validada no PostgreSQL com comparação sem diferenciar maiúsculas e minúsculas.

## Ferramentas administrativas disponíveis

- **Dashboard/Jogadores/Logs:** contas e estatísticas persistidas; editar saldo, XP, rank, papel, bloqueio e skins concede/remove itens; ações ficam auditadas.
- **Economia:** alteração de preços no catálogo do servidor, aplicada a todos os dispositivos.
- **Bots:** em partidas locais abertas, powers de prática e ajuste de formato/dificuldade passam a valer para qualquer modo local atualmente implementado; o tamanho solicitado é aplicado no próximo round.
- **Partidas locais:** reiniciar ou encerrar a partida deste navegador.

## Limites do modo atual e trabalho necessário para multiplayer

O projeto executa partidas locais com bots; não há serviço multiplayer conectado. O painel informa zero jogadores e zero partidas online em vez de inventar atividade. O painel não consegue kickar um jogador de uma partida que não existe no servidor. Powers do jogo (aim-assist, visão através de paredes, fly, noclip e godmode) só se aplicam à simulação local deste navegador e nunca alteram outros jogadores. Para oferecer esses poderes a administradores em partidas online, é necessário criar uma simulação de partida autoritativa no servidor e enviar comandos de administração autenticados para ela; jamais confiar em flags do cliente.

Ainda é necessário desenvolver e hospedar: serviço de matchmaking e salas, transporte de rede (WebSocket/WebRTC), servidor autoritativo de tick/física/combate/economia/bomba, replicação e reconexão, validação de ações, descoberta de jogadores online, IDs de partida, controle administrativo online (kick/ban de sessão, pause/restart/end, map switch), controles de mapa/manutenção no servidor e testes de carga/segurança. Até então, map switch online, kick de sessão online, pausa de sala, bots em servidor e controles globais de manutenção não estão habilitados. Dust II é o único mapa completamente jogável; os demais são protótipos visuais.

As funções do Netlify usam a chave privada apenas no servidor. Não há acesso às configurações da sua conta Netlify/Supabase neste ambiente; a migração e as variáveis de ambiente precisam ser aplicadas no projeto de teste para habilitar o fluxo hospedado. Nenhum dado de usuário é simulado quando o backend não está configurado.
