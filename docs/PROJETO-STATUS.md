# Projeto Status — CRM Nogma Cavalcanti

Atualizado: 2026-09-03 (fim da sessão de kickoff)

## O que está pronto ✅

### Documentação
- `docs/superpowers/specs/2026-09-03-crm-nogma-gestor-obras-design.md` — spec completo (14 seções + anexo)
- `docs/superpowers/plans/2026-09-03-plano-1-fundacoes.md` — plano v1 (superseded)
- `docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md` — plano v2 (**canônico**, usa Nogma DS)
- `docs/operacao/setup-supabase.md` — guia manual Supabase
- `docs/operacao/setup-vercel.md` — guia manual Vercel

### Design System
- `Nogma Design System/` — tokens + componentes JSX + UI kit NogmaOS + logos + fontes (fornecido pelo usuário, source of truth)
- `.design-system/` — cópias baixadas da web (referência histórica)

### Repositório
- Git inicializado, identidade Nogma (`operacao@nogmacorp.com.br`)
- Remote: `https://github.com/NogmaBR/CRM-CAVALCANTI.git`
- Branch: `main`
- 4 commits pushed

### Monorepo
- `pnpm-workspace.yaml` (pnpm v11 com `allowBuilds` para biome)
- `package.json` root com scripts (`dev`, `build`, `test`, `typecheck`)
- `biome.json` — lint + format
- `tsconfig.base.json` — TS config compartilhado
- `.gitignore`, `.gitattributes`, `README.md`, `.npmrc`
- `pnpm install` OK

## O que está PENDENTE ⏳

### 🅰️ Supabase (bloqueado por outage)

- **Bloqueio:** Outage global do Supabase control plane iniciado ~01:37 UTC 04/set/2026
  - Project Lifecycle Actions: afetado
  - Management API: Major Outage
  - Status: <https://status.supabase.com>
- **Conta a usar:** nova conta empresarial (usuário está criando)
- **Depois do outage voltar:**
  1. Usuário cria projeto pela UI (`CRM-CAVALCANTI`, org NOGMA, região São Paulo, senha DB gerada)
  2. Habilitar extensions: `pgcrypto`, `uuid-ossp`, `pg_cron`
  3. Coletar credenciais (URL + anon + service_role + project ref)
  4. Passar credenciais para retomar sessão
  5. Executar Fase 3 do Plano #1 v2 (migrations + RLS + seed + tipos)

**Senha DB gerada preventivamente:** `BPGAbjzxuDkrJsvbLCuVIBtUPSaH4Fq`
Salva em: `%TEMP%\supabase-crm-nogma-db-pw.txt`

### 🅱️ Vercel (bloqueado — parceiro vai subir)

- **Motivo:** conta Vercel será do parceiro dono da org GitHub `NogmaBR`
- **Roteiro completo entregue na conversa (Etapas 1-9)** — o parceiro pode seguir
- **Depois:**
  1. Parceiro loga no Vercel, autoriza org NogmaBR, importa repo
  2. Instala Vercel CLI local (já feito: v59.11.2)
  3. `vercel link` no repo local
  4. `vercel env add` para cada variável
  5. `vercel env pull apps/web/.env.local`
  6. Ajustar Root Directory + Framework quando Fase 1.1 rodar

**HMAC secret gerado preventivamente:**
`dcbb2015380e3413b379246af50cce1f6de9a7978ec42f2224ada934da65993d`
Salvo em: `%TEMP%\vercel-hmac-secret.txt`

### Fase 1+ (bloqueado por Supabase/Vercel prontos)

Ainda não iniciado. Ver `docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md`.

## Estado do toolchain (verificado)

| Tool | Versão | OK? |
|---|---|:---:|
| Node | v22.18.0 | ✅ |
| pnpm | v11.7.0 | ✅ |
| git | v2.50.1 | ✅ |
| Docker | v28.3.3 | ✅ |
| gh CLI | v2.99.0 (auth Tarsis59, scope: repo, gist, read:org) | ✅ |
| Supabase CLI | v2.101.0 (auth `contato.nogma@gmail.com`) | ✅ |
| Vercel CLI | v59.11.2 (não autenticado ainda) | ⏳ |

## Como retomar

Quando Supabase voltar e Vercel estiver pronto:

1. Abrir nova sessão Claude Code em `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA`
2. Passar as credenciais Supabase (URL + 3 chaves + project ref)
3. Confirmar que Vercel está linkado
4. Comando de retomada sugerido:

> "Retomando o CRM Nogma. Supabase está pronto (credenciais acima). Vercel também está linkado. Vamos executar o Plano #1 v2, começando pela Fase 1 (Task 1.1)."

O Claude vai:
- Ler `docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md`
- Executar Tasks 1.1-1.5 (Fase 1 — Design System + Chrome)
- Executar Fase 2 (Auth) e Fase 3 (Schema/RLS/seed)
- Deploy final e verificação

## Notas / gotchas descobertos nesta sessão

1. **pnpm v11+ usa `allowBuilds:` em vez de `onlyBuiltDependencies:`** — se editar `pnpm-workspace.yaml`, use o formato correto:
   ```yaml
   allowBuilds:
     "@biomejs/biome": true
   ```

2. **Free plan Supabase = 2 projetos por membro** — nosso limite atingido na conta `contato.nogma@gmail.com`. Precisamos usar a conta nova ou upgrade Pro (US$ 25/mês).

3. **Nogma Design System é COMPLETO** — inclui componentes JSX prontos (Button, Card, Stat, Input, Checkbox, etc), Chrome do NogmaOS (Sidebar+TopBar), LoginScreen, fontes, logos. Plano #1 v2 tira proveito máximo disso — pouca escrita, muito reuso.

4. **UI kit do NogmaOS (`ui_kits/nogmaos/`)** contém CSS `nos-*` embutido em `index.html` — precisa extrair na Task 1.5 pra `styles/nos-chrome.css`.

5. **Circular FK** entre `pagamentos.criado_via_msg_id` e `mensagens_whats.pagamento_id` — resolver com `DEFERRABLE INITIALLY DEFERRED` (já documentado no plano v2 Task 3.5).

## Contatos

- **Cliente:** Cavalcanti Construções (Fernando Cavalcanti)
- **Fabricante:** Nogma (`operacao@nogmacorp.com.br`, WhatsApp +55 51 9285-6911)
- **Owner GitHub:** org `NogmaBR` (parceiro)
- **Supabase account atual (Claude CLI):** `contato.nogma@gmail.com`
- **Supabase account nova (a criar):** empresa (a definir)
