# Setup Supabase (uma vez)

Este guia é feito UMA VEZ, no início do projeto. Depois, apenas migrações incrementais via CLI.

## Passo 1: Criar projeto

1. Vá para <https://supabase.com/dashboard>
2. Clique **"New Project"** (associe ao seu Personal Org ou crie uma Nogma Org)
3. **Nome:** `crm-nogma-cavalcanti`
4. **DB Password:** clique "Generate a password" e **SALVE no seu gerenciador de senhas** (você não verá de novo)
5. **Região:** `South America (São Paulo) sa-east-1` (latência mínima para BR)
6. **Plano:** Free (upgrade para Pro depois de validar — Pro tem backups diários e `pg_cron`)

Aguarde 2-3 minutos até o projeto estar "Healthy".

## Passo 2: Coletar credenciais

Em **Project Settings → API**, copie:

| Campo do dashboard | Variável de ambiente |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Project API keys → `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Project API keys → `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

Em **Project Settings → Database → Connection string → URI**, copie:

| Campo | Variável |
|---|---|
| Connection string (com senha substituída) | `SUPABASE_DB_URL` |

⚠️ **service_role** é secreto — nunca commit, nunca no client-side, nunca em log público.

## Passo 3: Habilitar extensions

No **SQL Editor** do dashboard, rode:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

Se `pg_cron` falhar dizendo "not allowed on Free plan", pode adiar (só usaremos na Fase 8+). Migrations base funcionam sem ele.

## Passo 4: Instalar Supabase CLI

```bash
npm install -g supabase
supabase --version
supabase login
```

O `login` abre o browser para autorizar.

## Passo 5: Linkar projeto local (executar após Task 3.1 do plano)

Dentro da raiz do repo:

```bash
supabase init   # cria supabase/config.toml (se ainda não existir)
supabase link --project-ref <PROJECT_REF>
```

`<PROJECT_REF>` é a parte antes de `.supabase.co` na URL do projeto (ex: `abcdefghijkl`).

Vai pedir a **DB Password** que você salvou no Passo 1.

## Passo 6: Criar usuário admin de teste

Em **Authentication → Users → Add user**:

- **Email:** `admin@cavalcanti.com.br` (ou o seu de teste)
- **Password:** gere forte, SALVE
- **Auto Confirm User:** ✅

Depois, no SQL Editor, promova para admin:

```sql
UPDATE public.profiles
SET papel = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@cavalcanti.com.br');
```

(Rodar isto SÓ após a migration `20260903100100_profiles_autorizados_categorias.sql` ter sido aplicada — Task 3.3 do plano.)

## Solução de problemas

**"connection refused" ao rodar `supabase db push`:**
- Verifique se você linkou o projeto (`supabase status` deve mostrar o project ref).
- Verifique a senha do DB (às vezes o Docker local capturou uma antiga — desloge com `supabase logout` e refaça).

**"permission denied for schema public":**
- Você está usando a role errada. `supabase db push` usa a service key implicitamente.

**Migrations conflitam:**
- Nunca rode `supabase db reset --linked` em prod. Só em dev.
- Se precisar refazer estado local, `supabase db reset` sem `--linked` (apenas local, se estiver rodando `supabase start`).

## Referências

- <https://supabase.com/docs>
- <https://supabase.com/docs/reference/cli>
