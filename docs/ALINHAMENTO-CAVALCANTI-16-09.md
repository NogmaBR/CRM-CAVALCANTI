# Alinhamento Cavalcanti — entrega 16/09

> Consolidação de duas conversas paralelas: (A) Q&A técnico com o parceiro do ERP/CRM005 sobre a integração de agenda (GetFuncionarios/GetAgendamentos/IncAgendamento), e (B) alinhamento de escopo/produto do CRM Nogma-Cavalcanti para a entrega de quarta-feira.
>
> **Importante:** o bloco A é sobre um sistema (CRM005/ERP legado do Cavalcanti) que **não tem nenhuma linha de código neste repositório** (`grep` por `GetFuncionarios|GetAgendamentos|CRM005|VENPEDIDODOC` em `apps/web` = zero resultados). É uma integração paralela — provavelmente via n8n ou outro serviço — e a maior parte das perguntas ali só o parceiro do ERP ou vocês (decisão de negócio) podem responder. Eu não posso "resolver" isso escrevendo código nesta base.

📅 Gerado: 2026-09-09 · Sessão: alinhamento pré-entrega

---

## 🎯 Prazo e cronograma

| Data | Marco |
|---|---|
| 11–13/09 | Reestruturação |
| Fim de semana | Testes |
| 14/09 | Revisão geral |
| 15/09 | Ajustes finais + call de validação com o cliente |
| **16/09, meio-dia** | **Entrega final** |

---

## 🔴 Bloco A — Integração ERP/CRM005 (agenda, funcionários, ocorrências, títulos)

Fora do escopo de código deste repositório. Resumo do estado + quem precisa responder o quê.

### A.1 — Confirmado (não precisa de ação, só registro)
- `Usuario` no GetAgendamentos/IncAgendamento identifica **a agenda**, não quem chama. Vale nos dois sentidos.
- Integração já ajustada do lado de vocês: busca o par Usuario × Operador via GetFuncionarios e usa o login do vendedor de destino em cada chamada, no lugar do "NOGMA" fixo.

### A.2 — Perguntas para o parceiro do ERP (aguardando resposta deles, não é código nosso)
| # | Pergunta | Por quê importa |
|---|---|---|
| 1 | 9 de 43 funcionários sem login (`VENDAS 02 - INTERNO`, `VENDAS 04`, `VENDAS 05`, `VENDAS 20 - PROSPECT`, `VENDAS 21 - PROMOTOR VENDAS`, outros): são códigos ativos que precisam de agendamento, ou cadastros antigos pra ignorar? | Sem login, o código não recebe nem lê agenda — precisa saber se é "ignorar" ou "pedir pra cadastrarem o login" |
| 2 | Legenda do campo `Funcao` (V, G, A, S, T, X) — distribuição não bate com o nome (28 "VENDAS xx" mas só 14 com `Funcao='V'`; Charlie/código 14 é "G") | Precisa pra saber quem é vendedor de campo de fato, pra montar agenda e carteira certas |
| 3 | `GetPedidoVenda` retorna erro de banco (`Table unknown VENPEDIDODOC`) em 100% das chamadas | Endpoint quebrado do lado deles |
| 4 | HTTPS ou liberação por IP para produção | Bloqueador de infra pra ligar em produção |
| 5 | `SetCliente` aceita também `vendedor`, `contato`, `condicao` e `obs`? | Precisa saber o contrato completo do endpoint |

### A.3 — Limitações de endpoint reportadas (não travam o início — dá pra contornar com sync em lote — mas valem endpoint novo se o parceiro puder criar)
Em ordem de impacto:
1. **Agenda**: 1 dia + 1 login por chamada → 238 requisições por ciclo pra montar a semana de 34 vendedores. Pedido: endpoint com `DataInicial`/`DataFinal` + lista de operadores.
2. **Ocorrências**: mesma limitação (1 dia, 1 vendedor por chamada).
3. **Títulos/comodatos**: só por cliente → precisa varrer os 2.955 clientes ativos um a um pra montar posição de inadimplência da carteira.
4. **Exclusão de agendamento**: não existe endpoint — só dá pra concluir via `AltAgendamento`.
5. **WhatsApp do funcionário**: não existe no cadastro — é justamente o canal do projeto.

### A.4 — Próximo passo combinado
Teste controlado de escrita: criar uma ocorrência + um agendamento de teste (cliente e vendedor a definir pelo parceiro) no banco de teste, e o parceiro confirma se aparece certo no CRM005. Valida o par Usuario/Operador na prática antes de ligar de vez.

**Ação — Nogma:** decidir/perguntar ao parceiro os itens A.2 (principalmente #1 e #2, que travam montar a agenda certa) e combinar data do teste controlado (A.4).

---

## 🟢 Bloco B — Alinhamento de produto CRM Cavalcanti (esta base de código)

Cada item abaixo já foi checado contra o código atual em `apps/web` — não é suposição.

### B.1 — Já implementado (nenhuma ação necessária)

| Pedido | Status | Evidência |
|---|---|---|
| Renomear "Histórico do Fornecedor" → "Relatório do Fornecedor" | ✅ Já é esse o nome em todo lugar visível | `app/(app)/relatorios/relatorios-forms.tsx:200`, `lib/reports/pdf/fornecedor.tsx:68`, `lib/reports/csv.ts:171` |
| Logo como atalho para o painel | ✅ Já funciona | `components/layout/sidebar.tsx:9` — `<Link href="/painel" aria-label="Ir para o painel">` |
| "Atividade recente" mostra ações do agente, não mensagem bruta | ✅ Já mostra labels tratados ("Mensagem recebida, aguardando classificação", "Registro confirmado a partir do WhatsApp" etc.), nunca o texto cru do WhatsApp | `lib/data/painel.ts:377-383` (`AGENTE_ACAO`), usado em `:420` |
| Métrica de confiança da IA na interface | ✅ Não encontrada em nenhuma tela (`pendentes`, `whatsapp`, `painel`) — só existe como campo interno de um template de e-mail (ver B.3) | busca por `confidence\|confianca\|%` em `app/(app)/pendentes` e `app/(app)/whatsapp` = zero |
| Cor azul do cliente no tema claro | ✅ Token já existe e está correto — `--cavalcanti-blue-500: #283078` com comentário "medido da logo", já é o `--accent` do tema `light` | `styles/tokens/colors.css:22,92-93` |

### B.2 — RESOLVIDO 2026-09-09 (commit `65bcc36` + fixup posterior)

> Nota: este item foi escrito por um agente que investigou o repo numa foto antiga (antes das
> correções abaixo já terem sido commitadas). O código já reflete a resolução.

O "verde" residual no modo claro era CSS de página que não usava `var(--accent)`. Separei
exatamente como o item propunha: troquei pra `var(--accent)` (azul no tema claro) só onde o verde
fazia papel de destaque/ação/seleção (abas ativas, hover, foco, avatar, botão primário), e troquei
os hardcodes de **status** (`#22c55e`) pro token real `var(--success)` — continuam verdes em
qualquer tema, que é o correto para semântica de sucesso/aprovado. Locais corrigidos:
`categorias.css`, `importar.css`, `usuarios.css`, `webhooks.css`, `notificacoes.css`,
`auditoria.css`, `pendentes.css` (já estava certo, só limpei o fallback morto),
`obras-table.tsx:212-224` (tinha tokens **inventados** — `--color-success-text` etc. — que nunca
existiram no design system e sempre caíam no hex hardcoded; trocado pros tokens reais
`--success`/`--danger`). `pnpm -r typecheck` e `pnpm --filter web build` limpos após a mudança.

### B.3 — RESOLVIDO 2026-09-09 (commit `65bcc36`)

Confirmado: o sistema de e-mail (`boas-vindas`, `pagamento-aguardando`, `pendencia-nova`) vai para
usuários internos do CRM (gestor/admin da Cavalcanti) — exatamente o "cliente" que o briefing pede
pra tirar do fluxo de e-mail. Removi os 2 disparos automáticos ativos
(`sendPagamentoAguardandoEmail` em `pagamentos/actions.ts`, `sendPendenciaNovaEmail` em
`classify-and-persist.ts`), o fieldset de preferências de e-mail em `/config/perfil` (deixar o
toggle visível sem o envio por trás seria uma promessa quebrada) e a entrada `/notificacoes` da
nav. `lib/email/*`, os templates e a rota `/notificacoes` continuam no repo (não deletados —
decisão deliberada de não arrancar infraestrutura só pra não correr risco extra sob prazo), só não
são mais alcançáveis pela automação nem pela navegação. O campo `confidence` no corpo do e-mail
interno ficou irrelevante junto — o e-mail nunca mais é enviado.

### B.4 — RESOLVIDO 2026-09-09 (commit `65bcc36`)

> Nota: este item também foi escrito a partir de uma foto antiga do repo — o asset já tinha
> chegado e sido processado antes desta checagem rodar.

A logo da Cavalcanti (extraída do PDF de apresentação do cliente, ver
`docs/recuperacao/2026-09-09/ESTADO-RECUPERADO.md`) já está em `public/logos/cavalcanti-mark-
{light,dark}.png` (ícone "C" isométrico recortado com Pillow) e trocada em `sidebar.tsx` e
`mobile-nav.tsx`. `app/layout.tsx` (favicon/OG) continua com a marca Nogma — não foi pedido
explicitamente no briefing e é metadata de navegador/compartilhamento, não tela do produto; avisar
se isso também deve virar Cavalcanti.

### B.5 — Decisões de negócio/processo (não é código, é vocês)
- Adicionar Tarcísio ao grupo do Cavalcanti, apresentação formal, comunicação sem gírias.
- Call de terça-feira pra testar o fluxo com o cliente.
- Confirmar com o cliente como ele vai enviar documentos/informações reais antes de produção.
- Validar com o cliente as categorias de gasto (mão de obra, limpeza, frete, hidráulica, entulho etc.) — isso eu implemento assim que a lista vier confirmada (o cadastro de categorias já é dinâmico via `/config/categorias`, não precisa de código novo, só de cadastrar).
- Hospedagem: VPS da Ciane, subdomínio próprio.
- Migrar projetos pra organização separada no Supabase.
- Conta OpenAI própria do projeto (e-mail Nogma, não pessoal), crédito inicial US$5 se precisar.
- Número de WhatsApp: chip virtual/temporário pra teste, número do cliente em produção — nunca número pessoal da equipe.

### B.6 — Regras de produto a validar/lembrar durante a reestruturação
- Fluxo: cliente manda por WhatsApp → agente estrutura → bot pede confirmação explícita ("digite OK para inserir") → só depois grava. **Sem aprovação manual pelo painel.**
- Estrutura de dados por obra/fornecedor/documento/comprovante/nota fiscal/pagamento/categoria.
- Histórico e relatório de obra e fornecedor: total pago, documentos recebidos, vínculo com obras, contato, categoria, CNPJ.
- Item sem nota fiscal/comprovante = pendência, com contagem de dias pendente.
- Manter filtros de status pendente (amarelo) / recusado (vermelho) / aprovado (verde) — revisar a lógica recusado/aprovado pra ficar coerente com a aprovação via WhatsApp (hoje o fluxo de confirmação é só "OK" do cliente — não há um estado de "recusado" explícito no fluxo descrito; vale confirmar se recusado/aprovado ainda fazem sentido como estão ou se a semântica muda).

---

## ❓ Perguntas em aberto

As perguntas 1–3 desta lista (B.2 verde→azul, B.3 automações de e-mail, B.3 campo `confidence`)
já foram resolvidas nesta mesma sessão — ver B.2/B.3/B.4 acima — usando exatamente a leitura que
este documento já propunha, então segui em frente em vez de esperar confirmação redundante.
Fica só a pergunta real, que é de vocês/negócio, não de código:

1. **A.2** — vocês já têm resposta do parceiro do ERP sobre os 9 logins faltando e a legenda de `Funcao`, ou ainda está em aberto do lado deles?
2. **B.6** — a semântica de "recusado/aprovado" nos filtros de pendências precisa mudar pra ficar coerente com a aprovação via WhatsApp só por "OK" (sem um estado de recusa explícito no fluxo)? Se sim, me diz a regra nova e eu ajusto o código.
