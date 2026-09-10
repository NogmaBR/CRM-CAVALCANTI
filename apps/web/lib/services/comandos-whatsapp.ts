import 'server-only';
import type { Comando } from '@/lib/whatsapp/comandos';
import type { Database } from '@nogma/db';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Execução dos comandos de texto do bot.
 *
 * Separado do reconhecimento (`lib/whatsapp/comandos.ts`) porque só esta
 * metade toca o banco. As respostas são texto de WhatsApp: curtas, sem
 * markdown de tabela, com `*negrito*` que é o que o app renderiza.
 *
 * Todas as consultas aqui são de leitura e agregam valores que o remetente já
 * pode ver no CRM — comando nenhum grava nada.
 */

type Client = SupabaseClient<Database>;

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const AJUDA_TEXTO = [
  'Posso ajudar com:',
  '',
  '• Mande a foto da nota ou o valor que eu lanço pra você',
  '• *resumo* — quanto foi gasto no mês',
  '• *pendências* — o que está esperando confirmação ou documento',
  '• *quanto gastei na obra X* — total de uma obra',
].join('\n');

export async function executarComando(supabase: Client, comando: Comando): Promise<string> {
  switch (comando.tipo) {
    case 'ajuda':
      return AJUDA_TEXTO;
    case 'resumo':
      return resumo(supabase);
    case 'pendencias':
      return pendencias(supabase);
    case 'gasto_obra':
      return gastoDaObra(supabase, comando.obra);
  }
}

/** Total do mês corrente + comparação com o mês anterior. */
async function resumo(supabase: Client): Promise<string> {
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().slice(0, 10);
  const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);

  const [mesAtual, mesPassado, obrasAtivas] = await Promise.all([
    supabase
      .from('pagamentos')
      .select('valor')
      .is('deleted_at', null)
      .in('status_pagto', ['confirmado', 'aguardando'])
      .gte('data_pagamento', inicioMes),
    supabase
      .from('pagamentos')
      .select('valor')
      .is('deleted_at', null)
      .in('status_pagto', ['confirmado', 'aguardando'])
      .gte('data_pagamento', inicioMesPassado)
      .lt('data_pagamento', inicioMes),
    supabase
      .from('obras')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('status', 'ativa'),
  ]);

  const total = (mesAtual.data ?? []).reduce((a, p) => a + Number(p.valor), 0);
  const totalAnterior = (mesPassado.data ?? []).reduce((a, p) => a + Number(p.valor), 0);
  const qtd = (mesAtual.data ?? []).length;

  const linhas = [
    `*Resumo de ${agora.toLocaleDateString('pt-BR', { month: 'long' })}*`,
    '',
    `Gasto no mês: *${formatBRL(total)}*`,
    `Lançamentos: ${qtd}`,
    `Obras ativas: ${obrasAtivas.count ?? 0}`,
  ];

  // A comparação só entra quando há base — dizer "+100%" contra um mês
  // passado zerado não informa nada.
  if (totalAnterior > 0) {
    const variacao = Math.round(((total - totalAnterior) / totalAnterior) * 100);
    const sinal = variacao >= 0 ? '+' : '';
    linhas.push(`Mês anterior: ${formatBRL(totalAnterior)} (${sinal}${variacao}%)`);
  }

  return linhas.join('\n');
}

/** Confirmações em aberto + pagamentos sem documento. */
async function pendencias(supabase: Client): Promise<string> {
  const corte = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);

  const [confirmacoes, semDoc] = await Promise.all([
    supabase
      .from('confirmacoes_pendentes')
      .select('*', { count: 'exact', head: true })
      .eq('resolvida', false),
    supabase
      .from('pagamentos')
      .select('id, valor, data_pagamento, documentos ( id, deleted_at )')
      .is('deleted_at', null)
      .in('status_pagto', ['confirmado', 'aguardando'])
      .lte('data_pagamento', corte)
      .order('data_pagamento', { ascending: true })
      .limit(200),
  ]);

  const faltando = (semDoc.data ?? []).filter((p) => {
    const docs = (p.documentos ?? []) as Array<{ id: string; deleted_at: string | null }>;
    return docs.every((d) => d.deleted_at !== null);
  });

  const aguardando = confirmacoes.count ?? 0;

  if (aguardando === 0 && faltando.length === 0) {
    return 'Tudo em dia ✅ Nenhuma confirmação pendente e nenhum pagamento sem documento.';
  }

  const linhas = ['*Pendências*', ''];

  if (aguardando > 0) {
    linhas.push(
      `${aguardando} ${aguardando === 1 ? 'mensagem aguardando' : 'mensagens aguardando'} confirmação`,
    );
  }

  if (faltando.length > 0) {
    const maisAntigo = faltando[0];
    const dias = maisAntigo
      ? Math.floor(
          (Date.now() - new Date(`${maisAntigo.data_pagamento}T00:00:00`).getTime()) / 86_400_000,
        )
      : 0;
    const idade = dias > 0 ? ` (o mais antigo há ${dias} dias)` : '';
    linhas.push(
      `${faltando.length} ${faltando.length === 1 ? 'pagamento' : 'pagamentos'} sem nota ou comprovante${idade}`,
    );
  }

  return linhas.join('\n');
}

/**
 * Total de uma obra, buscando por nome ou apelido.
 *
 * O gestor escreve "Recreio", não o nome completo cadastrado — por isso a
 * busca cobre `apelidos` além de `nome`. Se casar em mais de uma, devolve a
 * lista em vez de escolher: responder o valor da obra errada é pior do que
 * pedir pra ele desambiguar.
 */
async function gastoDaObra(supabase: Client, termo: string): Promise<string> {
  const { data: obras } = await supabase
    .from('obras')
    .select('id, nome, orcamento, apelidos')
    .is('deleted_at', null)
    .limit(200);

  const alvo = termo.toLowerCase();
  const casa = (texto: string) => {
    const t = texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    const a = alvo.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    return t.includes(a) || a.includes(t);
  };

  const candidatas = (obras ?? []).filter(
    (o) => casa(o.nome) || (o.apelidos ?? []).some((ap) => casa(ap)),
  );

  if (candidatas.length === 0) {
    return `Não achei nenhuma obra com "${termo}". Confira o nome ou cadastre um apelido pra ela no CRM.`;
  }

  if (candidatas.length > 1) {
    const nomes = candidatas
      .slice(0, 5)
      .map((o) => `• ${o.nome}`)
      .join('\n');
    return `Achei mais de uma obra com "${termo}":\n${nomes}\n\nQual delas?`;
  }

  const obra = candidatas[0];
  if (!obra) {
    return `Não achei nenhuma obra com "${termo}".`;
  }

  const { data: pagamentos } = await supabase
    .from('pagamentos')
    .select('valor')
    .eq('obra_id', obra.id)
    .is('deleted_at', null)
    .in('status_pagto', ['confirmado', 'aguardando']);

  const total = (pagamentos ?? []).reduce((a, p) => a + Number(p.valor), 0);
  const qtd = (pagamentos ?? []).length;

  const linhas = [
    `*${obra.nome}*`,
    '',
    `Total gasto: *${formatBRL(total)}*`,
    `Lançamentos: ${qtd}`,
  ];

  const orcamento = obra.orcamento == null ? null : Number(obra.orcamento);
  if (orcamento && orcamento > 0) {
    const pct = Math.round((total / orcamento) * 100);
    linhas.push(`Orçamento: ${formatBRL(orcamento)} (${pct}% consumido)`);
    if (pct > 100) {
      linhas.push(`⚠️ Estourou em ${formatBRL(total - orcamento)}`);
    } else if (pct > 80) {
      linhas.push(`⚠️ Restam ${formatBRL(orcamento - total)}`);
    }
  }

  return linhas.join('\n');
}
