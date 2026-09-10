# Runbook — rotação dos secrets vazados

> **Para executar manualmente.** Nada aqui é automatizável: exige o dashboard do
> Supabase e o da Vercel.
>
> Tempo total: ~20 minutos. Janela de indisponibilidade: **zero** (explicado no §4).
>
> Verificado contra o código em 2026-09-10.

---

## 0. O que aconteceu, em uma frase

A senha do Postgres e o `WEBHOOK_HMAC_SECRET` de produção foram commitados em
texto plano no `docs/PROJETO-STATUS.md` em 2026-09-03, e o repositório
`NogmaBR/CRM-CAVALCANTI` **é público**.

### Valores expostos

| Secret | Valor vazado | Onde |
|---|---|---|
| Senha do Postgres | `BPGAbjz…4Fq` (31 chars) | `ff16552:docs/PROJETO-STATUS.md` |
| `WEBHOOK_HMAC_SECRET` | `dcbb2015…65993d` (64 chars hex) | idem |

Commits que carregam esses valores: `ff16552`, `1e59187`, `44d805a`, `2a81dab`.
O `1e59187` removeu da versão *atual* do arquivo, mas **o blob antigo continua
acessível** por `git show`. O `2a81dab` é o relatório de auditoria, que cita a
senha como evidência — ou seja, ela voltou ao repositório mesmo depois do scrub.

> **Por que os valores aparecem truncados aqui:** este arquivo é versionado, e
> escrever os secrets por extenso criaria mais uma cópia deles no repositório —
> foi exatamente assim que o relatório de auditoria (`2a81dab`) acabou
> republicando a senha depois de ela já ter sido removida. Para obter os valores
> completos, se precisar: `git show ff16552:docs/PROJETO-STATUS.md`.

### O que **não** vazou (verificado)

- `SUPABASE_SERVICE_ROLE_KEY` — nunca apareceu no histórico
- `SUPABASE_JWT_SECRET` — nunca apareceu
- `.env.local` — nunca foi commitado

Isso importa: a chave de service role é a credencial mais perigosa do projeto
(ignora RLS) e ela está intacta. O estrago possível se limita a acesso direto
ao Postgres e a forjar assinatura de webhook.

### O que já parece ter sido rotacionado

O `.env.local` local **não** contém mais os valores vazados (senha de 16 chars,
HMAC de 64 chars, ambos diferentes dos publicados). Mas as variáveis na Vercel
são do tipo `sensitive` e a API **não devolve o valor**, então não foi possível
provar que produção está limpa. O §5 tem como confirmar.

**Rotacione de qualquer forma.** É barato, e a dúvida sozinha já justifica.

---

## 1. ANTES DE TUDO: tornar o repositório privado

Este é o passo de maior impacto e leva 30 segundos. O repositório está público
sem que isso pareça ter sido intencional (a documentação interna do projeto o
descreve como privado).

1. <https://github.com/NogmaBR/CRM-CAVALCANTI/settings>
2. Role até **Danger Zone** → **Change repository visibility**
3. **Change to private** → confirme digitando o nome do repositório

**O que isso resolve:** para a sangria. Qualquer pessoa hoje consegue
`git clone` e ler o histórico inteiro.

**O que isso NÃO resolve:** quem já clonou continua com a cópia, e caches
(Google, GHArchive, scrapers de secret) podem ter indexado. Por isso a rotação
abaixo continua obrigatória.

> Nota: o repositório tem **0 forks**, o que é uma boa notícia — não há cópias
> públicas derivadas que continuariam expostas após a mudança de visibilidade.

---

## 2. Rotacionar a senha do Postgres

### Por que é seguro fazer agora

**Nenhum código da aplicação usa a senha do banco.** O CRM fala com o Supabase
pela API REST, autenticando com `anon key` e `service_role key` — que são JWTs
e não dependem da senha do Postgres. Um `grep` por `SUPABASE_DB_URL` e
`SUPABASE_DB_PASSWORD` em `apps/web/` e `scripts/` não retorna **nenhum** uso
em código; só aparecem em documentação.

Ou seja: rotacionar a senha **não derruba o site**. O que ela destrava é acesso
direto via `psql`/pooler — ferramentas, migrations manuais, backups.

### Passos

1. Acesse <https://supabase.com/dashboard/project/bbtejxugeeccywwhfpoc/settings/database>
2. Seção **Database password** → **Reset database password**
3. Clique em **Generate a password** (deixe o Supabase gerar — 32+ chars
   aleatórios; a senha atual tem 16, o que a auditoria já apontou como fraca)
4. **Copie a senha antes de fechar o modal.** O Supabase não mostra de novo.
5. Confirme o reset

### Atualize as connection strings

A senha aparece embutida em duas strings. Na mesma página do dashboard, a aba
**Connection string** já mostra as versões novas — copie de lá em vez de editar
à mão.

Atenção a um detalhe que já causou problema neste projeto: **caracteres
especiais precisam de URL-encoding** na connection string (o `#` vira `%23`,
`@` vira `%40`, `/` vira `%2F`). Se a senha gerada tiver algum, use a string
que o próprio dashboard monta.

Onde atualizar:

| Local | Variáveis |
|---|---|
| `.env.local` (sua máquina) | `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `SUPABASE_DB_POOLER_URL` |
| Vercel → Production | `SUPABASE_DB_URL` |

---

## 3. Rotacionar o `WEBHOOK_HMAC_SECRET`

### Por que agora é a melhor hora

Esse secret é usado em **um único lugar** no código:
`apps/web/app/api/webhooks/uazapi/route.ts`, que valida a assinatura HMAC-SHA256
das mensagens que o UAZAPI envia.

**O UAZAPI ainda não está conectado.** Não existe nenhum sistema externo usando
esse secret hoje. Rotacionar agora quebra exatamente nada.

Se você esperar até depois de configurar o UAZAPI, a rotação vira uma operação
coordenada: trocar dos dois lados ao mesmo tempo, com janela em que mensagens
são rejeitadas com 401. **Fazer agora é ordens de magnitude mais simples.**

### Passos

1. Gere um valor novo:

   ```bash
   openssl rand -hex 32
   ```

   Se não tiver `openssl` no Windows, use Node:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Atualize em:

   | Local | Variável |
   |---|---|
   | `.env.local` | `WEBHOOK_HMAC_SECRET` |
   | Vercel → Production | `WEBHOOK_HMAC_SECRET` |

3. Quando for configurar o UAZAPI, use **este** valor no painel deles.

---

## 4. Aplicar na Vercel (e por que precisa de redeploy)

1. <https://vercel.com/nogma1/crm-cavalcanti/settings/environment-variables>
2. Para cada variável (`SUPABASE_DB_URL`, `WEBHOOK_HMAC_SECRET`):
   - clique nos três pontos → **Edit**
   - cole o valor novo
   - confirme que o ambiente **Production** está marcado
   - **Save**

3. **Faça um redeploy.** Variáveis de ambiente na Vercel só passam a valer em um
   novo deploy — editar sem redeployar deixa o site rodando com os valores
   antigos, e é assim que se conclui erroneamente que "a rotação não funcionou".

   Em <https://vercel.com/nogma1/crm-cavalcanti/deployments>, no deploy de
   produção mais recente: três pontos → **Redeploy**.

**Indisponibilidade:** nenhuma. O deploy novo só entra no ar quando termina de
buildar, e nenhuma das duas variáveis é usada pelo caminho crítico da
aplicação hoje.

---

## 5. Verificar

Depois do redeploy:

```bash
# 1. O site continua no ar (espera 200)
curl -s -o /dev/null -w "%{http_code}\n" https://crm-cavalcanti.vercel.app/login

# 2. A senha nova conecta no banco (espera "1")
#    Rode com a nova SUPABASE_DB_URL já no .env.local
psql "$SUPABASE_DB_URL" -c "SELECT 1"

# 3. O webhook rejeita assinatura feita com o secret ANTIGO (espera 401)
#    Pegue o valor antigo completo com:
#      git show ff16552:docs/PROJETO-STATUS.md | grep -i hmac
WEBHOOK_HMAC_SECRET=<cole-aqui-o-valor-antigo> \
  node scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app

# 4. O webhook aceita assinatura feita com o secret NOVO (espera 200)
node --env-file=.env.local scripts/test-webhook-uazapi.mjs text-simples --url https://crm-cavalcanti.vercel.app
```

O passo 3 é o que realmente prova a rotação: se ele devolver 200, o valor antigo
**ainda está ativo** e a rotação não pegou (provavelmente faltou o redeploy).

Dois avisos sobre o passo 4:

- Ele **grava de verdade** — cria uma mensagem em `mensagens_whats` e dispara a
  classificação. Como o remetente do fixture não está em `/config/autorizados`,
  o esperado hoje é a mensagem ser descartada com `acao: "ignorada_nao_autorizada"`.
  Isso ainda prova o que interessa: a assinatura foi aceita e o 401 não veio.
- Fixtures disponíveis: `text-simples`, `image-nf`, `pdf-boleto`, `audio-ignorado`.

---

## 6. Sobre reescrever o histórico do git

A auditoria sugere usar `git filter-repo` ou BFG para apagar os valores do
histórico. Uma opinião honesta sobre isso:

**Faça só depois dos passos 1–5, e entenda que é secundário.** Reescrever o
histórico:

- **não desfaz** a exposição que já ocorreu (quem clonou, clonou);
- reescreve o SHA de todo commit posterior ao `ff16552`, ou seja, praticamente
  o repositório inteiro;
- exige `push --force` na `main`, que a proteção de branch atual bloqueia;
- quebra qualquer clone ou branch existente de qualquer pessoa.

Depois da rotação, os valores no histórico viram **strings mortas** — senha e
secret que não abrem mais nada. O ganho de apagá-los passa a ser cosmético.

Se ainda assim quiser fazer, o momento certo é com o repositório já privado, a
rotação concluída, e ninguém mais com trabalho pendente em branch.

---

## 7. Enquanto está com a mão na massa

Dois itens vizinhos que a auditoria levantou e que se resolvem no mesmo dashboard:

1. **Confirmar que o signup público está desabilitado.**
   <https://supabase.com/dashboard/project/bbtejxugeeccywwhfpoc/auth/providers>
   → **Email** → `Enable sign-ups` deve estar **desligado**.

   A migration `20260909130000` já corrigiu a escalada de privilégio no código
   (hoje todo auto-cadastro vira `leitura`, independente do que peça). Mas
   defesa em profundidade: se o signup não precisa existir, desligue.

2. **Revisar quem tem acesso ao projeto** no Supabase e na Vercel, agora que se
   sabe que o repositório esteve público.

---

## Checklist

- [ ] Repositório tornado privado
- [ ] Senha do Postgres resetada (32+ chars, gerada pelo Supabase)
- [ ] `SUPABASE_DB_PASSWORD` / `SUPABASE_DB_URL` / `SUPABASE_DB_POOLER_URL` atualizadas no `.env.local`
- [ ] `WEBHOOK_HMAC_SECRET` novo gerado (`openssl rand -hex 32`)
- [ ] `WEBHOOK_HMAC_SECRET` atualizado no `.env.local`
- [ ] Ambas atualizadas na Vercel → Production
- [ ] **Redeploy feito**
- [ ] Verificação §5 passou — em especial o passo 3 devolvendo 401
- [ ] Signup público confirmado como desabilitado
