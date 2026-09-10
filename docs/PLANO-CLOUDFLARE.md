# Migrar para a Cloudflare — o que existe, o que muda, e o que custa

> Escrito em **2026-09-10**, depois do pedido de "usar a VPS da Cloudflare".
> Os fatos sobre o catálogo da Cloudflare foram verificados na documentação
> oficial, não de memória — as fontes estão no fim.

---

## 1. O fato que muda o pedido

**A Cloudflare não vende VPS.** Não existe máquina virtual no catálogo dela.
Nenhum produto onde você tem um servidor, um IP e um `ssh`.

Isso não é detalhe de nomenclatura: muda o que dá para fazer. Não há onde
instalar Redis, rodar `docker compose`, nem manter um processo BullMQ vivo do
jeito que a proposta original imaginava.

O que existe é isto:

| Produto | O que é | Serve para nós? |
|---|---|---|
| **Workers** | Funções serverless, globais | ✅ É onde o Next.js rodaria |
| **Containers** | Roda uma imagem de container, orquestrada por Workers. Beta pública desde 2025, exige plano pago | ⚠️ Só se algo precisar de processo longo — e não precisa mais |
| **Queues** | Fila gerenciada | ❌ Já temos `pgmq`, que resolveu sem custo |
| **Durable Objects** | Estado coordenado por chave | ❌ Sem caso de uso aqui |
| **Cron Triggers** | Agendamento | ❌ Já temos `pg_cron` |
| **Hyperdrive** | Pool e aceleração de conexão Postgres, **gratuito** | ⚠️ Ver §3 — não se aplica do jeito que parece |
| **DNS / WAF / Tunnel** | Rede | ✅ Já era a decisão da FASE 0 |

**Cloudflare Containers é o mais perto de uma VPS**, e ainda assim é diferente:
você entrega uma imagem, não administra a máquina. Para este projeto isso é
vantagem, não perda — a Fase 3 já eliminou a necessidade de processo vivo.

---

## 2. O que a migração realmente seria

Não é "mover para uma VPS". É **trocar a Vercel por Workers**, mantendo
Supabase e `pgmq` onde estão.

O caminho técnico existe e é conhecido: o adaptador `@opennextjs/cloudflare`
roda Next.js em Workers. O que muda:

| Peça | Hoje (Vercel) | Depois (Workers) |
|---|---|---|
| Build e deploy | `git push` → Vercel | `wrangler deploy`, via GitHub Actions |
| Crons | 2 na Vercel (limite do Hobby) | Cron Triggers, sem limite de 2 |
| `/api/*` | Route handlers | Iguais, sob o adaptador |
| Fila | `pgmq` + `pg_cron` | **Não muda** |
| Banco | Supabase | **Não muda** |
| TLS e domínio | Vercel | Cloudflare |

E o ganho que importa: **Smart Placement**, que roda o Worker perto do banco.
Hoje a função está na Virgínia e o banco em São Paulo — medi **394 ms de
mediana para uma única consulta**, e a primeira indexação levou 24,7 segundos
por causa disso.

---

## 3. A armadilha do Hyperdrive

A documentação da Cloudflare diz que o Hyperdrive derruba a latência por query
de 20-30ms para 1-3ms, e que ficou gratuito. Parece a solução exata do nosso
problema. **Não é**, e o porquê importa:

> Para usar Hyperdrive com Supabase, a própria documentação instrui a conectar
> com um driver Postgres (`pg` ou `postgres.js`) **em vez do cliente
> JavaScript do Supabase**.

Este projeto usa `supabase-js` em toda parte, e não por conveniência:

- **A RLS depende dele.** As policies usam `auth.uid()` e `has_role()`, que
  funcionam porque o JWT da sessão viaja no cliente Supabase. Conectando direto
  ao Postgres, esse contexto some — e a segurança do sistema inteiro estaria
  fora do banco, no código.
- **Storage, Auth e Realtime** não são Postgres. Continuariam por HTTP.

Ou seja: adotar Hyperdrive significaria **reescrever a camada de autorização**.
É a mudança mais arriscada possível num sistema financeiro, para ganhar latência
que o Smart Placement já dá sem tocar em nada.

**Conclusão: Workers sim, Hyperdrive não** — ao menos enquanto a RLS for a
trava de segurança.

---

## 4. O que quebra na migração, e o que precisa ser feito

Lista honesta, do mais provável ao menos:

| # | O que quebra | Por quê | Trabalho |
|---|---|---|---|
| 1 | `runtime = 'nodejs'` nas rotas | Workers não é Node; APIs de `node:` são parciais | Revisar cada rota. Usamos `node:crypto` (HMAC, hash) — tem equivalente Web Crypto |
| 2 | Build e deploy | Não há mais deploy automático da Vercel | GitHub Actions com `wrangler` |
| 3 | Variáveis de ambiente | Outro painel, outro formato | Recadastrar as ~14, incluindo os segredos |
| 4 | `CRON_SECRET` e o Vault | A URL guardada no Vault aponta para `crm-cavalcanti.vercel.app` | Rodar `scripts/provisionar-vault.mjs --url=<novo domínio>` |
| 5 | Crons | Os 2 da Vercel viram Cron Triggers | Migrar `sweep-pending-documentos` e `automacoes` |
| 6 | Limite de tempo e CPU | Workers tem limites diferentes dos da Vercel | A indexação já foi para lote; medir de novo |
| 7 | `sharp` (imagens) | Binário nativo, não roda em Workers | Verificar se está no caminho crítico |
| 8 | Preview por PR | A Vercel dava de graça | Workers tem preview URLs, mas o fluxo muda |

Nada aí é intransponível. Somado, é **uma a duas semanas de trabalho e risco
concentrado numa troca de plataforma** — feita num sistema que acabou de entrar
em produção.

---

## 5. A pergunta que decide

O problema real é **394 ms de latência**. Há dois caminhos para o mesmo
resultado:

| | Vercel Pro + região `gru1` | Migrar para Workers |
|---|---|---|
| Resolve a latência? | ✅ Sim, é configuração | ✅ Sim, via Smart Placement |
| Repositório privado | ✅ Vem junto | ✅ Independente |
| Trabalho | **Minutos** | 1–2 semanas |
| Risco | Nenhum | Troca de plataforma inteira |
| Custo/mês | ~US$ 20 (Vercel Pro) | ~US$ 5 (Workers Paid) |
| Limite de crons | 40+ no Pro | Sem limite prático |

**A economia é de ~US$ 15/mês.** O custo é uma a duas semanas de trabalho e o
risco de migrar a plataforma de um sistema recém-entregue.

### Minha recomendação

**Vercel Pro agora, Cloudflare depois — se depois existir um motivo melhor que
preço.** A entrega é dia 16. Trocar de plataforma antes disso é apostar o que
está funcionando; trocar depois, sem pressa, é uma decisão de arquitetura.

Motivos que justificariam a migração de verdade, e que hoje não existem:

- Volume que torne a conta da Vercel relevante (não é o caso: um cliente)
- Necessidade de rodar container com GPU (não é o caso)
- Querer tudo num fornecedor só (legítimo, mas é preferência, não necessidade)

**Se você decidir migrar mesmo assim, eu executo** — o plano está na §6 e a
lista de quebras na §4 é o roteiro. Só não quero que a decisão seja tomada
achando que se está trocando "hospedagem cara por VPS barata", porque não é
isso que está sendo trocado.

---

## 6. O plano, se a decisão for migrar

**Só depois de 16/09.** Nenhuma linha disto antes da entrega.

### Fase A — Provar que roda (2 dias)

- [ ] `@opennextjs/cloudflare` no projeto, build local
- [ ] Subir num Worker de teste, domínio temporário
- [ ] Percorrer as rotas críticas: login, `/pagamentos`, webhook, `/api/health`
- [ ] **Critério de parada:** se o webhook ou a RLS não funcionarem igual, para aqui
      e a decisão é revista

### Fase B — Paridade (3 a 4 dias)

- [ ] Revisar toda rota com `runtime = 'nodejs'`; trocar `node:crypto` por Web Crypto
      onde precisar
- [ ] Migrar os 2 crons da Vercel para Cron Triggers
- [ ] Recadastrar as variáveis; rodar `provisionar-vault.mjs` com o novo domínio
- [ ] GitHub Actions: lint → testes → build → `wrangler deploy`
- [ ] **Smart Placement** ligado, e medir a latência antes/depois

### Fase C — Virada (1 dia)

- [ ] DNS na Cloudflare apontando para o Worker
- [ ] Webhook da UAZAPI apontado para o novo domínio
- [ ] Vercel mantida no ar por uma semana, como volta atrás
- [ ] `/api/health` verde no novo ambiente por 48h antes de desligar a Vercel

### O que **não** migra

- Supabase (banco, auth, storage) — fica onde está
- `pgmq`, `pg_cron`, `pg_net` — ficam no banco
- `supabase-js` e a RLS — **não trocar por Hyperdrive** (ver §3)

---

## Fontes

- [Containers are available in public beta — Cloudflare Blog](https://blog.cloudflare.com/containers-are-available-in-public-beta-for-simple-global-and-programmable/)
- [Cloudflare Containers — página do produto](https://www.cloudflare.com/products/containers/)
- [Our container platform is in production. It has GPUs — Cloudflare Blog](https://blog.cloudflare.com/container-platform-preview/)
- [Hyperdrive — visão geral](https://developers.cloudflare.com/hyperdrive/)
- [Hyperdrive com Supabase — documentação](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)
- [Pools across the sea: how Hyperdrive speeds up access to databases — Cloudflare Blog](https://blog.cloudflare.com/how-hyperdrive-speeds-up-database-access/)
- [Supabase em Cloudflare Workers — documentação](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/)
- [Workers — preços](https://developers.cloudflare.com/workers/platform/pricing/)
