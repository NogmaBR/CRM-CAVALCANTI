# Setup Vercel (uma vez)

## Passo 0: Repositório GitHub (pré-requisito)

Se ainda não fez:

1. Crie um repositório privado no GitHub: `nogma/crm-nogma` (ou `<sua-org>/crm-nogma`)
2. Adicione remote e push:

```bash
git remote add origin git@github.com:<sua-org>/crm-nogma.git
git branch -M main
git push -u origin main
```

## Passo 1: Importar projeto

1. Acesse <https://vercel.com/new>
2. Clique em **Import Git Repository** e selecione `crm-nogma`
3. Configure:
   - **Framework Preset:** Next.js (auto-detectado)
   - **Root Directory:** `apps/web`
   - **Build Command:** `cd ../.. && pnpm --filter web build`
   - **Install Command:** `cd ../.. && pnpm install --frozen-lockfile`
   - **Output Directory:** `.next` (padrão)

Vercel geralmente detecta pnpm workspaces sozinho. Se falhar, os comandos acima são o fallback.

## Passo 2: Variáveis de ambiente

Em **Settings → Environment Variables**, adicione para **Production** E **Preview**:

| Chave | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (do Supabase) | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (do Supabase) | público |
| `SUPABASE_SERVICE_ROLE_KEY` | (do Supabase) | 🔒 secreto |
| `NEXT_PUBLIC_APP_URL` | `https://crm-nogma.vercel.app` (ou custom) | público |
| `OPENAI_API_KEY` | (deixe vazio nesta fase) | 🔒 |
| `WEBHOOK_HMAC_SECRET` | `openssl rand -hex 32` (32 hex chars) | 🔒 |

Para `WEBHOOK_HMAC_SECRET` no PowerShell (Windows):

```powershell
$bytes = New-Object byte[] 32
(New-Object Random).NextBytes($bytes)
[BitConverter]::ToString($bytes).Replace('-','').ToLower()
```

Ou via bash/WSL:

```bash
openssl rand -hex 32
```

⚠️ Marque como **Sensitive** as variáveis 🔒 no dashboard (Vercel esconde valor em logs).

## Passo 3: Domain

**Development:** `crm-nogma.vercel.app` (grátis)

**Custom (opcional):**

1. **Settings → Domains → Add** — `crm.cavalcanti.com.br`
2. No DNS do domínio (Cloudflare/Registro.br/etc), adicione:
   - Tipo: `CNAME`
   - Nome: `crm`
   - Valor: `cname.vercel-dns.com`
3. Aguarde propagação (5-30min). Vercel emite TLS automaticamente.

## Passo 4: Deploy

- **Push para `main`** → deploy automático em Production
- **PR aberta** → preview URL por PR (perfeito para revisão)

## Passo 5: Proteger main (recomendado)

**Settings → Git → Deploy Hooks → nada.** Foque em:

- Vercel **Ignored Build Step**: `git diff HEAD^ HEAD --quiet -- 'apps/web/'` — só builda se `apps/web` mudou

Este passo é opcional; só ative quando o monorepo tiver muitos apps.

## Solução de problemas

**Build falha com "pnpm not found":**
- Vercel usa Node 22 por padrão em 2026, com Corepack habilitado. Se falhar, adicione env `ENABLE_EXPERIMENTAL_COREPACK=1`.

**Rota API webhook retorna 401:**
- Verifique se `WEBHOOK_HMAC_SECRET` está setado na Vercel.
- Assinatura HMAC no header `x-signature`.

**Middleware não redireciona:**
- Vercel Edge Runtime pode não ter certas APIs. Confirme que `middleware.ts` compila para Edge.

## Referências

- <https://vercel.com/docs/frameworks/nextjs>
- <https://vercel.com/docs/monorepos/pnpm>
