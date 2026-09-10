# Runbook — Vercel Pro, região São Paulo e repositório privado

> Três mudanças, **nesta ordem**, com o que conferir depois de cada uma.
> Escrito em 2026-09-10. Baseline medido: **393 ms** de mediana para uma
> consulta, com as funções em `iad1`.

---

## Por que esta ordem

```
1. Upgrade para Pro     ← libera as outras duas
2. Região → gru1        ← precisa de Pro, e de REDEPLOY
3. Repositório privado  ← independente, mas melhor por último
```

O passo 3 fica por último de propósito: se algo der errado no deploy durante a
troca de região, é mais fácil investigar com o repositório ainda público — links
de commit abrem sem login, e o suporte enxerga.

---

# 1. Upgrade para Pro

<https://vercel.com/nogma1/~/settings/billing>

Escolha **Pro**. É por membro da equipe, cobrado mensalmente.

### O que muda além do preço

| | Hobby (hoje) | Pro |
|---|---|---|
| Uso comercial | ⚠️ não permitido | ✅ permitido |
| Região das funções | fixa em `iad1` | escolhível |
| Cron jobs | **2** | 40+ |
| Proteção de deploy | limitada | por senha, SSO |

> **O uso comercial é o motivo real.** O plano Hobby é para projetos pessoais.
> Este CRM é entregue a um cliente pagante — hoje está fora dos termos, e isso
> é risco de conta suspensa, não só de recurso faltando.

### Como conferir

O painel de billing deve mostrar **Pro**, e
`Settings → Functions` deve passar a exibir o seletor de região.

---

# 2. Região das funções → São Paulo

## 2.1 — Trocar

1. <https://vercel.com/nogma1/crm-cavalcanti/settings/functions>
2. Em **Function Region**, escolha **São Paulo, Brazil (gru1)**
3. Salve

## 2.2 — Redeployar (sem isso não vale nada)

**A região só se aplica a deployments novos.** Trocar e não redeployar é
exatamente o mesmo erro do redeploy das variáveis de ambiente — e produz a
mesma conclusão errada, de que "não adiantou".

1. <https://vercel.com/nogma1/crm-cavalcanti/deployments>
2. No do topo → **⋯** → **Redeploy**
3. **Desmarque** "Use existing Build Cache"

## 2.3 — Provar que melhorou

```bash
node --env-file=.env.local scripts/medir-latencia.mjs
```

Ele lê o `duracao_ms` que a **própria função** reporta — não cronometra de fora,
para não misturar a sua internet na conta. Descarta a primeira chamada, que paga
cold start.

**Esperado:** mediana bem abaixo de 393 ms. O script compara sozinho e diz se
melhorou, se não melhorou, ou se melhorou pela metade.

> Se continuar perto de 393 ms, quase sempre é o redeploy do 2.2 que não foi
> feito.

## 2.4 — O que isso melhora, concretamente

- Toda página renderizada no servidor, que hoje paga o pedágio várias vezes
- A indexação da base de conhecimento (a primeira levou 24,7 s por causa disso)
- O webhook do WhatsApp, que tem prazo do provider

---

# 3. Repositório privado

## 3.1 — Antes de virar

Verificado em 2026-09-10: **0 forks, 0 stars, nenhum arquivo do projeto depende
de URL pública do GitHub.** Ninguém perde acesso e nada quebra.

## 3.2 — Trocar

<https://github.com/NogmaBR/CRM-CAVALCANTI/settings> → role até
**Danger Zone** → **Change repository visibility** → **Make private**.

Ou, pelo terminal:

```bash
gh repo edit NogmaBR/CRM-CAVALCANTI --visibility private --accept-visibility-change-consequences
```

## 3.3 — O que isso resolve de verdade

O repositório carrega no histórico a senha do banco que vazou (commits `ff16552`
e `2a81dab`). **Ela já foi rotacionada e não conecta mais** — isso foi provado
em 2026-09-10. Mas o histórico continua legível por qualquer um enquanto o
repositório for público.

Tornar privado não apaga o histórico; **tira o histórico de vista**. Reescrever
histórico para apagá-lo é outra conversa, mais arriscada, e não é necessária
agora que a credencial não vale mais.

## 3.4 — Como conferir

```bash
gh repo view NogmaBR/CRM-CAVALCANTI --json visibility
```

Deve dizer `PRIVATE`. E abrir <https://github.com/NogmaBR/CRM-CAVALCANTI> numa
janela anônima deve dar 404.

## 3.5 — O que conferir DEPOIS de virar privado

Repositório privado muda a integração com a Vercel. Nenhum destes costuma
quebrar, mas vale confirmar:

- [ ] **Um deploy novo sai.** Faça um commit qualquer na `main` e veja se a
      Vercel constrói. Se não sair, a permissão do GitHub App precisa ser
      reconcedida em `Settings → Git`.
- [ ] **O CI do GitHub Actions continua rodando.** Minutos de Actions em repo
      privado consomem cota — o plano gratuito dá 2.000/mês, folgado para este
      projeto.
- [ ] **`gh` continua funcionando** para você (a conta é dona; nada muda).

---

## Checklist

- [ ] Billing mostra **Pro**
- [ ] Região das funções em **gru1**
- [ ] **Redeploy feito** depois de trocar a região
- [ ] `medir-latencia.mjs` mostrando melhora clara sobre 393 ms
- [ ] Repositório em **PRIVATE**, e 404 em janela anônima
- [ ] Um deploy novo saiu depois de virar privado

---

## O que **não** muda, e é bom saber

- **Os crons continuam no `pg_cron`.** Com o Pro o limite da Vercel sobe para
  40+, então daria para trazê-los de volta. Não vale mexer: o agendamento pelo
  banco funciona, foi testado, e só chama a rota quando há trabalho — o que a
  Vercel não faria.
- **A fila continua no `pgmq`.** Nada no Pro muda essa decisão.
- **A Cloudflare continua sendo só DNS**, conforme a FASE 0. A análise da
  migração para Workers está em `docs/PLANO-CLOUDFLARE.md`, se um dia voltar à
  mesa.
