> **Recuperado do transcript da sessao de 2026-09-09** (VS Code fechou antes de consolidar).
> Agente: Agent "Inventariar protótipo Cavalcanti" finished
> Custo: 128151 tokens, 17 tool calls

Inventory complete — all 34 files in `src/` read in full, plus root configs. Report below.

---

# INVENTÁRIO COMPLETO — Protótipo React/Vite "Cavalcanti Engenharia"

**Raiz:** `C:\Users\User\Downloads\CRM-CONSTRUTORA-NOGMA\Cavalcanti enegenharia`
**Stack:** React 19.2 + Vite 8 + react-router-dom 7.14 (`createBrowserRouter`) + TailwindCSS 3.4 + recharts 3.8 + lucide-react 1.7 + date-fns 4.1 + clsx 2.1. Zero backend, zero fetch — 100% dados estáticos em módulos JS e estado local (`useState`).
**Total:** ~3.200 linhas, 34 arquivos. Nenhum teste, nenhum TypeScript.

---

## 1. DADOS REAIS DO CLIENTE

### 1.1 Obras / Projetos — `src/data/projects.js` (10 obras, todas `status: "ativa"`)

Schema: `{ id, nome, cliente, clienteContato, endereco, tipo, orcamento, dataInicio, status, pastaOnedrive }`
**Unidade de `orcamento`: CENTAVOS** (confirmado por `payments.js` linha 2 `// Valores em centavos`, por `formatCurrency(centavos) =&gt; centavos/100`, e pelo form de edição que faz `String(obra.orcamento / 100)` na entrada e `Number(form.orcamento) * 100` na gravação).

| id | nome | cliente | clienteContato | endereço | tipo | orçamento (centavos) | = R$ | dataInício | status | pastaOnedrive |
|---|---|---|---|---|---|---|---|---|---|---|
| `garibaldi` | Garibaldi | Roberto Garibaldi | (51) 99812-3456 | Rua Garibaldi, 450 - Centro | nova | 45000000 | 450.000,00 | 2025-11-10 | ativa | `PAGAMENTOS/Garibaldi/` |
| `inox-piratini` | INOX Piratini | Inox Piratini Ltda | (51) 99734-5678 | Av. Industrial, 1200 - Distrito | reforma | 32000000 | 320.000,00 | 2025-12-05 | ativa | `PAGAMENTOS/INOX/` |
| `reservas-do-lago` | Reservas do Lago | Douglas Mendes | (51) 99645-7890 | Cond. Reservas do Lago, Lote 15 | nova | 58000000 | 580.000,00 | 2025-10-20 | ativa | `PAGAMENTOS/Reservas do Lago/` |
| `wrb-house` | WRB House | Walter R. Barbosa | (51) 99556-1234 | Rua das Palmeiras, 88 | nova | 38000000 | 380.000,00 | 2026-01-15 | ativa | `PAGAMENTOS/WRB/` |
| `faihome` | FAIHome | FAI Incorporadora | (51) 99467-2345 | Av. Bento Goncalves, 3200 | nova | 72000000 | 720.000,00 | 2025-09-01 | ativa | `PAGAMENTOS/Faihome/` |
| `nsiy-4-sobrados` | NSIY 4 Sobrados | NSIY Empreendimentos | (51) 99378-3456 | Rua Sao Luis, Quadra 4 | nova | 95000000 | 950.000,00 | 2025-08-15 | ativa | `PAGAMENTOS/NSIY 4 sobrados/` |
| `nsiy-7-casas` | NSIY 7 Casas | NSIY Empreendimentos | (51) 99378-3456 | Rua Sao Luis, Quadra 7 | nova | 120000000 | 1.200.000,00 | 2025-07-01 | ativa | `PAGAMENTOS/NSIY 7 Casas/` |
| `casas-rotterdam` | Casas Rotterdam | Rotterdam Construtora | (51) 99289-4567 | Cond. Rotterdam, Lotes 1-4 | nova | 85000000 | 850.000,00 | 2025-10-01 | ativa | `PAGAMENTOS/K&amp;C/` |
| `casa-ej` | Casa EJ | Eduardo &amp; Julia | (51) 99190-5678 | Rua Ipiranga, 220 | reforma | 28000000 | 280.000,00 | 2026-02-01 | ativa | `PAGAMENTOS/E&amp;J/` |
| `gc-aura-legano` | G&amp;C Aura Legano | G&amp;C Desenvolvimento | (51) 99101-6789 | Av. Aura Legano, 500 | nova | 110000000 | 1.100.000,00 | 2025-06-15 | ativa | `PAGAMENTOS/Garibaldi/` |

Orçamento somado: **683.000.000 centavos = R$ 6.830.000,00**.

**Inconsistência real no arquivo (não inventar correção, mas registrar):** `gc-aura-legano` tem `pastaOnedrive: "PAGAMENTOS/Garibaldi/"` (duplicada com a obra Garibaldi), e todos os 8 pagamentos dela também gravam comprovantes em `PAGAMENTOS/Garibaldi/`. Provável copy-paste. `casas-rotterdam` → pasta `K&amp;C` (nome de pasta divergente do nome da obra), `casa-ej` → `E&amp;J`.

**Nomes de pasta OneDrive efetivamente usados nos paths de pagamento** (contagem de comprovantes): `PAGAMENTOS/Garibaldi/` (17), `PAGAMENTOS/Faihome/` (8), `PAGAMENTOS/Reservas do Lago/` (8), `PAGAMENTOS/K&amp;C/` (7), `PAGAMENTOS/NSIY 4 sobrados/` (7), `PAGAMENTOS/NSIY 7 Casas/` (7), `PAGAMENTOS/WRB/` (7), `PAGAMENTOS/INOX/` (6), `PAGAMENTOS/E&amp;J/` (5).

### 1.2 Fornecedores — `src/data/suppliers.js` (8)

Schema: `{ id, nome, nomeAbreviado, cnpjCpf, contato, categoria, autoDetectado }`. Não há campo de obras vinculadas — o vínculo é **derivado** dos pagamentos por `getSupplierStats()`.

| id | nome (razão) | nomeAbreviado | cnpjCpf | contato | categoria | autoDetectado | pagtos | total pago | obras vinculadas (derivado) |
|---|---|---|---|---|---|---|---|---|---|
| `mathias-velho` | Mathias Velho Material de Construcao | Mathias Velho | 12.345.678/0001-90 | (51) 3564-1234 | material | false | 13 | R$ 52.530,00 | todas exceto casas-rotterdam(?) — 8+ obras |
| `alex` | Alex Servicos de Limpeza | Alex | 987.654.321-00 (CPF) | (51) 99812-0001 | limpeza | **true** | 9 | R$ 21.400,00 | 9 obras |
| `maximiliano` | Maximiliano Eletrica | Maximiliano | 23.456.789/0001-01 | (51) 99734-0002 | eletrica | false | 11 | R$ 58.350,00 | todas as 10 |
| `az-entulho` | AZ Entulho e Remocoes | Az Entulho | 34.567.890/0001-12 | (51) 99645-0003 | entulho | **true** | 8 | R$ 21.600,00 | 8 obras |
| `ferroforte` | FerroForte Materiais | FerroForte | 45.678.901/0001-23 | (51) 99556-0004 | material | false | 11 | R$ 82.980,00 | — |
| `votorantim` | Votorantim Cimentos | Votorantim | 56.789.012/0001-34 | (51) 99467-0005 | material | false | 10 | R$ 120.470,00 (maior) | — |
| `leroy-merlin` | Leroy Merlin | Leroy Merlin | 67.890.123/0001-45 | (51) 99378-0006 | material | false | 8 | R$ 50.640,00 | — |
| `hidraulica-total` | Hidraulica Total | Hidraulica Total | 78.901.234/0001-56 | (51) 99289-0007 | hidraulica | **true** | 10 | R$ 45.530,00 | — |

3 de 8 marcados `autoDetectado: true` (criados automaticamente pelo bot de WhatsApp) — Alex, Az Entulho, Hidráulica Total.

### 1.3 Pagamentos — `src/data/payments.js` (80 registros)

Cabeçalho do arquivo: `// ~80 pagamentos distribuidos entre Jan-Mar 2026` / `// Valores em centavos`.

**Schema completo (13 campos, todos presentes em todos os 80 registros):**

| campo | tipo | observação |
|---|---|---|
| `id` | string | `pay-001` … `pay-080` |
| `obraId` | string | FK → `projects.id` |
| `fornecedorId` | string | FK → `suppliers.id` |
| `dataPagamento` | string ISO `YYYY-MM-DD` | range **2026-01-03 → 2026-03-28** |
| `descricao` | string | texto livre (ver lista completa abaixo) |
| `categoria` | string | slug de `CATEGORIAS` |
| `valor` | number | **centavos**; min 89000 (R$890) / max 2300000 (R$23.000) |
| `formaPagamento` | `"pix"` \| `"transferencia"` | |
| `comprovantePath` | string \| null | `PAGAMENTOS/&lt;pasta&gt;/&lt;yy.mm.dd - descricao - Fornecedor&gt;.pdf` |
| `nfNumero` | string \| null | formato `NF_0003-000035120` |
| `nfPath` | string \| null | `PAGAMENTOS/&lt;pasta&gt;/&lt;nfNumero&gt;.pdf` |
| `status` | `completo` \| `pendente_nf` \| `pendente_comprovante` \| `aguardando` | |
| `origem` | `"whatsapp"` \| `"manual"` | |

**Totais:** 80 pagamentos, **45.350.000 centavos = R$ 453.500,00**.

**Distribuição por status:** `completo` 52 · `pendente_nf` 20 · `pendente_comprovante` 7 · `aguardando` 1.
**Por forma de pagamento:** pix 59 · transferencia 21.
**Por origem:** whatsapp 78 · manual 2 (`pay-017` limpeza industrial INOX, e um segundo registro `manual`).
**Por categoria (contagem / valor):** material 42 / R$306.620 · eletrica 11 / R$58.350 · hidraulica 10 / R$45.530 · limpeza 9 / R$21.400 · entulho 8 / R$21.600.
**Por mês:** 2026-01 R$231.920 (declinante) · 2026-02 R$123.850 · 2026-03 R$97.730.

**Por obra (gasto vs. orçamento):**

| obra | pagtos | gasto | orçamento | % usado |
|---|---|---|---|---|
| G&amp;C Aura Legano | 8 | R$ 90.800 | R$ 1.100.000 | 8% |
| NSIY 7 Casas | 8 | R$ 65.170 | R$ 1.200.000 | 5% |
| Casas Rotterdam | 7 | R$ 56.470 | R$ 850.000 | 7% |
| NSIY 4 Sobrados | 8 | R$ 54.220 | R$ 950.000 | 6% |
| FAIHome | 9 | R$ 54.160 | R$ 720.000 | 8% |
| Reservas do Lago | 9 | R$ 39.010 | R$ 580.000 | 7% |
| INOX Piratini | 7 | R$ 29.820 | R$ 320.000 | 9% |
| Garibaldi | 11 | R$ 27.540 | R$ 450.000 | 6% |
| WRB House | 7 | R$ 23.980 | R$ 380.000 | 6% |
| Casa EJ | 6 | R$ 12.330 | R$ 280.000 | 4% |

**10 registros verbatim (representando as 4 variações de status):**

```js
{ id: "pay-001", obraId: "garibaldi", fornecedorId: "mathias-velho", dataPagamento: "2026-01-10", descricao: "Cimento CP-II", categoria: "material", valor: 345000, formaPagamento: "pix", comprovantePath: "PAGAMENTOS/Garibaldi/26.01.10 - Cimento CP-II - Mathias Velho.pdf", nfNumero: "NF_0003-000035120", nfPath: "PAGAMENTOS/Garibaldi/NF_0003-000035120.pdf", status: "completo", origem: "whatsapp" }
{ id: "pay-003", obraId: "garibaldi", fornecedorId: "alex", dataPagamento: "2026-01-20", descricao: "Limpeza do terreno", categoria: "limpeza", valor: 180000, formaPagamento: "pix", comprovantePath: "PAGAMENTOS/Garibaldi/26.01.20 - Limpeza do terreno - Alex.pdf", nfNumero: null, nfPath: null, status: "pendente_nf", origem: "whatsapp" }
{ id: "pay-009", obraId: "garibaldi", fornecedorId: "leroy-merlin", dataPagamento: "2026-03-12", descricao: "Tintas e acabamento", categoria: "material", valor: 156000, formaPagamento: "pix", comprovantePath: null, nfNumero: null, nfPath: null, status: "pendente_comprovante", origem: "whatsapp" }
{ id: "pay-011", obraId: "inox-piratini", fornecedorId: "ferroforte", dataPagamento: "2026-01-08", descricao: "Chapas de aco inox", categoria: "material", valor: 890000, formaPagamento: "transferencia", comprovantePath: "PAGAMENTOS/INOX/26.01.08 - Chapas de aco inox - FerroForte.pdf", nfNumero: "NF_0003-000035089", nfPath: "PAGAMENTOS/INOX/NF_0003-000035089.pdf", status: "completo", origem: "whatsapp" }
{ id: "pay-017", obraId: "inox-piratini", fornecedorId: "alex", dataPagamento: "2026-03-15", descricao: "Limpeza industrial", categoria: "limpeza", valor: 320000, formaPagamento: "pix", comprovantePath: null, nfNumero: null, nfPath: null, status: "pendente_comprovante", origem: "manual" }
{ id: "pay-018", obraId: "reservas-do-lago", fornecedorId: "votorantim", dataPagamento: "2026-01-05", descricao: "Concreto usinado", categoria: "material", valor: 1250000, formaPagamento: "transferencia", comprovantePath: "PAGAMENTOS/Reservas do Lago/26.01.05 - Concreto usinado - Votorantim.pdf", nfNumero: "NF_0003-000035045", nfPath: "PAGAMENTOS/Reservas do Lago/NF_0003-000035045.pdf", status: "completo", origem: "whatsapp" }
{ id: "pay-068", obraId: "gc-aura-legano", fornecedorId: "votorantim", dataPagamento: "2026-01-03", descricao: "Concreto especial alta resistencia", categoria: "material", valor: 2300000, formaPagamento: "transferencia", comprovantePath: "PAGAMENTOS/Garibaldi/26.01.03 - Concreto especial alta resistencia - Votorantim.pdf", nfNumero: "NF_0003-000035023", nfPath: "PAGAMENTOS/Garibaldi/NF_0003-000035023.pdf", status: "completo", origem: "whatsapp" }
{ id: "pay-076", obraId: "garibaldi", fornecedorId: "ferroforte", dataPagamento: "2026-03-25", descricao: "Parafusos e fixadores", categoria: "material", valor: 89000, formaPagamento: "pix", comprovantePath: "PAGAMENTOS/Garibaldi/26.03.25 - Parafusos e fixadores - FerroForte.pdf", nfNumero: null, nfPath: null, status: "pendente_nf", origem: "whatsapp" }
{ id: "pay-079", obraId: "nsiy-4-sobrados", fornecedorId: "mathias-velho", dataPagamento: "2026-03-28", descricao: "Impermeabilizante", categoria: "material", valor: 234000, formaPagamento: "pix", comprovantePath: null, nfNumero: null, nfPath: null, status: "aguardando", origem: "whatsapp" }
{ id: "pay-080", obraId: "faihome", fornecedorId: "maximiliano", dataPagamento: "2026-03-28", descricao: "Quadro distribuicao", categoria: "eletrica", valor: 345000, formaPagamento: "pix", comprovantePath: "PAGAMENTOS/Faihome/26.03.28 - Quadro distribuicao - Maximiliano.pdf", nfNumero: null, nfPath: null, status: "pendente_nf", origem: "whatsapp" }
```

O arquivo é organizado por comentários-seção: `// === GARIBALDI ===`, `INOX PIRATINI`, `RESERVAS DO LAGO`, `WRB HOUSE`, `FAIHOME`, `NSIY 4 SOBRADOS`, `NSIY 7 CASAS`, `CASAS ROTTERDAM`, `CASA EJ`, `G&amp;C AURA LEGANO`, e por último `// === PAGAMENTOS RECENTES (ultimos dias - para o feed) ===` (pay-076 a pay-080, 25–28/03) — deliberadamente criados para popular o feed de atividade.

**Descrições únicas (79) — vocabulário real de itens de obra:** Cimento CP-II · Vergalhoes CA-50 · Limpeza do terreno · Remocao de entulho · Instalacao eletrica fase 1 · Tijolos ceramicos · Tubulacao PVC · Madeiramento telhado · Tintas e acabamento · Limpeza pos-obra · Chapas de aco inox · Quadro eletrico industrial · Demolicao interna · Encanamento industrial · Perfis metalicos · Argamassa especial · Limpeza industrial · Concreto usinado · Areia e brita · Tela soldada · Terraplanagem · Fiacao eletrica · Kit banheiro completo · Porcelanato piso · Cimento para reboco · Blocos estruturais · Ferragens fundacao · Limpeza terreno · Concreto laje · Eletrica basica · Tubulacao agua quente · Concreto fundacao · Aco estrutural · Tijolos e argamassa · Remocao material · Painel eletrico · Sistema hidraulico completo · Revestimentos · Limpeza geral · Concreto para 4 fundacoes · Ferragens pilares · Blocos e tijolos · Eletrica sobrado 1 e 2 · Hidraulica sobrado 1 · Limpeza entulho fase 1 · Esquadrias aluminio · Concreto 7 fundacoes · Aco para 7 unidades · Material alvenaria lote 1 · Eletrica casas 1-3 · Hidraulica casas 1-3 · Remocao entulho fase 1 · Cimento reboco lote 1 · Telhas e cumeeiras · Concreto usinado Rotterdam · Estrutura metalica · Material acabamento · Eletrica 4 unidades · Hidraulica 4 unidades · Limpeza pos-estrutura · Pisos e revestimentos · Material demolicao · Remocao entulho reforma · Eletrica nova · Encanamento novo · Acabamentos banheiro · Limpeza final · Concreto especial alta resistencia · Aco estrutural especial · Material estrutural · Eletrica predial · Sistema hidrossanitario · Remocao entulho andar 1-3 · Portas e janelas · Limpeza andares 1-5 · Parafusos e fixadores · Cimento acabamento · Limpeza geral terreno · Impermeabilizante · Quadro distribuicao.

### 1.4 Categorias de despesa — exaustivo

Fonte única de verdade: `src/config/theme.js → CATEGORIAS` (9 entradas). Só 5 aparecem em dados; 4 estão declaradas mas nunca usadas em `payments.js`/`suppliers.js` (só aparecem nos dropdowns de filtro e nos forms).

| slug/chave | label | cor | usada em dados? |
|---|---|---|---|
| `material` | Material | `#D97706` | sim (42 pagtos) |
| `mao_de_obra` | Mao de Obra | `#3B82F6` | **não** (só no select) |
| `limpeza` | Limpeza | `#22C55E` | sim (9) |
| `entulho` | Entulho | `#EF4444` | sim (8) |
| `eletrica` | Eletrica | `#8B5CF6` | sim (11) |
| `hidraulica` | Hidraulica | `#14B8A6` | sim (10) |
| `frete` | Frete | `#F97316` | **não** |
| `equipamento` | Equipamento | `#EC4899` | **não** |
| `outros` | Outros | `#6366F1` | **não** |

### 1.5 Mensagens WhatsApp — `src/data/whatsappMessages.js` (15 mensagens)

Comentário de topo: `// Mensagens simuladas do WhatsApp com diferentes estados de processamento`.

**Schema:**
```js
{
  id: "msg-001",
  tipo: "imagem" | "pdf" | "audio" | "texto",
  texto: string,                 // caption/transcrição; "" quando só mídia
  timestamp: "2026-03-28T14:32:00",  // ISO local, sem timezone
  estado: "recebida" | "processando" | "classificada" | "confirmada" | "erro",
  dadosExtraidos: null | {
      // variante COMPROVANTE:
      obra, fornecedor, valor /*centavos*/, descricao, data /*YYYY-MM-DD*/
      // variante NOTA FISCAL (tipo:"pdf"):
      nfNumero, fornecedor, valor, cnpj
  },
  pagamentoId: string | null,    // FK → payments.id
  conversa: [ { de: "fernando" | "bot", msg: string /*\n permitido*/, hora: "14:32" } ]
}
```

Máquina de estados implícita: **recebida → processando → classificada → confirmada**, com ramo **erro**. Distribuição: confirmada 10, processando 1, classificada 1, recebida 1, erro 1 (mais 1 confirmada de texto puro). `msg-006` (processando) e `msg-009` (erro) têm `dadosExtraidos` com todos os campos `null` ou `obra: null` — modela extração parcial.

**Exemplos transcritos (8 de 15, cobrindo os 4 tipos e os 5 estados):**

**1) `msg-001` — imagem com caption "atalho" (o dado vem do texto, não do OCR):**
```js
{ id:"msg-001", tipo:"imagem", texto:"Garibaldi - madeiramento Mathias Velho 2350",
  timestamp:"2026-03-28T14:32:00", estado:"confirmada",
  dadosExtraidos:{ obra:"Garibaldi", fornecedor:"Mathias Velho", valor:235000, descricao:"Madeiramento telhado", data:"2026-03-05" },
  pagamentoId:"pay-008",
  conversa:[
    { de:"fernando", msg:"[foto do comprovante] Garibaldi - madeiramento Mathias Velho 2350", hora:"14:32" },
    { de:"bot", msg:"Entendi! Registrando:\nObra: Garibaldi\nData: 05/03/2026\nValor: R$ 2.350,00\nFornecedor: Mathias Velho\nDescricao: Madeiramento telhado\nConfirma?", hora:"14:32" },
    { de:"fernando", msg:"Sim", hora:"14:33" },
    { de:"bot", msg:"Salvo! Comprovante na pasta e planilha atualizada.", hora:"14:33" } ] }
```

**2) `msg-002` — imagem sem caption: bot pergunta a obra, lê o resto do comprovante:**
```js
conversa:[
  {de:"fernando",msg:"[foto do comprovante]",hora:"15:10"},
  {de:"bot",msg:"Recebi o comprovante. Qual obra?",hora:"15:10"},
  {de:"fernando",msg:"INOX",hora:"15:11"},                 // apelido resolvido → "INOX Piratini"
  {de:"bot",msg:"Li do comprovante:\nData: 20/02/2026\nValor: R$ 5.670,00\nFornecedor: FerroForte\nDescricao: Perfis metalicos\nEsta correto?",hora:"15:11"},
  {de:"fernando",msg:"Sim",hora:"15:12"},
  {de:"bot",msg:"Salvo! INOX Piratini - R$ 5.670,00 - Perfis metalicos",hora:"15:12"} ]
// dadosExtraidos: { obra:"INOX Piratini", fornecedor:"FerroForte", valor:567000, descricao:"Perfis metalicos", data:"2026-02-20" } → pay-015
```

**3) `msg-003` — PDF de NOTA FISCAL, extração diferente (nfNumero + cnpj) e vinculação a pagamento existente:**
```js
{ id:"msg-003", tipo:"pdf", texto:"", timestamp:"2026-03-28T15:45:00", estado:"confirmada",
  dadosExtraidos:{ nfNumero:"NF_0003-000035998", fornecedor:"Mathias Velho Material de Construcao", valor:235000, cnpj:"12.345.678/0001-90" },
  pagamentoId:"pay-008",
  conversa:[
    {de:"fernando",msg:"[PDF da NF]",hora:"15:45"},
    {de:"bot",msg:"Recebi uma nota fiscal.\nNF no 0003-000035998\nFornecedor: Mathias Velho Material de Construcao\nValor: R$ 2.350,00\nVincular a qual pagamento?\n[Garibaldi - 05/03 - Madeiramento R$2.350]",hora:"15:45"},
    {de:"fernando",msg:"Esse mesmo",hora:"15:46"},
    {de:"bot",msg:"NF vinculada ao pagamento de Madeiramento - Garibaldi",hora:"15:46"} ] }
```

**4) `msg-005` — ÁUDIO transcrito, resolve "hoje" como data, e pede o comprovante depois:**
```js
{ id:"msg-005", tipo:"audio", texto:"Paguei dois mil pro Alex, limpeza da obra Reservas do Lago",
  timestamp:"2026-03-28T17:05:00", estado:"confirmada",
  dadosExtraidos:{ obra:"Reservas do Lago", fornecedor:"Alex", valor:190000, descricao:"Limpeza geral terreno", data:"2026-03-27" },
  pagamentoId:"pay-078",
  conversa:[
    {de:"fernando",msg:"[audio] Paguei mil e novecentos pro Alex, limpeza da obra Reservas do Lago",hora:"17:05"},
    {de:"bot",msg:"Entendi do audio:\nObra: Reservas do Lago\nData: hoje (27/03/2026)\nValor: R$ 1.900,00\nFornecedor: Alex\nDescricao: Limpeza geral terreno\nConfirma? Manda o comprovante quando puder.",hora:"17:05"},
    {de:"fernando",msg:"Sim",hora:"17:06"},
    {de:"bot",msg:"Registrado! Pendente: comprovante.",hora:"17:06"} ] }
```
(Nota: o campo `texto` diz "dois mil" mas a conversa e o valor dizem R$1.900 — divergência presente no arquivo.)

**5) `msg-006` — estado `processando`, obra ainda `null`, conversa interrompida aguardando resposta:**
```js
{ id:"msg-006", tipo:"imagem", texto:"", timestamp:"2026-03-28T17:30:00", estado:"processando",
  dadosExtraidos:{ obra:null, fornecedor:"Mathias Velho", valor:234000, descricao:"Impermeabilizante", data:"2026-03-28" },
  pagamentoId:"pay-079",
  conversa:[ {de:"fernando",msg:"[foto do comprovante]",hora:"17:30"},
             {de:"bot",msg:"Recebi o comprovante. Qual obra?",hora:"17:30"} ] }
```

**6) `msg-008` — TEXTO: consulta em linguagem natural, bot responde com relatório (sem extração):**
```js
{ id:"msg-008", tipo:"texto", texto:"quanto gastei em garibaldi", timestamp:"2026-03-28T18:00:00",
  estado:"confirmada", dadosExtraidos:null, pagamentoId:null,
  conversa:[ {de:"fernando",msg:"quanto gastei em garibaldi",hora:"18:00"},
    {de:"bot",msg:"Garibaldi - Resumo:\nTotal gasto: R$ 26.650,00\nMarco/2026: R$ 6.800,00\nUltimo pagamento: 25/03 - Parafusos e fixadores - R$ 890,00\nPendencias: 4 pagamentos sem NF",hora:"18:00"} ] }
```

**7) `msg-009` — ERRO de OCR (imagem ilegível), todos os campos null:**
```js
{ id:"msg-009", tipo:"imagem", texto:"", timestamp:"2026-03-27T10:15:00", estado:"erro",
  dadosExtraidos:{ obra:null, fornecedor:null, valor:null, descricao:null, data:null }, pagamentoId:null,
  conversa:[ {de:"fernando",msg:"[foto muito escura/borrada]",hora:"10:15"},
    {de:"bot",msg:"Nao consegui ler o comprovante. A imagem esta muito escura. Pode enviar novamente?",hora:"10:15"} ] }
```

**8) `msg-011` — PDF `classificada`: NF lida, aguardando escolha de vínculo (`pagamentoId: null`):**
```js
dadosExtraidos:{ nfNumero:"NF_0003-000036012", fornecedor:"Votorantim Cimentos", valor:178000, cnpj:"56.789.012/0001-34" }
bot: "Recebi uma nota fiscal.\nNF no 0003-000036012\nFornecedor: Votorantim Cimentos\nValor: R$ 1.780,00\nVincular a qual pagamento?\n[WRB House - 26/03 - Cimento acabamento R$1.780]"
```

Outros comandos de texto puro modelados: `msg-014` `"pendencias"` → *"Pendencias:\n- 6 pagamentos sem NF\n- 3 pagamentos sem comprovante\n- 1 aguardando confirmacao\nQuer ver detalhes de alguma obra?"*; `msg-015` `"resumo"` → *"Resumo geral - Marco/2026:\nTotal: R$ 48.750,00\nObras com mais gastos:\n1. G&amp;C Aura Legano: R$ 17.900,00\n2. NSIY 7 Casas: R$ 10.230,00\n3. Casas Rotterdam: R$ 11.700,00\n10 obras ativas"*. (Esses números do bot são hard-coded e não batem exatamente com os agregados calculáveis de `payments.js`.)

Apelidos/atalhos que o "bot" resolve nas mensagens: `INOX` → INOX Piratini · `WRB` → WRB House · `faihome` → FAIHome · `NSIY 4 sobrados` → NSIY 4 Sobrados · `reservas do lago` → Reservas do Lago · `leroy` → Leroy Merlin · `mathias velho` → Mathias Velho.

### 1.6 Outros dados reais

- **Pessoa/usuário:** **Fernando Cavalcanti**, rótulo "Administrador", iniciais **FC** no footer da Sidebar. Também é o remetente `de: "fernando"` em todas as conversas.
- **Marca:** "Cavalcanti" / "Construcoes" (Sidebar), ícone `HardHat`.
- **Padrão de nomenclatura de arquivo** (implementado em `formatFileName`): `yy.mm.dd - {descricao} - {fornecedorNome}.pdf` → ex. `26.03.05 - Madeiramento telhado - Mathias Velho.pdf`.
- **Padrão de NF:** `NF_0003-0000NNNNN` (sequência real de 000035023 a 000036012).
- **Telefones:** cliente-contatos `(51) 99xxx-xxxx`; fornecedores `(51) 99xxx-000N` e um fixo `(51) 3564-1234`. DDD 51 = RS (Porto Alegre/Canoas — ver "Mathias Velho" que é rede de Canoas, e "Av. Bento Goncalves").
- **Estrutura OneDrive:** raiz `PAGAMENTOS/` → uma pasta por obra → comprovantes nomeados por data e NFs nomeadas pelo número.

---

## 2. ESTRUTURA DE NAVEGAÇÃO E PÁGINAS

**Router** (`src/router.jsx`, `createBrowserRouter`, todas as rotas filhas de `&lt;AppShell/&gt;`):

| rota | componente | arquivo |
|---|---|---|
| `/` (index) | Dashboard | `src/pages/Dashboard.jsx` |
| `/obras` | ProjectManagement | `src/pages/ProjectManagement.jsx` |
| `/obras/:projectId` | ProjectDetail | `src/pages/ProjectDetail.jsx` |
| `/obras/:projectId/planilha` | ClientSpreadsheet | `src/pages/ClientSpreadsheet.jsx` |
| `/documentos` | Documents | `src/pages/Documents.jsx` |
| `/whatsapp` | WhatsAppQueue | `src/pages/WhatsAppQueue.jsx` |
| `/pendentes` | PendingItems | `src/pages/PendingItems.jsx` |
| `/fornecedores` | SupplierManagement | `src/pages/SupplierManagement.jsx` |

Sem rota 404, sem login, sem `errorElement`. Cada página renderiza seu próprio `&lt;TopBar title subtitle&gt;`; o container padrão é `&lt;div className="p-6 lg:p-8 space-y-6"&gt;`.

### 2.1 `/` — Dashboard — TopBar: "Painel" / "Visao geral de todas as obras"
- **Banner de alertas** (`bg-accent/10`, ícone `AlertTriangle`, título "Atencao"), lista de bullets construída dinamicamente: `"{n} pagamentos sem comprovante"`, `"{n} pagamentos sem nota fiscal"`, `"{n} aguardando confirmacao"`. Só renderiza se houver ao menos um.
- **4 StatCards:** "Obras Ativas" (valor = ativas, subtitle `"{total} total"`, ícone Building2) · "Gasto no Mes" (`formatCurrency`, subtitle `"{n} pagamentos"`, ícone DollarSign, **trend hard-coded = 12** → renderiza "+12% vs. mes anterior") · "Total Acumulado" (subtitle "Todas as obras", CreditCard) · "Pendentes NF" (subtitle `"{n} sem comprovante"`, FileWarning).
- **Linha de gráficos:** `SpendByProjectChart` + `MonthlyEvolutionChart` (2 colunas em lg).
- **Linha inferior:** `CategoryPieChart` (1/3) + `ActivityFeed` (2/3).
- Ações do usuário: nenhuma (só leitura + navegação pela sidebar). Atenção: "Gasto no Mes" usa `getPaymentsThisMonth` contra `new Date()` real — com dados de Jan–Mar/2026 esse card fica **R$ 0,00 / 0 pagamentos** fora daquele mês.

### 2.2 `/obras` — ProjectManagement — TopBar: "Gestao de Obras" / "{n} obras ativas"
- **3 StatCards:** "Obras Ativas" (Building2) · "Total Investido" (= `getTotalGeral(payments)`, todas as obras) · "Total Obras".
- **Botão** `Nova Obra` (variant primary, ícone `Plus`).
- **Tabela** — colunas exatas: **Obra · Cliente · Tipo · Orcamento · Gasto · % · Status · Inicio · Acoes**.
  - `%` = barra de progresso 16px (`w-16 h-1.5`) que fica **vermelha (`bg-danger`) acima de 80%**, senão `bg-accent`; largura limitada a 100%; label numérico ao lado.
  - `Status` = Badge (ativa→success "Ativa", pausada→warning "Pausada", concluida→muted "Concluida").
  - `Acoes` = 3 ícones-botão: `Eye` (navega `/obras/:id`), `Edit2` (abre modal em modo edição), `Trash2` (delete imediato do estado local, **sem confirmação**).
- **Modal** título `"Nova Obra"` / `"Editar Obra"`, campos: `Nome da Obra` (placeholder `"Ex: Garibaldi"`), `Cliente`, `Contato`, `Endereco`, `Tipo` (select Nova/Reforma), `Orcamento (R$)` (type number — convertido ×100 ao salvar), `Data Inicio` (type date), `Status` (select Ativa/Pausada/Concluida). Botões: `Cancelar` / `Criar Obra` ou `Salvar`.
- Ao criar, `pastaOnedrive` é auto-gerada como `PAGAMENTOS/{nome}/` e o id como `obra-{Date.now()}`.

### 2.3 `/obras/:projectId` — ProjectDetail — TopBar: `{nome da obra}` / `{cliente}`
- Link `← Voltar` (para `/obras`) e botão `Planilha do Cliente` (ícone `Table2` → `/obras/:id/planilha`).
- **4 StatCards:** "Orcamento" (BarChart3) · "Total Gasto" (DollarSign) · "Saldo Restante" (TrendingUp) · "Utilizacao" = `{n}%` (FileText, subtitle `"{n} pagamentos"`).
- **Barra de orçamento** dedicada (`h-3`), label "Orcamento Utilizado" + `{n}%`, vermelha acima de 80%.
- **Tabs:** `Pagamentos` · `Comprovantes` · `Resumo`.
- **Tab Pagamentos** — filtros: busca livre (`placeholder "Buscar pagamento..."`, casa descrição OU `nomeAbreviado` do fornecedor), select de status (`Todos os status / Completo / Pendente NF / Sem Comprovante / Aguardando`), select de categoria (`Todas categorias` + as 9 de `CATEGORIAS`). Ordenação fixa: data desc.
  - Colunas: **Data · Descricao · Fornecedor · Categoria · Valor · Comprov. · NF · Status · Acoes**.
  - `Comprov.`/`NF`: emoji 📎 / 📄 em verde quando presente, `—` em vermelho quando ausente.
  - **Edição inline**: botão `Editar` troca 3 células por inputs (descrição texto, categoria select, valor number) e mostra `Salvar` / `Cancelar`. Só edita descrição, valor e categoria.
- **Tab Comprovantes** — grid 2/3/4 colunas de cards: placeholder de imagem (ícone `FileText` 28px em `h-24`), nome de arquivo gerado por `formatFileName`, valor, e texto `"NF vinculada"` em accent quando há `nfNumero`.
- **Tab Resumo** — `CategoryPieChart` da obra + card "Detalhes" com 6 linhas rótulo/valor: `Total de Pagamentos`, `Completos` (verde), `Pendentes NF` (accent), `Sem Comprovante` (vermelho), `Via WhatsApp`, `Manual`.

### 2.4 `/obras/:projectId/planilha` — ClientSpreadsheet — TopBar: `Planilha - {nome}` / "Visao compartilhavel com o cliente"
Esta é a **página-chave do pitch**: reproduz a planilha que o gestor hoje manda ao cliente.
- `← Voltar` (para a obra) + 3 botões secundários: `Copiar Link` (muda o label para `"Link copiado!"` por 2s, sem clipboard real), `Excel` (ícone FileSpreadsheet), `PDF` (ícone Download) — ambos disparam `alert("Exportacao XLSX/PDF iniciada! (simulacao)")`.
- **Cabeçalho-card:** nome da obra, `"Cliente: {cliente}"`, e à direita "Total Geral" com valor em accent.
- **Tabela** com zebra (`i % 2` → `bg-surface/20`), colunas: **Data · Descricao · Fornecedor · Categoria · Valor (dir.) · Comprov. (centro) · NF (centro) · Saldo (dir.)**. `Saldo` = saldo acumulado crescente (`getRunningBalance`), em accent.
- **`&lt;tfoot&gt;`**: linha `TOTAL GERAL` (colspan 4 + valor em accent bold) seguida de **uma linha por categoria** com subtotal, ordenada desc por valor — isto é o "resumo por categoria" no pé da planilha.

### 2.5 `/documentos` — Documents (a maior página, 384 linhas) — TopBar: "Documentos" / "Notas fiscais e comprovantes organizados"
- **Documentos são derivados dos pagamentos**, não de uma coleção própria: para cada pagamento com `comprovantePath` cria doc `{id:"comp-{payId}", tipo:"comprovante", nome: formatFileName(...)}`; para cada `nfPath` cria `{id:"nf-{payId}", tipo:"nf", nome:"{nfNumero}.pdf"}`. Campos do doc: `id, tipo, pagamentoId, nome, fornecedorId, fornecedorNome, fornecedorRazao, obraId, obraNome, data, valor, descricao, path, nfVinculada|nfNumero, origem`. Com os dados atuais: **73 comprovantes + 52 NFs = 125 documentos**, 8 fornecedores com documentos.
- **4 StatCards:** "Notas Fiscais" (subtitle "armazenadas") · "Comprovantes" ("armazenados") · "Fornecedores" ("com documentos") · "Total Documentos" ("no sistema").
- **Controles:** Tabs `Por Fornecedor` / `Por Obra` (alterna o agrupamento); busca (`placeholder "Buscar documento, fornecedor, NF..."`, casa nome do arquivo, nomeAbreviado, razão social, obra, descrição e número de NF); select `Todos os tipos / Notas Fiscais / Comprovantes`.
- Links `Expandir todos` / `Recolher todos` + contador dinâmico com plural correto: `"{n} documento(s) em {m} grupo(s)"`.
- **Accordion de grupos** ordenado por nº de docs desc: header clicável com Chevron, ícone `FolderOpen` em quadro accent, nome do grupo, subtítulo `"{n} documentos · {n} NFs · {n} comprovantes"`, e à direita o **total em R$** com o rótulo "total".
- **Tabela interna do grupo** — colunas: **Tipo · Arquivo · (Obra | Fornecedor, dependendo do agrupamento) · Data · Descricao · Valor (dir.) · Origem · Acoes**. Tipo = Badge `NF` (info/azul) ou `Comprov.` (success/verde); nome do arquivo em `font-mono` truncado com `title`; Origem = texto verde `WhatsApp` ou muted `Manual`. Ações: `Eye` (title "Visualizar") e `Download` (title "Baixar" → `alert("Download simulado: {nome}")`).
- **Estado vazio:** card centralizado, ícone FileText 40px, `"Nenhum documento encontrado"` + `"Tente ajustar os filtros de busca"`.
- **Modal de preview** (`wide`, título "Documento"): área de preview falsa (ícone grande + nome + `"Preview do documento (simulacao)"`), grade 2 colunas com `Tipo` ("Nota Fiscal" / "Comprovante de Pagamento"), `Data`, `Fornecedor` (+ razão social se diferente), `Obra`, `Descricao`, `Valor`, e em largura total **`Caminho no OneDrive`** em `font-mono` dentro de bloco cinza, mais `NF Vinculada` / `Numero da NF` quando aplicável. Rodapé com botão accent `Baixar Documento`.

### 2.6 `/whatsapp` — WhatsAppQueue — TopBar: "Fila WhatsApp" / "Processamento de mensagens do bot"
- **4 StatCards:** "Processadas" (confirmadas, subtitle "este mes", CheckCircle) · "Na Fila" (recebida+processando+classificada, Clock) · **"Taxa de Acerto"** = `round(confirmadas/total*100)%`, subtitle "confirmacoes sem correcao" · "Erros" (AlertTriangle).
- **Tabs com contadores:** `Todas` · `Confirmadas` · `Processando` · `Classificadas` · `Na Fila` (estado `recebida`) · `Erros`.
- **Tabela** (ordenada por timestamp desc) — colunas: **Tipo · Mensagem · Dados Extraidos · Quando · Estado · Acoes**.
  - Tipo = ícone em círculo (`Image` imagem, `FileText` pdf, `Mic` audio, `MessageSquare` texto).
  - Mensagem = `texto` ou fallback `[{tipo}]`, truncado em 200px.
  - Dados Extraidos = mini-bloco com obra (branco), valor (accent, formatado), fornecedor (muted), nfNumero (muted); `—` quando null.
  - Quando = tempo relativo (`formatDateRelative`).
  - Estado = Badge: confirmada→success "Confirmada", processando→warning "Processando", classificada→info "Classificada", recebida→muted "Recebida", erro→danger "Erro".
  - Ações: `Eye` (abre modal de conversa) e — **só para estado `erro`** — `RefreshCw` que reprocessa (muda o estado local para `processando`).
- **Modal "Conversa com o Bot"** (`wide`): renderiza a `conversa` como bolhas de chat — `fernando` à direita (`bg-accent/20`, canto `rounded-br-sm`), `bot` à esquerda (`bg-surface`, `rounded-bl-sm`), `whitespace-pre-line` para respeitar os `\n` do bot, e hora em baixo à direita.

### 2.7 `/pendentes` — PendingItems — TopBar: "Pendencias" / "Itens que precisam de atencao"
- **3 StatCards:** "Sem Nota Fiscal" (FileText) · "Sem Comprovante" (Image) · "Aguardando Confirmacao" (Clock).
- **Tabs com contadores:** `Sem Nota Fiscal` (20) · `Sem Comprovante` (7) · `Aguardando` (1).
- Botão secundário `Enviar Lembrete WhatsApp` (ícone `Send`, size sm) → `alert("Lembrete enviado via WhatsApp! (simulacao)")`.
- Filtro select `Todas as obras` + as obras que efetivamente têm pendências.
- **Tabela** — colunas: **Obra · Data · Descricao · Fornecedor · Valor · Dias Pendente · Acoes**.
  - `Obra` é um botão que navega para a obra.
  - **`Dias Pendente`** = Badge com `{dias}d`, cor por urgência: **&gt;7 dias → danger, &gt;3 → warning, senão muted**.
  - Ações: link `Ver obra`.
- **Estado vazio:** `"Nenhuma pendencia nesta categoria"` (colspan 7, centralizado).

### 2.8 `/fornecedores` — SupplierManagement — TopBar: "Fornecedores" / "{n} cadastrados"
- **3 StatCards:** "Fornecedores" (Truck) · **"Auto-detectados"** (subtitle "via WhatsApp") · "Total Pago".
- Botões: `Mesclar` (secundário, ícone `GitMerge`) e `Novo Fornecedor` (primário, `Plus`).
- **Tabela** — colunas: **Nome · CNPJ/CPF · Categoria · Contato · Total Pago · Pagtos · Obras · Origem · Acoes**.
  - `Nome` mostra `nomeAbreviado` em destaque e a razão social abaixo em cinza **só quando diferem**.
  - `Obras` = chips com o nome de até 3 obras + `+{n}` para o excedente (derivado de `getSupplierStats`).
  - `Origem` = Badge `Auto-detectado` (info) ou `Manual` (muted).
  - Ações: `Edit2`, `Trash2` (sem confirmação).
- **Modal de cadastro/edição:** `Razao Social`, `Nome Abreviado`, `CNPJ/CPF`, `Contato`, `Categoria` (select com "Selecione..." + as 9 categorias). Botões `Cancelar` / `Cadastrar` ou `Salvar`. Se `nomeAbreviado` vazio, herda `nome`.
- **Modal "Mesclar Fornecedores":** texto `"Selecione dois fornecedores que sao o mesmo para unificar os registros."`, dois selects — `Fornecedor Principal (manter)` e `Fornecedor Duplicado (remover)` — e botão `Mesclar` → `alert("Fornecedores mesclados! (simulacao)")`. **Não implementado**, mas é uma feature conceitual importante (deduplicação de fornecedores auto-criados pelo bot).

---

## 3. DESIGN SYSTEM DO PROTÓTIPO

### 3.1 Tokens de cor

`src/config/theme.js`:
```js
COLORS = { surface:"#0F172A", card:"#1E293B", cardHover:"#334155", accent:"#D97706",
           accentLight:"#F59E0B", success:"#22C55E", danger:"#EF4444",
           muted:"#94A3B8", mutedDark:"#64748B", text:"#E2E8F0", textSecondary:"#CBD5E1" }
CHART_COLORS = ["#D97706","#F59E0B","#22C55E","#3B82F6","#8B5CF6","#EC4899","#14B8A6","#EF4444","#6366F1","#F97316"]  // declarado, NUNCA importado
```
`tailwind.config.js` espelha os mesmos hex como classes utilitárias: `surface #0F172A`, `card #1E293B`, `card-hover #334155`, `accent #D97706`, `accent-light #F59E0B`, `success #22C55E`, `danger #EF4444`, `muted #94A3B8`, `muted-dark #64748B`. (Não há token Tailwind para `text`/`textSecondary` — o texto usa `text-white` direto.) `content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"]`, sem plugins.

Tema **dark-only**, paleta slate + âmbar (accent = laranja/âmbar `#D97706` — cor "construção"). Não há dark/light toggle.

`src/index.css` (32 linhas): `@tailwind base/components/utilities`; `body { margin:0; background:#0F172A; color:#E2E8F0; font-family:'Inter', system-ui, -apple-system, sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale }`; `#root { min-height:100vh }`; **scrollbar custom** `::-webkit-scrollbar` 6px, track `#0F172A`, thumb `#334155` com `border-radius:3px`, hover `#475569`.
Atenção: a fonte **Inter é referenciada mas nunca carregada** (nenhum `&lt;link&gt;` para Google Fonts no `index.html`, nenhum `@font-face`) → cai em system-ui.

### 3.2 Vocabulário visual recorrente (padrão de fato)
- Card padrão: `bg-card rounded-xl p-5 border border-card-hover`.
- Modal: `rounded-xl`, `max-w-lg` (ou `max-w-3xl` com `wide`), backdrop `bg-black/60`.
- Botões/inputs: `rounded-lg`; badges: `rounded-full`; barras de progresso: `rounded-full`.
- Espaçamento: container de página `p-6 lg:p-8`, empilhamento `space-y-6`, grids `gap-4` (cards) / `gap-6` (gráficos).
- Tabelas: `&lt;th&gt;` = `px-4|px-5 py-3 text-xs font-medium text-muted uppercase`; linhas `border-b border-card-hover/50 hover:bg-card-hover/30`; sempre embrulhadas em `overflow-x-auto`.
- Tipografia: título de página `text-lg font-semibold`, valor de StatCard `text-2xl font-bold`, corpo `text-sm`, metadados `text-xs`.
- Ícones: `lucide-react`, 14px em ações de tabela, 16px em botões, 18–22px em headers.

### 3.3 Componentes UI (`src/components/ui/`)

| componente | props | variantes / classes |
|---|---|---|
| `Badge` | `{ children, variant="muted", className }` | `success` `bg-success/10 text-success` · `warning` `bg-accent/10 text-accent` · `danger` `bg-danger/10 text-danger` · `info` `bg-blue-500/10 text-blue-400` · `muted` `bg-muted/10 text-muted`. Base: `inline-flex px-2 py-0.5 rounded-full text-xs font-medium` |
| `Button` | `{ children, variant="primary", size="md", className, icon: Icon, ...props }` | variants: `primary` `bg-accent hover:bg-accent-light text-white` · `secondary` `bg-card-hover hover:bg-muted-dark/30 text-white` · `danger` `bg-danger/10 hover:bg-danger/20 text-danger` · `ghost` `hover:bg-card-hover text-muted hover:text-white`. sizes: `sm px-3 py-1.5 text-xs` · `md px-4 py-2 text-sm` · `lg px-6 py-3 text-sm`. Base `inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50`. Ícone renderizado a 14px se `sm`, senão 16px |
| `Input` | `{ label, className, ...props }` | label `text-xs font-medium text-muted`; input `w-full bg-surface border border-card-hover rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-dark focus:border-accent` |
| `Select` | `{ label, options: [{value,label}], className, ...props }` | mesmo estilo do Input |
| `Modal` | `{ open, onClose, title, children, wide }` | retorna `null` se `!open`; overlay `bg-black/60` clicável fecha; painel `bg-card border border-card-hover rounded-xl shadow-2xl max-w-lg` (ou `max-w-3xl` se `wide`), `max-h-[90vh] overflow-auto`; header sticky com título `text-lg font-semibold` e botão X (`lucide X` 18px). **Sem `Esc`, sem focus trap, sem portal** |
| `StatCard` | `{ title, value, subtitle, icon: Icon, trend, className }` | título `text-xs uppercase tracking-wider text-muted`; valor `text-2xl font-bold text-white`; ícone em quadro `w-10 h-10 bg-accent/10 rounded-lg` (20px, accent); `trend` numérico renderiza `"{+}{trend}% vs. mes anterior"` verde se &gt;0, vermelho se &lt;=0 |
| `Tabs` | `{ tabs: [{value,label,count?}], active, onChange }` | container `flex gap-1 bg-surface rounded-lg p-1 border border-card-hover`; aba ativa `bg-card text-white shadow-sm`, inativa `text-muted hover:text-white`; `count` renderizado como `(n)` em `text-xs text-muted` |

### 3.4 Layout

- **`AppShell`** (13 linhas): `&lt;div className="flex min-h-screen bg-surface"&gt;&lt;Sidebar/&gt;&lt;main className="flex-1 min-w-0 overflow-auto"&gt;&lt;Outlet/&gt;&lt;/main&gt;&lt;/div&gt;`.
- **`Sidebar`** (104 linhas): `w-64 bg-card border-r border-card-hover`, `fixed lg:static`, com **toggle mobile** (botão fixo top-left, `Menu`/`X`, overlay `bg-black/50`, translate-x). Fecha ao clicar num item.
  - **Header/logo:** quadro `w-10 h-10 bg-accent rounded-lg` com ícone `HardHat` (22px, branco) + `Cavalcanti` (`text-sm font-bold`) / `Construcoes` (`text-xs text-muted`).
  - **Itens de menu (labels e ícones exatos):** `/` **Painel** `LayoutDashboard` · `/obras` **Obras** `Building2` · `/documentos` **Documentos** `FolderOpen` · `/whatsapp` **WhatsApp** `MessageSquare` · `/pendentes` **Pendentes** `AlertCircle` · `/fornecedores` **Fornecedores** `Truck`. Ícones a 20px. Item ativo: `bg-accent/10 text-accent`; inativo `text-muted hover:text-white hover:bg-card-hover`; `end` só no `/`.
  - **Footer:** avatar circular `bg-accent/20` com iniciais `FC` em accent + `Fernando Cavalcanti` / `Administrador`.
- **`TopBar`** (37 linhas): `h-16 sticky top-0 z-20 bg-surface/80 backdrop-blur-sm border-b`. Props `{title, subtitle}`. À direita: botão de busca que revela um input `"Buscar..."` (w-48, autoFocus, fecha no blur — **busca puramente decorativa**) e botão de notificações `Bell` com **dot accent** de badge (não conta nada). `pl-12 lg:pl-0` para não colidir com o toggle mobile.
- **`ActivityFeed`** (`components/shared/`, 79 linhas): card "Atividade Recente" + `(via WhatsApp)`; pega as **10 mensagens mais recentes** por timestamp desc; `max-h-[400px] overflow-y-auto`. Cada item: círculo com ícone do tipo (`imagem→Image`, `pdf→FileText`, `audio→Mic`, `texto→MessageSquare`), e se a mensagem tem `pagamentoId` resolvido mostra `**{obra}** — {valor em accent} — {descricao}`; senão mostra `msg.texto` ou fallback `"Nota fiscal recebido"` / `"Comprovante recebido"`. Segunda linha: ícone+label de estado (`confirmada→CheckCircle/verde/"Confirmado"`, `processando→Clock/accent/"Processando"`, `classificada→Clock/azul/"Classificado"`, `recebida→Clock/muted/"Recebida"`, `erro→AlertTriangle/vermelho/"Erro"`) + tempo relativo.

### 3.5 Gráficos (`src/components/charts/`) — todos recharts, todos embrulhados no card padrão + `ResponsiveContainer width="100%" height={280}`

| componente | tipo | entrada | detalhes visuais |
|---|---|---|---|
| `CategoryPieChart` | **Donut** (`PieChart`/`Pie`) | `data: [{categoria, total}]` de `getCategoryBreakdown` | título "Distribuicao por Categoria"; `innerRadius 60` / `outerRadius 90` / `paddingAngle 3`; **cor por categoria vinda de `CATEGORIAS[cat].color`**, fallback `#6366F1`; Legend `iconType="circle" iconSize={8}`; tooltip formatado em BRL com `contentStyle` `background: COLORS.card`, borda `cardHover`, `borderRadius 8`, `fontSize 12` |
| `MonthlyEvolutionChart` | **AreaChart** com gradiente | `data: [{mes:"2026-01", total}]` de `getMonthlyTotals` | título "Evolucao Mensal"; `linearGradient id="colorTotal"` de `accent` 0.3 → 0 opacidade; `Area type="monotone" strokeWidth={2}`; `CartesianGrid strokeDasharray="3 3"`; **`MONTH_LABELS` hard-coded** só para `2025-10..2026-03` (Out/25, Nov/25, Dez/25, Jan/26, Fev/26, Mar/26) — fora disso mostra a chave crua; eixo Y `tickFormatter: v =&gt; (v/100000).toFixed(0)+"k"` (centavos → milhares de reais) |
| `SpendByProjectChart` | **BarChart horizontal** (`layout="vertical"`) | `data: [{obraId, nome, total}]` de `getSpendByProject` | título "Gastos por Obra"; **`.slice(0,8)` = top 8 obras** (as 2 menores ficam de fora com 10 obras); `YAxis type="category" dataKey="nome" width={120}`; barras `radius=[0,4,4,0] maxBarSize={24}`; **primeira barra em `accent` cheio, as demais em `accentLight + "80"`** (50% alpha); mesmo `tickFormatter` "k" |

---

## 4. LÓGICA DE NEGÓCIO

### 4.1 `src/utils/formatters.js` (49 linhas, usa `date-fns` + locale `ptBR`)

| função | entrada | saída | regra |
|---|---|---|---|
| `formatCurrency(centavos)` | number em centavos | `"R$ 2.350,00"` | `(centavos/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})` |
| `formatDate(isoString)` | `"2026-03-05"` | `"05/03/2026"` | `format(parseISO(x),"dd/MM/yyyy")`; **null/undefined → `"—"`** (em-dash) |
| `formatDateShort(iso)` | | `"05/03"` | `"dd/MM"`; null → `"—"`. Declarada, **não usada em nenhuma página** |
| `formatDateRelative(iso)` | timestamp | `"agora"` / `"ha 12 min"` / `"ha 3h"` / `"ha 2d"` / `"05/03"` | diff contra `new Date()`: `&lt;1min` → "agora"; `&lt;60min` → `ha {n} min`; `&lt;24h` → `ha {n}h`; `&lt;7d` → `ha {n}d`; acima disso cai para `dd/MM`. Null → `""` |
| `formatFileName(payment)` | `{dataPagamento, descricao, fornecedorNome}` | `"26.03.05 - Madeiramento telhado - Mathias Velho.pdf"` | `${yy}.${mm}.${dd} - ${descricao} - ${fornecedorNome}.pdf`. **Requer `fornecedorNome`, campo que não existe em `payments`** — os chamadores (ProjectDetail, Documents) montam um objeto ad-hoc com `supplier?.nomeAbreviado` |
| `formatMonth(iso)` | | `"mar/26"` | `format(x,"MMM/yy",{locale:ptBR})`. Declarada, **não usada** |

### 4.2 `src/utils/calculations.js` (128 linhas) — importa `projects` e `suppliers` diretamente (acoplamento aos módulos de dados), recebe `payments` por parâmetro

| função | entrada | saída | regra |
|---|---|---|---|
| `getProjectById(id)` | id | objeto obra \| undefined | `projects.find` |
| `getSupplierById(id)` | id | objeto fornecedor \| undefined | `suppliers.find` |
| `getProjectPayments(payments, projectId)` | | array | filtra por `obraId` |
| **`getProjectSummary(payments, projectId)`** | | `{...obra, totalGasto, pendentesNf, pendentesComprovante, totalPagamentos, percentualOrcamento, saldoRestante}` | spread da obra + `totalGasto = Σ valor`; `pendentesNf`/`pendentesComprovante` = **contagens** por status; `percentualOrcamento = Math.round(totalGasto/orcamento*100)`; `saldoRestante = orcamento - totalGasto` (pode ser negativo — não há clamp). Se a obra não existir: `percentualOrcamento 0`, `saldoRestante 0` |
| `getAllProjectsSummary(payments)` | | array de summaries | mapeia todos os `projects` |
| **`getMonthlyTotals(payments)`** | | `[{mes:"2026-01", total}]` ordenado asc | agrupa por `YYYY-MM` derivado de `parseISO(dataPagamento)` com `getMonth()+1` e `padStart(2,"0")`; ordena por `localeCompare` da chave |
| **`getCategoryBreakdown(payments)`** | | `[{categoria, total}]` ordenado **desc por total** | soma por `categoria` |
| **`getRunningBalance(payments)`** | | array com `saldoAcumulado` adicionado | copia e ordena **asc por data** (`parseISO(a) - parseISO(b)`), acumula `saldo += p.valor` linha a linha. É o "Saldo" da planilha do cliente — acumulado de gastos, não saldo de orçamento |
| **`getSpendByProject(payments)`** | | `[{obraId, nome, total}]` desc | soma por obra e resolve `nome` via `getProjectById`, fallback = o próprio id |
| `getTotalGeral(payments)` | | number (centavos) | `reduce` de `valor` |
| `getPaymentsThisMonth(payments)` | | array | compara `getMonth()`/`getFullYear()` do pagamento com `new Date()` — **depende da data real do sistema** |
| `getPaymentsToday(payments)` | | array | compara string `dataPagamento` com `new Date().toISOString().split("T")[0]` (UTC). Declarada, **não usada** |
| **`getPendingItems(payments)`** | | `{ semNf, semComprovante, aguardando }` — 3 arrays | `semNf` = status `pendente_nf`; `semComprovante` = `pendente_comprovante`; `aguardando` = `aguardando`. **As chaves do objeto são usadas diretamente como `value` das Tabs em PendingItems** (`pending[activeTab]`) |
| **`getSupplierStats(payments, supplierId)`** | | `{ totalPago, totalPagamentos, obras }` | soma valores do fornecedor, conta pagamentos, e `obras` = `[...new Set(map(obraId))]` (lista de ids únicos) |

**Cálculo de "dias pendente"** — não está em `calculations.js`, está inline em `src/pages/PendingItems.jsx`:
```js
const dias = Math.floor((new Date() - new Date(p.dataPagamento)) / 86400000);
const urgency = dias &gt; 7 ? "danger" : dias &gt; 3 ? "warning" : "muted";
```
Ou seja: dias corridos desde a **data do pagamento** (não desde a data em que a pendência foi criada), contra a data real do sistema; semáforo em 3 faixas (0–3 cinza, 4–7 âmbar, &gt;7 vermelho).

**Regra de status implícita nos dados** (não codificada em nenhuma função, mas consistente nos 80 registros):
- `completo` = tem `comprovantePath` **e** `nfNumero`/`nfPath`
- `pendente_nf` = tem comprovante, **sem** NF
- `pendente_comprovante` = **sem** comprovante e sem NF
- `aguardando` = registrado via bot mas ainda não confirmado (sem comprovante nem NF)

---

## 5. IDEIAS/FEATURES QUE VALEM SER PORTADAS (priorizado)

**Prioridade 1 — o coração do produto, já validado com o cliente:**
1. **Planilha do Cliente (`ClientSpreadsheet`)** — a página que substitui o Excel que o gestor manda hoje: colunas Data/Descrição/Fornecedor/Categoria/Valor/📎/📄/Saldo acumulado, `tfoot` com Total Geral + subtotais por categoria, e os 3 botões `Copiar Link` / `Excel` / `PDF`. Portar inclusive o **link compartilhável read-only** (no protótipo é fake) — é o entregável percebido pelo cliente final.
2. **Máquina de estados de mensagem do WhatsApp** `recebida → processando → classificada → confirmada` + `erro`, com `dadosExtraidos` separado do payload bruto e `pagamentoId` como vínculo. É o contrato de dados que a Fase 8 (UAZAPI/AI) precisa.
3. **Padrão de status de pagamento em 4 estados** (`completo`, `pendente_nf`, `pendente_comprovante`, `aguardando`) — simples, cobre o fluxo real (comprovante chega antes da NF) e alimenta diretamente a página de Pendências.
4. **Página de Pendências com semáforo de dias** (&gt;3 âmbar, &gt;7 vermelho) e as 3 abas com contadores + botão "Enviar Lembrete WhatsApp". É o ganho operacional mais óbvio do CRM.
5. **Convenção de nomenclatura de arquivo e pastas OneDrive**: `PAGAMENTOS/{obra}/{yy.mm.dd} - {descricao} - {Fornecedor}.pdf` e `PAGAMENTOS/{obra}/{NF_0003-000035998}.pdf`. Já é o hábito do cliente — manter idêntico reduz atrito de adoção a zero.

**Prioridade 2 — features de alto valor com pouco esforço:**
6. **Documentos derivados dos pagamentos** (não uma coleção paralela) com **agrupamento alternável Por Fornecedor / Por Obra**, accordion com total por grupo, contadores "N NFs · M comprovantes" e busca única que cobre nome de arquivo, razão social, obra, descrição e número de NF. Excelente para "onde está a NF do Votorantim de janeiro?".
7. **Modal de preview de documento** mostrando o **caminho completo no OneDrive em `font-mono`** — dá ao gestor a certeza de que o arquivo está onde ele espera.
8. **Fornecedor `autoDetectado`** (criado pelo bot) + **modal "Mesclar Fornecedores"**. Deduplicação é inevitável quando o bot cria fornecedor a partir de OCR; ter a UI desenhada já é meio caminho.
9. **Banner de alertas do Painel** montado dinamicamente a partir de `getPendingItems` — 3 linhas de código, alto impacto percebido.
10. **Edição inline na tabela de pagamentos** (descrição, valor, categoria) com Salvar/Cancelar — é assim que o gestor corrige o que a IA errou, sem abrir modal.
11. **Barra de % de orçamento que vira vermelha acima de 80%** (repetida na lista de obras e no detalhe) — leitura instantânea de risco.
12. **Modal de conversa em bolhas de chat** para auditar o que o bot entendeu, com `whitespace-pre-line`. Indispensável para depurar extração da IA em produção.
13. **StatCard "Taxa de Acerto"** (`confirmadas/total`, "confirmacoes sem correcao") — métrica de qualidade da IA visível ao usuário; virar KPI real.
14. **Comandos de texto do bot**: `resumo`, `pendencias`, `quanto gastei em {obra}` com respostas formatadas em texto. Baixo custo, altíssima percepção de valor.

**Prioridade 3 — design system e detalhes:**
15. Paleta slate + âmbar completa (tokens da seção 3.1), `rounded-xl` para cards / `rounded-lg` para controles, scrollbar 6px custom, e o kit de 7 componentes (Badge/Button/Input/Modal/Select/StatCard/Tabs) com as variantes já nomeadas — mapa direto para shadcn/ui ou Tailwind no produto final.
16. Os 3 gráficos e suas escolhas: donut por categoria com **cor fixa por categoria** (não por índice), área com gradiente para evolução mensal, barra horizontal top-8 com a primeira barra destacada, `tickFormatter` "Nk".
17. Sidebar com toggle mobile + rótulos em PT-BR curtos (Painel, Obras, Documentos, WhatsApp, Pendentes, Fornecedores) e o par ícone/label já escolhido.
18. `formatDateRelative` em PT-BR ("agora", "ha 12 min", "ha 3h", "ha 2d") para o feed.
19. Plural correto nos contadores (`"{n} documento(s) em {m} grupo(s)"`) e estados vazios com texto útil ("Nenhum documento encontrado" + "Tente ajustar os filtros de busca").

**Não portar / corrigir ao portar:**
- `trend={12}` hard-coded no StatCard "Gasto no Mes" (precisa de cálculo real mês-a-mês).
- `MONTH_LABELS` hard-coded em `MonthlyEvolutionChart` (usar `formatMonth` com locale ptBR, que já existe e está sem uso).
- `getPaymentsThisMonth` / "Gasto no Mês" quebram quando a data do sistema sai de Jan–Mar/2026.
- `SpendByProjectChart` corta silenciosamente em 8 obras (o cliente tem 10).
- Delete de obra e de fornecedor sem confirmação.
- Modal sem `Esc`/focus trap; TopBar com busca e campainha decorativas; `Copiar Link` não usa clipboard.
- Categorias declaradas e nunca usadas (`mao_de_obra`, `frete`, `equipamento`, `outros`) — decidir se entram no seed.
- `pastaOnedrive` de `G&amp;C Aura Legano` apontando para `PAGAMENTOS/Garibaldi/` (e os 8 comprovantes dela gravados lá) — corrigir no seed.
- Fonte Inter referenciada mas não carregada.
- `CHART_COLORS`, `formatDateShort`, `formatMonth`, `getAllProjectsSummary`, `getPaymentsToday` estão declarados e nunca usados.
