# Projeto Status — CRM Nogma Cavalcanti

Atualizado: 2026-09-04 (fim da sessão de handoff Fase 0)

> **⚠️ Nota de segurança:** este documento em versões anteriores expunha uma
> senha DB "pré-gerada" e um HMAC secret "pré-gerado". Ambos foram testados
> ou rotacionados e são **inertes**. Ver seção _Segurança_ no fim.

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

### 🅰️ Supabase — 100% pronto ✅

- Projeto: `CRM-CAVALCANTI` (ref `bbtejxugeeccywwhfpoc`, região `sa-east-1`, Postgres 17.6)
- Extensions: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `plpgsql`
- Chaves API coletadas: anon legacy JWT, service_role legacy JWT, publishable
  `sb_publishable_...`, JWT secret — em `.env.local` (gitignored)
- DB password (`SUPABASE_DB_PASSWORD`) testada via `pg` — autentica em Postgres
  17.6. ⚠️ Fraca (11 chars) — recomendável rotacionar via dashboard eventualmente.
- Connection strings prontas em `.env.local` (`?sslmode=require`, `#` → `%23`)
- `supabase/` inicializado no repo (`config.toml`, `migrations/`), CLI linkado
- Hardening Auth aplicado via Management API (`disable_signup`, `password_min_length=12`,
  `password_required_characters`, reauth-on-password-change, SSL enforcement)
- Advisor de segurança: 0 lints

### 🅱️ GitHub — 100% pronto ✅

- Secret scanning + push protection + Dependabot security updates: **enabled**
- Branch protection `main`: PR obrigatório (1 review), no force-push, no delete,
  conversation resolution required
- Merge: squash-only (histórico linear)
- Auto-delete head branches após merge
- Wiki/Projects desabilitados

Pendente (só org admin pode fazer):
- Enforce 2FA na org `NogmaBR`
- Revisar colaboradores admin (`Tarsis59`, `Hugo6404`, `guilbmarcon`)

### 🅲 Vercel — pendente parceiro

- Roteiro standalone: `docs/operacao/handoff-vercel-parceiro.md`
- Parceiro retorna: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`, URL

### Fase 1+ (bloqueado só pela Vercel)

Todos os ingredientes Supabase + GitHub prontos. Ao chegar o token Vercel,
executo Fase 1 direto. Ver `docs/superpowers/plans/2026-09-03-plano-1-fundacoes-v2.md`.

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

## Segurança — o que vazou e como foi tratado

Este arquivo, em commits anteriores (`ff16552`), continha dois valores marcados
como "gerados preventivamente" que ficaram publicamente visíveis (o repositório
GitHub `NogmaBR/CRM-CAVALCANTI` é público). Ambos foram tratados:

| Valor exposto | Tipo | Status | Como foi mitigado |
|---|---|---|---|
| `BPGAbjz…4Fq` (prefixo) | DB password "pré-gerada" | **Inerte** | Testado via `pg` client em 2026-09-04 — password auth **falhou**. Nunca foi a senha real do projeto criado depois. |
| `dcbb2015…93d` (prefixo) | HMAC secret "pré-gerado" | **Rotacionado** | Nunca foi usado em app rodando; substituído por novo secret de 32 bytes criptográficos em `.env.local`. Nunca redigite o antigo em prod. |

Segredos que **nunca** tocaram o repo git (armazenados apenas em `.env.local`,
gitignored): chaves API do Supabase (anon/service_role/publishable/secret),
Personal Access Token, DB password real, tokens Vercel. Confirmar com:

```powershell
git grep -E 'sbp_|sb_secret|sb_publishable|eyJhbGci|service_role.*eyJ' HEAD
```
(deve retornar zero matches — verificado 2026-09-04)

Ver `docs/operacao/handoff-fase-0.md` §Segurança para as configurações de
hardening aplicadas no Supabase (Auth, network, RLS defaults).

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
- **Supabase account:** conta empresa Nogma (nova) — Personal Access Token
  armazenado em `.env.local` local
- **Vercel account:** parceiro dono da org NogmaBR — pendente
