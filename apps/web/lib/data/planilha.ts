import 'server-only';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';

/**
 * Planilha compartilhável de uma obra — a visão que o cliente final abre.
 *
 * Substitui o Excel que o gestor monta à mão e manda por WhatsApp. Por isso a
 * página é pública: o dono da obra não vai criar conta no CRM pra ver quanto
 * já foi gasto. O token no link é a credencial inteira.
 *
 * ## Regras que este módulo precisa garantir
 *
 * 1. **Escopo de uma obra só.** Nada aqui devolve outra obra, telefone de
 *    ninguém, nome de usuário do CRM ou qualquer dado que o visitante não
 *    precise. A consulta é fechada por `obra_id` e as colunas são escolhidas
 *    uma a uma — nunca `select('*')`.
 * 2. **Service role, mas sem sessão.** Não há usuário logado, então a RLS não
 *    tem em que se apoiar; a autorização é o token. Como o client de service
 *    role ignora RLS, todo filtro é explícito no código abaixo.
 * 3. **Token inválido, revogado ou expirado devolve `null`** — a página trata
 *    os três como "link não encontrado", sem dizer qual dos três foi, pra não
 *    virar oráculo de tokens.
 */

export interface LinhaPlanilha {
  id: string;
  data: string;
  descricao: string | null;
  fornecedor: string | null;
  categoria: string | null;
  valor: number;
  temNotaFiscal: boolean;
  temComprovante: boolean;
  /** Soma corrida do início do período até esta linha. */
  saldoAcumulado: number;
}

export interface SubtotalCategoria {
  categoria: string;
  total: number;
  quantidade: number;
}

export interface Planilha {
  obra: {
    nome: string;
    cliente: string | null;
    orcamento: number | null;
    status: string | null;
  };
  linhas: LinhaPlanilha[];
  totalGeral: number;
  porCategoria: SubtotalCategoria[];
  /** % do orçamento consumido; `null` quando a obra não tem orçamento. */
  percentualOrcamento: number | null;
  geradaEm: string;
}

const SEM_CATEGORIA = 'Sem categoria';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve o token e monta a planilha.
 *
 * Devolve `null` para qualquer falha de acesso — token inexistente, revogado
 * ou vencido. Quem chama não distingue os casos de propósito.
 */
export async function getPlanilhaPorToken(token: string): Promise<Planilha | null> {
  // Barra formatos impossíveis antes de ir ao banco: o token é sempre hex de
  // 64 chars, então qualquer outra coisa é sondagem e não merece uma query.
  if (!/^[0-9a-f]{64}$/u.test(token)) return null;

  const supabase = serviceClient();
  if (!supabase) {
    console.error('[planilha] service role ausente — a página pública não funciona sem ela.');
    return null;
  }

  const { data: link } = await supabase
    .from('obra_compartilhamentos')
    .select('obra_id, revogado_em, expira_em')
    .eq('token', token)
    .maybeSingle();

  if (!link || link.revogado_em) return null;
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) return null;

  const { data: obra } = await supabase
    .from('obras')
    .select('nome, cliente, orcamento, status')
    .eq('id', link.obra_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!obra) return null;

  // `recusado` e `erro` ficam de fora: são lançamento que o gestor rejeitou e
  // falha de processamento. Mostrar qualquer um dos dois pro cliente final
  // seria cobrar por algo que não é despesa da obra.
  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select(
      `id,
       data_pagamento,
       descricao,
       valor,
       fornecedores ( nome ),
       categorias ( nome ),
       documentos ( tipo, deleted_at )`,
    )
    .eq('obra_id', link.obra_id)
    .is('deleted_at', null)
    .in('status_pagto', ['confirmado', 'aguardando'])
    .order('data_pagamento', { ascending: true });

  const linhas: LinhaPlanilha[] = [];
  const categorias = new Map<string, SubtotalCategoria>();
  let acumulado = 0;

  for (const p of pagamentos ?? []) {
    const valor = Number(p.valor);
    acumulado += valor;

    const docs = (p.documentos ?? []) as Array<{ tipo: string; deleted_at: string | null }>;
    const vivos = docs.filter((d) => d.deleted_at === null);

    const fornecedor = (p.fornecedores as { nome: string } | null)?.nome ?? null;
    const categoria = (p.categorias as { nome: string } | null)?.nome ?? SEM_CATEGORIA;

    linhas.push({
      id: p.id,
      data: p.data_pagamento,
      descricao: p.descricao,
      fornecedor,
      categoria,
      valor,
      temNotaFiscal: vivos.some((d) => d.tipo === 'nota_fiscal'),
      temComprovante: vivos.some((d) => d.tipo === 'comprovante'),
      saldoAcumulado: acumulado,
    });

    const atual = categorias.get(categoria);
    categorias.set(categoria, {
      categoria,
      total: (atual?.total ?? 0) + valor,
      quantidade: (atual?.quantidade ?? 0) + 1,
    });
  }

  const orcamento = obra.orcamento == null ? null : Number(obra.orcamento);

  // Telemetria best-effort: saber se o cliente abriu é útil pro gestor, mas
  // não é motivo pra derrubar a página se o UPDATE falhar.
  // Aguardado: numa função serverless, o que não foi aguardado pode não rodar
  // depois da resposta. É uma RPC barata; falha só vira log.
  const { error: erroAcesso } = await supabase.rpc('registrar_acesso_compartilhamento', {
    p_token: token,
  });
  if (erroAcesso) {
    console.error('[planilha] falha ao registrar acesso:', erroAcesso.message);
  }

  return {
    obra: {
      nome: obra.nome,
      cliente: obra.cliente,
      orcamento,
      status: obra.status,
    },
    linhas,
    totalGeral: acumulado,
    porCategoria: [...categorias.values()].sort((a, b) => b.total - a.total),
    percentualOrcamento:
      orcamento && orcamento > 0 ? Math.round((acumulado / orcamento) * 100) : null,
    geradaEm: new Date().toISOString(),
  };
}
