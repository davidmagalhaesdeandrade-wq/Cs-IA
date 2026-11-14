# Conta e painel no deploy de teste

O código de conta usa Supabase como PostgreSQL e Netlify Functions como única camada com acesso à chave privada. Nunca coloque a `service_role key`, a senha do administrador ou os códigos de sessão no repositório nem no código do navegador.

## Configuração necessária

1. Crie um projeto Supabase para o ambiente de teste e execute `supabase/migrations/20261114_game_accounts.sql` no SQL Editor.
2. No Netlify, configure as variáveis abaixo para o contexto da branch `feature/visual-mobile-overhaul`:
   - `SUPABASE_URL`: URL do projeto Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: chave privada `service_role` desse projeto.
   - `AUTH_TOKEN_SECRET`: segredo aleatório de pelo menos 32 bytes para assinar sessões.
   - `ADMIN_BOOTSTRAP_CODE`: código aleatório temporário usado uma vez ao cadastrar a conta `Goat`.
3. Gere um deploy de branch no Netlify. Sem essas variáveis, o endpoint retorna “Serviço de conta ainda não configurado”; isso evita cair silenciosamente em autenticação local insegura.
4. Abra **CONTA → CADASTRAR**, crie `Goat` com a senha escolhida e informe o código inicial. O banco grava somente o hash bcrypt da senha. Depois que a conta for criada, remova `ADMIN_BOOTSTRAP_CODE` das variáveis do deploy.
5. Para conceder administração a outra conta, entre como `Goat` e use **PAINEL → JOGADORES → TORNAR ADMIN**. Cada alteração fica em `game_admin_logs`.

As sessões usam cookie `HttpOnly`, `SameSite=Lax`, com validade de oito horas. O campo de nome no login bloqueia cópia e colagem na interface; a unicidade real do nome é validada no PostgreSQL com comparação sem diferenciar maiúsculas e minúsculas.

## Limites do modo atual

O projeto executa partidas locais com bots, não há serviço multiplayer conectado. O painel informa zero jogadores e zero partidas online em vez de inventar atividade; controles de partidas remotas, mapas de servidor e manutenção ficam indisponíveis. O saldo, as skins compradas e as skins equipadas na loja ainda ficam no armazenamento local do navegador, separados do perfil de conta.
