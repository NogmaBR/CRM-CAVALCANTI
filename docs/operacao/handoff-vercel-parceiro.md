# 📩 Handoff Vercel — para o parceiro dono da org GitHub `NogmaBR`

> **Documento standalone.** Este arquivo é para você repassar ao parceiro que é dono/admin da org GitHub `NogmaBR`. Ele consegue seguir o roteiro do início ao fim sem contexto adicional. Ao terminar, ele te devolve 4 valores no fim (§8). Você me passa esses 4 valores + eu configuro o resto por CLI.

---

Oi! Estamos construindo o **CRM-Cavalcanti** (repo público `NogmaBR/CRM-CAVALCANTI`) e precisamos criar/configurar o projeto Vercel. A conta Vercel precisa ser **sua** (ou uma equipe que você admin), porque o "GitHub App: Vercel" tem que ser instalado sob a org `NogmaBR` — e só quem admin a org GitHub consegue autorizar essa instalação.

**Tempo estimado:** 15 minutos. Não precisa de cartão de crédito (usaremos Hobby/Free).

**O que você vai fazer:**
1. Criar/logar conta Vercel
2. Criar team `NogmaBR` na Vercel (ou entrar num existente)
3. Instalar o GitHub App Vercel na org `NogmaBR`
4. Importar o repo `CRM-CAVALCANTI` com build config específico
5. Ativar features de segurança (Preview Protection, MFA)
6. Gerar um Access Token com escopo restrito ao team
7. Me mandar 4 valores no fim

---

## 1 · Login/criar conta Vercel

1. Abre <https://vercel.com/signup> (ou <https://vercel.com/login> se já tem conta).
2. Escolha **"Continue with GitHub"** e autentique com o usuário GitHub que administra `NogmaBR`.
3. Aceite os termos.

## 2 · Ativar MFA na sua conta Vercel (importante — 30 s)

1. Canto superior direito → avatar → **Account Settings** → **Security** (menu esquerdo).
2. Em **Two-Factor Authentication** → **Enable** → escolha **Authenticator App** → escaneie o QR com Google Authenticator / 1Password / Authy → salve os backup codes.

## 3 · Criar/entrar no Team `NogmaBR`

**Se ainda NÃO existir team `NogmaBR` na sua conta Vercel:**
1. Canto superior esquerdo → dropdown de teams → **"Create Team"**.
2. **Team Name:** `NogmaBR`
3. **Team Slug:** `nogmabr` (esse vira o URL: `vercel.com/nogmabr`)
4. **Plan:** **Hobby** (Free — botão "Start with Hobby")
   - ⚠️ Vercel pode empurrar upgrade pra "Pro Trial" — pule/ignore. Hobby atende agora.

**Se já existe team `NogmaBR`:** pule para o passo 4.

## 4 · Instalar o GitHub App "Vercel" na org NogmaBR

1. Dentro do team `NogmaBR` na Vercel, clique **"Add New… → Project"**.
2. Vai aparecer uma lista dos seus repos GitHub pessoais. Você provavelmente **não** verá `NogmaBR/CRM-CAVALCANTI` ainda.
3. Clique **"Adjust GitHub App Permissions"** (ou "Configure GitHub App", "Add GitHub Account").
4. GitHub abre em nova aba. Selecione a org **`NogmaBR`** (não sua conta pessoal!).
5. Em **Repository access**, escolha:
   - **Only select repositories** (mais restrito, recomendado) → adicione `CRM-CAVALCANTI`
   - (Alternativa: **All repositories** se quiser usar Vercel pra outros repos NogmaBR)
6. Clique **"Install & Authorize"**. Volta pro Vercel automaticamente.

## 5 · Importar o repositório

1. Volte em **Add New… → Project**.
2. Agora `NogmaBR/CRM-CAVALCANTI` deve aparecer na lista. Clique **"Import"**.
3. Configure exatamente assim (**muito importante — copie os valores!**):

   | Campo | Valor |
   |---|---|
   | **Project Name** | `crm-cavalcanti` |
   | **Framework Preset** | `Next.js` (auto-detectado — se não, escolhe na mão) |
   | **Root Directory** | `apps/web` — clique **"Edit"** e digite; **este é o principal** |
   | **Build Command** | `cd ../.. && pnpm --filter web build` |
   | **Install Command** | `cd ../.. && pnpm install --frozen-lockfile` |
   | **Output Directory** | deixe em branco (padrão `.next`) |
   | **Node.js Version** | `22.x` |

   ⚠️ Se `apps/web` **ainda não existir** no repo, o import vai falhar com "Root Directory not found". Isso é esperado — o CRM ainda não teve a Fase 1 rodada. Nesse caso:
   - **Cancele o import.**
   - Me avise (mande WhatsApp pro Nogma). A gente sobe o skeleton `apps/web/` em 5min e você tenta de novo.

4. **Environment Variables** — **NÃO preencha nada** aqui na UI. Deixe vazio.
   - Motivo: as env vars serão populadas via CLI depois (`vercel env add`), o que evita erro de digitação, dá rastreabilidade, e permite popular Production/Preview/Development de uma vez.

5. Clique **"Deploy"**. O primeiro deploy vai **falhar** (não tem código Next.js ainda) — **isso é esperado**. Só precisamos do projeto criado no dashboard.

## 6 · Ativar segurança do projeto

Depois do deploy falhar, vá em **Settings** do projeto `crm-cavalcanti` (dropdown do projeto → Settings, ou URL `vercel.com/nogmabr/crm-cavalcanti/settings`):

### 6.1 · Deployment Protection

1. Menu esquerdo → **Deployment Protection**.
2. Ative **"Vercel Authentication"** (bloqueia previews atrás de login Vercel).
   - Aplica a: **Preview + Development** (deixe Production aberto — usuários finais precisam entrar)
3. Salvar.

### 6.2 · Environment Variables — pré-config (opcional)

Se quiser adiantar (senão eu faço via CLI depois):
- Menu esquerdo → **Environment Variables**.
- Sem valores por ora — deixe.

### 6.3 · Build & Deployment

1. Menu esquerdo → **Build & Deployment**.
2. Em **Ignored Build Step**, cole:
   ```bash
   git diff HEAD^ HEAD --quiet -- apps/web/ packages/ pnpm-lock.yaml
   ```
   Assim só builda quando arquivos que importam mudarem (economiza minutos e melhora feedback).
3. Em **Node.js Version**, confirme **22.x**.
4. Salvar.

### 6.4 · Git → Deploy Hooks

Nada a fazer. Deploys automáticos por push já vêm ativos.

## 7 · Gerar Access Token com escopo restrito

Este token é o que vou usar pra configurar o projeto por CLI (env vars, redeploy, checar status).

1. Vá em <https://vercel.com/account/settings/tokens> (avatar no canto → **Account Settings** → **Tokens** no menu esquerdo).
2. Clique **"Create Token"**.
3. Preencha:
   - **Name:** `claude-code-cli-crm-cavalcanti`
   - **Scope:** selecione **`NogmaBR`** (o team) — ⚠️ **NÃO** deixe "Full Account". Isso limita o token só a esse team.
   - **Expiration:** **1 year** (renovamos depois) ou "No expiration" se preferir.
4. Clique **"Create"** → **copie o token AGORA** (`vercel_xxxxxxxxxxxxxxxxxxxxx`). Ele só aparece uma vez.
5. Guarde no seu password manager.

## 8 · Me mandar 4 valores

Copia esse bloco, preenche, e me manda:

```
VERCEL_TOKEN=vercel_...            # do passo 7
VERCEL_TEAM_ID=team_...            # vercel.com/nogmabr/settings → "Team ID"
VERCEL_PROJECT_ID=prj_...          # vercel.com/nogmabr/crm-cavalcanti/settings → "Project ID"
VERCEL_PROJECT_URL=https://...     # URL provisória do projeto (mostrada no deploy que falhou)
```

Como achar cada um:
- **`VERCEL_TOKEN`**: você acabou de criar no passo 7.
- **`VERCEL_TEAM_ID`**: `vercel.com/nogmabr/settings` → aba "General" → seção "Team Info" → copia "Team ID".
- **`VERCEL_PROJECT_ID`**: `vercel.com/nogmabr/crm-cavalcanti/settings` → aba "General" → seção "Project ID" → copia.
- **`VERCEL_PROJECT_URL`**: no dashboard do projeto → topo da página, mostra algo como `crm-cavalcanti-git-main-nogmabr.vercel.app` ou `crm-cavalcanti.vercel.app`. Copia com `https://` na frente.

⚠️ **Segurança ao me passar:**
- WhatsApp/Signal do Nogma (`+55 51 9285-6911`) OK — texto criptografado ponta a ponta.
- **Evite:** email sem PGP, canais públicos, Slack.
- Se preferir, cria uma nota temporária num password manager compartilhado (1Password vault "Nogma-CRM") e me passa o link.

## 9 · O que acontece depois que você me mandar

Não precisa fazer mais nada. Eu recebo os 4 valores e:
1. Rodo `vercel login --token <TOKEN>`
2. Rodo `vercel link --project crm-cavalcanti --scope nogmabr`
3. Populo 7 env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_APP_URL`, `WEBHOOK_HMAC_SECRET`, `OPENAI_API_KEY`) em Production+Preview+Development, marcando as sensíveis como Sensitive.
4. Configuro `SITE_URL` do Supabase pra apontar pra URL do Vercel (fecha o loop de auth).
5. Faço primeiro deploy real quando a Fase 1 for rodada.

## 10 · Custo — deve ficar zero

- **Vercel Hobby:** grátis. Limites: 100GB bandwidth/mês, ilimitado deploys, preview automático.
- **Supabase Free:** grátis. Limites: 500MB DB, 2 projetos por conta, 50k monthly active users.
- **GitHub Free:** grátis (org NogmaBR já ativa).

Só sobe pra pago se: (a) Vercel bandwidth passar 100GB/mês (produção real com muitos users), ou (b) Supabase DB passar 500MB (~50k rows típicas).

## 11 · Suporte

Se algo travar:
- Screenshot do erro → WhatsApp Nogma (`+55 51 9285-6911`)
- Ou email: `operacao@nogmacorp.com.br`

---

**Fim.** Obrigado por levantar isso! 🚀
