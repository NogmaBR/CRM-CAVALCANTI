/**
 * Semáforo de completude — as regras, sem banco.
 *
 * Cada entidade (pagamento, obra, fornecedor, documento) é avaliada por uma
 * função pura que devolve a lista do que FALTA, com gravidade, a frase para
 * a tela e o link para resolver. O nível (verde/amarelo/vermelho) sai de uma
 * regra só, igual para todas:
 *
 *   🔴 critico  — uma falta crítica, ou duas ou mais importantes
 *   🟡 parcial  — qualquer outra falta
 *   🟢 completo — nenhuma
 *
 * Falta leve nunca deixa vermelho: só conta no "N de M itens". O acesso ao
 * banco (quem tem documento, quantos pagamentos sem nota) fica em
 * `lib/data/completude.ts`; aqui entra só o contexto já resolvido.
 */

export type Gravidade = 'critica' | 'importante' | 'leve';
export type Nivel = 'completo' | 'parcial' | 'critico';

export interface Falta {
  /** Estável: vai para teste, `title` e chave de React. */
  chave: string;
  gravidade: Gravidade;
  /** Frase inteira: "Sem comprovante ou nota fiscal". */
  texto: string;
  /** Rótulo do badge: "Sem comprovante". */
  curto: string;
  acao?: { rotulo: string; href: string };
}

export interface Completude {
  nivel: Nivel;
  /** Ordenadas: crítica → importante → leve. */
  faltas: Falta[];
  itensOk: number;
  itensTotal: number;
}

const PESO: Record<Gravidade, number> = { critica: 0, importante: 1, leve: 2 };

export function nivelDasFaltas(faltas: readonly Falta[]): Nivel {
  if (faltas.length === 0) return 'completo';
  const criticas = faltas.filter((f) => f.gravidade === 'critica').length;
  const importantes = faltas.filter((f) => f.gravidade === 'importante').length;
  if (criticas > 0 || importantes >= 2) return 'critico';
  return 'parcial';
}

/** Monta o resultado a partir da checklist: cada item é (falta | null). */
function fechar(itens: ReadonlyArray<Falta | null>): Completude {
  const faltas = itens
    .filter((f): f is Falta => f !== null)
    .sort((a, b) => PESO[a.gravidade] - PESO[b.gravidade]);
  return {
    nivel: nivelDasFaltas(faltas),
    faltas,
    itensOk: itens.length - faltas.length,
    itensTotal: itens.length,
  };
}

function vazio(v: string | null | undefined): boolean {
  return v == null || v.trim().length === 0;
}

function dataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Pagamento
// ---------------------------------------------------------------------------

export interface PagamentoParaAvaliar {
  id: string;
  status_pagto: 'confirmado' | 'aguardando' | 'recusado' | 'erro' | null;
  fornecedor_id: string | null;
  categoria_id: string | null;
  descricao: string | null;
}

export function avaliarPagamento(
  p: PagamentoParaAvaliar,
  ctx: { temDocumento: boolean },
): Completude {
  const editar = `/pagamentos/${p.id}/editar`;
  const status = p.status_pagto ?? 'confirmado';
  // Lançamento recusado não precisa de comprovante: a decisão foi contra ele.
  const precisaDeComprovante = status !== 'recusado';
  return fechar([
    precisaDeComprovante && !ctx.temDocumento
      ? {
          chave: 'comprovante',
          gravidade: 'critica',
          texto: 'Sem comprovante ou nota fiscal — falta o papel que prova o pagamento',
          curto: 'Sem comprovante',
          acao: { rotulo: 'Anexar', href: `/documentos/novo?pagamento_id=${p.id}` },
        }
      : null,
    status === 'erro'
      ? {
          chave: 'erro',
          gravidade: 'critica',
          texto: 'Deu erro no processamento — confira os dados e salve de novo',
          curto: 'Erro no processamento',
          acao: { rotulo: 'Revisar', href: editar },
        }
      : null,
    status === 'aguardando'
      ? {
          chave: 'aprovacao',
          gravidade: 'importante',
          texto: 'Ainda não foi aprovado',
          curto: 'Aguardando aprovação',
          acao: { rotulo: 'Aprovar', href: editar },
        }
      : null,
    p.fornecedor_id == null
      ? {
          chave: 'fornecedor',
          gravidade: 'importante',
          texto: 'Sem fornecedor — não entra no ranking nem na cobrança de nota',
          curto: 'Sem fornecedor',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    p.categoria_id == null
      ? {
          chave: 'categoria',
          gravidade: 'importante',
          texto: 'Sem etapa (categoria) — não aparece no gasto por etapa',
          curto: 'Sem etapa',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    vazio(p.descricao)
      ? {
          chave: 'descricao',
          gravidade: 'leve',
          texto: 'Sem descrição — fica difícil saber o que foi pago',
          curto: 'Sem descrição',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
  ]);
}

// ---------------------------------------------------------------------------
// Obra
// ---------------------------------------------------------------------------

export interface ObraParaAvaliar {
  id: string;
  status: 'ativa' | 'pausada' | 'concluida' | 'arquivada' | null;
  deleted_at?: string | null;
  cliente: string | null;
  tipo: string | null;
  valor_contrato: number | string | null;
  orcamento: number | string | null;
  data_inicio: string | null;
  data_prevista_fim: string | null;
  endereco: unknown;
}

export interface ContextoDaObra {
  /** AAAA-MM-DD em Brasília. */
  hoje: string;
  gasto: number;
  pagamentos: number;
  pagamentosSemDocumento: number;
  /** Quantidade de documentos vivos por pasta (`doc_categoria`). */
  docsPorPasta: Record<string, number>;
}

function enderecoVazio(e: unknown): boolean {
  if (!e || typeof e !== 'object') return true;
  const o = e as Record<string, unknown>;
  const rua = typeof o.rua === 'string' ? o.rua.trim() : '';
  const cidade = typeof o.cidade === 'string' ? o.cidade.trim() : '';
  return rua.length === 0 && cidade.length === 0;
}

export function avaliarObra(o: ObraParaAvaliar, ctx: ContextoDaObra): Completude {
  const editar = `/obras/${o.id}/editar`;
  const status = o.status ?? 'ativa';
  const encerrada = status === 'concluida' || status === 'arquivada' || o.deleted_at != null;
  const contrato = o.valor_contrato == null ? null : Number(o.valor_contrato);
  const pasta = (k: string) => ctx.docsPorPasta[k] ?? 0;

  const semComprovante: Falta | null =
    ctx.pagamentosSemDocumento > 0
      ? {
          chave: 'comprovantes',
          gravidade: 'importante',
          texto:
            ctx.pagamentosSemDocumento === 1
              ? '1 pagamento sem comprovante ou nota'
              : `${ctx.pagamentosSemDocumento} pagamentos sem comprovante ou nota`,
          curto:
            ctx.pagamentosSemDocumento === 1
              ? '1 pagamento sem comprovante'
              : `${ctx.pagamentosSemDocumento} sem comprovante`,
          acao: {
            rotulo: 'Ver quais',
            href: `/pagamentos?obra_id=${o.id}&situacao=pendente`,
          },
        }
      : null;

  const semContrato: Falta | null =
    contrato == null
      ? {
          chave: 'contrato',
          gravidade: 'critica',
          texto: 'Sem valor do contrato — sem ele o resultado da obra não aparece',
          curto: 'Sem contrato',
          acao: { rotulo: 'Informar', href: editar },
        }
      : null;

  // Obra encerrada: o que importa é o histórico financeiro estar fechado.
  if (encerrada) return fechar([semContrato, semComprovante]);

  const ativa = status === 'ativa';
  return fechar([
    semContrato,
    ativa && o.data_prevista_fim && o.data_prevista_fim < ctx.hoje
      ? {
          chave: 'prazo_vencido',
          gravidade: 'critica',
          texto: `O prazo previsto venceu em ${dataBR(o.data_prevista_fim)} e a obra continua ativa`,
          curto: 'Prazo vencido',
          acao: { rotulo: 'Atualizar prazo', href: editar },
        }
      : null,
    contrato != null && contrato > 0 && ctx.gasto > contrato
      ? {
          chave: 'acima_do_contrato',
          gravidade: 'critica',
          texto: `O gasto passou do contrato em ${brl(ctx.gasto - contrato)}`,
          curto: 'Acima do contrato',
          acao: { rotulo: 'Ver pagamentos', href: `/pagamentos?obra_id=${o.id}` },
        }
      : null,
    semComprovante,
    vazio(o.cliente)
      ? {
          chave: 'cliente',
          gravidade: 'importante',
          texto: 'Sem cliente',
          curto: 'Sem cliente',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    o.data_inicio == null
      ? {
          chave: 'data_inicio',
          gravidade: 'importante',
          texto: 'Sem data de início',
          curto: 'Sem data de início',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    ativa && o.data_prevista_fim == null
      ? {
          chave: 'data_prevista_fim',
          gravidade: 'importante',
          texto: 'Sem data prevista de fim — sem ela não dá para acompanhar o ritmo',
          curto: 'Sem previsão de fim',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    enderecoVazio(o.endereco)
      ? {
          chave: 'endereco',
          gravidade: 'importante',
          texto: 'Sem endereço',
          curto: 'Sem endereço',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    pasta('documentacao') === 0
      ? {
          chave: 'documentacao',
          gravidade: 'importante',
          texto: 'Pasta Documentação vazia — alvará, ART e contrato ficam aqui',
          curto: 'Sem documentação',
          acao: { rotulo: 'Enviar', href: `/documentos/novo?obra_id=${o.id}` },
        }
      : null,
    pasta('fotos') === 0
      ? {
          chave: 'fotos',
          gravidade: 'leve',
          texto: 'Nenhuma foto da obra — peça uma no grupo',
          curto: 'Sem fotos',
          acao: { rotulo: 'Enviar foto', href: `/documentos/novo?obra_id=${o.id}` },
        }
      : null,
    pasta('projeto') + pasta('projeto_aprovado') === 0
      ? {
          chave: 'projeto',
          gravidade: 'leve',
          texto: 'Sem projeto na pasta',
          curto: 'Sem projeto',
          acao: { rotulo: 'Enviar', href: `/documentos/novo?obra_id=${o.id}` },
        }
      : null,
    o.tipo == null
      ? {
          chave: 'tipo',
          gravidade: 'leve',
          texto: 'Sem tipo (nova ou reforma)',
          curto: 'Sem tipo',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    o.orcamento == null
      ? {
          chave: 'orcamento',
          gravidade: 'leve',
          texto: 'Sem orçamento planejado — a barra de consumo usa o contrato',
          curto: 'Sem orçamento',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
  ]);
}

// ---------------------------------------------------------------------------
// Fornecedor
// ---------------------------------------------------------------------------

export interface FornecedorParaAvaliar {
  id: string;
  documento: string | null;
  telefone: string | null;
  categoria_id: string | null;
  email: string | null;
  razao_social: string | null;
}

export function avaliarFornecedor(f: FornecedorParaAvaliar): Completude {
  const editar = `/fornecedores/${f.id}/editar`;
  return fechar([
    vazio(f.documento)
      ? {
          chave: 'documento',
          gravidade: 'importante',
          texto: 'Sem CNPJ/CPF — a nota fiscal não casa com o cadastro',
          curto: 'Sem CNPJ/CPF',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    vazio(f.telefone)
      ? {
          chave: 'telefone',
          gravidade: 'importante',
          texto: 'Sem telefone — a cobrança de nota pelo WhatsApp não funciona',
          curto: 'Sem telefone',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    f.categoria_id == null
      ? {
          chave: 'categoria',
          gravidade: 'leve',
          texto: 'Sem categoria',
          curto: 'Sem categoria',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    vazio(f.email)
      ? {
          chave: 'email',
          gravidade: 'leve',
          texto: 'Sem e-mail',
          curto: 'Sem e-mail',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    vazio(f.razao_social)
      ? {
          chave: 'razao_social',
          gravidade: 'leve',
          texto: 'Sem razão social',
          curto: 'Sem razão social',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
  ]);
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export interface DocumentoParaAvaliar {
  id: string;
  tipo: 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';
  obra_id: string | null;
  pagamento_id: string | null;
  fornecedor_id: string | null;
  numero_nf: string | null;
}

export function avaliarDocumento(d: DocumentoParaAvaliar): Completude {
  const editar = `/documentos/${d.id}/editar`;
  const ehComprovacao = d.tipo === 'nota_fiscal' || d.tipo === 'comprovante';
  return fechar([
    d.obra_id == null
      ? {
          chave: 'obra',
          gravidade: 'importante',
          texto: 'Sem obra — não aparece em nenhuma pasta',
          curto: 'Sem obra',
          acao: { rotulo: 'Ligar à obra', href: editar },
        }
      : null,
    ehComprovacao && d.pagamento_id == null
      ? {
          chave: 'pagamento',
          gravidade: 'importante',
          texto: 'Nota ou comprovante sem pagamento ligado — o pagamento continua "sem nota"',
          curto: 'Sem pagamento',
          acao: { rotulo: 'Ligar ao pagamento', href: editar },
        }
      : null,
    d.tipo === 'nota_fiscal' && d.fornecedor_id == null
      ? {
          chave: 'fornecedor',
          gravidade: 'leve',
          texto: 'Nota sem fornecedor',
          curto: 'Sem fornecedor',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
    d.tipo === 'nota_fiscal' && vazio(d.numero_nf)
      ? {
          chave: 'numero_nf',
          gravidade: 'leve',
          texto: 'Nota sem número',
          curto: 'Sem nº da NF',
          acao: { rotulo: 'Preencher', href: editar },
        }
      : null,
  ]);
}

// ---------------------------------------------------------------------------
// Apresentação (compartilhada por badge, painel e listas)
// ---------------------------------------------------------------------------

/** O rótulo curto do badge: a falta mais grave, ou "Faltam N" quando há várias. */
export function rotuloCurto(c: Completude): string {
  if (c.faltas.length === 0) return 'Completo';
  if (c.faltas.length === 1) return c.faltas[0]?.curto ?? 'Falta 1 item';
  return `Faltam ${c.faltas.length}`;
}

/** A frase do painel de detalhe. */
export function fraseDoNivel(c: Completude): string {
  if (c.faltas.length === 0) return 'Tudo completo';
  if (c.faltas.length === 1) return 'Falta 1 item para ficar completo';
  return `Faltam ${c.faltas.length} itens para ficar completo`;
}

export interface ResumoDeNiveis {
  completo: number;
  parcial: number;
  critico: number;
  total: number;
}

export function resumirNiveis(lista: ReadonlyArray<Pick<Completude, 'nivel'>>): ResumoDeNiveis {
  const r: ResumoDeNiveis = { completo: 0, parcial: 0, critico: 0, total: lista.length };
  for (const c of lista) r[c.nivel] += 1;
  return r;
}

export type FiltroDeSituacao = '' | 'pendente' | 'completo' | 'critico';

export function lerFiltroDeSituacao(v: string | undefined): FiltroDeSituacao {
  return v === 'pendente' || v === 'completo' || v === 'critico' ? v : '';
}

export function passaNoFiltro(c: Pick<Completude, 'nivel'>, filtro: FiltroDeSituacao): boolean {
  if (filtro === '') return true;
  if (filtro === 'completo') return c.nivel === 'completo';
  if (filtro === 'critico') return c.nivel === 'critico';
  return c.nivel !== 'completo';
}

/**
 * A falta de uma chave, no formato que a `Row` da tela de detalhe mostra
 * (texto curto em cor + link). `null` quando o campo está ok.
 */
export function faltaDoCampo(
  c: Completude,
  chave: string,
): { texto: string; href?: string; rotulo?: string; gravidade: Gravidade } | null {
  const f = c.faltas.find((x) => x.chave === chave);
  if (!f) return null;
  return { texto: f.curto, href: f.acao?.href, rotulo: f.acao?.rotulo, gravidade: f.gravidade };
}
