import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { pareceUuid } from '@/lib/util/uuid';
import type { Database } from '@nogma/db';

export type MensagemWhats = Database['public']['Tables']['mensagens_whats']['Row'];
export type MsgStatus = Database['public']['Enums']['msg_status'];
export type MsgTipo = Database['public']['Enums']['msg_tipo'];

export interface MensagemFeedItem extends MensagemWhats {
  pagamento_valor: number | null;
  pagamento_obra_nome: string | null;
}

/**
 * Retorna as últimas N mensagens de WhatsApp (default 100), mais recentes
 * primeiro. Enriquece com valor + nome de obra do pagamento vinculado
 * quando existir (evita N+1 via batched lookup).
 */
export async function listMensagens(limit = 100): Promise<MensagemFeedItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('mensagens_whats')
    .select('*')
    .order('recebida_em', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao listar mensagens: ${error.message}`);
  const rows = data ?? [];

  const pagamentoIds = [
    ...new Set(rows.map((r) => r.pagamento_id).filter((v): v is string => !!v)),
  ];

  const pagamentosMap = new Map<string, { valor: number; obra_id: string }>();
  const obrasMap = new Map<string, string>();

  if (pagamentoIds.length > 0) {
    const { data: pagtos } = await supabase
      .from('pagamentos')
      .select('id, valor, obra_id')
      .in('id', pagamentoIds);

    for (const p of pagtos ?? []) {
      pagamentosMap.set(p.id, { valor: Number(p.valor), obra_id: p.obra_id });
    }

    const obraIds = [...new Set([...pagamentosMap.values()].map((p) => p.obra_id))];
    if (obraIds.length > 0) {
      const { data: obras } = await supabase.from('obras').select('id, nome').in('id', obraIds);
      for (const o of obras ?? []) obrasMap.set(o.id, o.nome);
    }
  }

  return rows.map((r) => {
    const pagto = r.pagamento_id ? pagamentosMap.get(r.pagamento_id) : undefined;
    return {
      ...r,
      pagamento_valor: pagto?.valor ?? null,
      pagamento_obra_nome: pagto ? (obrasMap.get(pagto.obra_id) ?? null) : null,
    };
  });
}

/**
 * Uma mensagem pelo id — para a página do pagamento mostrar a foto/áudio que
 * deu origem ao lançamento. `null` se não existe ou a RLS não deixa ver.
 */
export async function getMensagem(id: string): Promise<MensagemWhats | null> {
  if (!pareceUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mensagens_whats')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar mensagem: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Conversa (os dois lados)
// ---------------------------------------------------------------------------

export interface ConversaResumo {
  chatId: string;
  nome: string;
  ultimaEm: string;
  mensagens: number;
}

export interface BalaoDaConversa {
  id: string;
  lado: 'pessoa' | 'bot';
  quando: string;
  texto: string | null;
  /** Pessoa: nome do autorizado; bot: o tipo da resposta. */
  rotulo: string;
  tipo?: string;
  temArquivo?: boolean;
  status?: MsgStatus;
  /** Para onde a linha aponta no painel (pagamento, documento, pendência). */
  link?: { href: string; rotulo: string } | null;
}

/** Os chats com mensagem nos últimos dias, com nome do grupo quando cadastrado. */
export async function listConversas(limite = 30): Promise<ConversaResumo[]> {
  const supabase = await createClient();
  const [msgs, grupos] = await Promise.all([
    supabase
      .from('mensagens_whats')
      .select('chat_id, telefone_from, created_at')
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('whatsapp_grupos').select('chat_id, nome').is('deleted_at', null),
  ]);
  const nomes = new Map((grupos.data ?? []).map((g) => [g.chat_id, g.nome]));
  const porChat = new Map<string, ConversaResumo>();
  for (const m of msgs.data ?? []) {
    const chatId = m.chat_id ?? m.telefone_from;
    const atual = porChat.get(chatId);
    if (atual) {
      atual.mensagens += 1;
      continue;
    }
    porChat.set(chatId, {
      chatId,
      nome:
        nomes.get(chatId) ?? (m.chat_id ? 'Grupo sem cadastro' : formatTelefone(m.telefone_from)),
      ultimaEm: m.created_at ?? '',
      mensagens: 1,
    });
  }
  return [...porChat.values()].slice(0, limite);
}

function formatTelefone(digits: string): string {
  const s = digits.replace(/\D/gu, '');
  if (s.length === 13) return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
  if (s.length === 12) return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 8)}-${s.slice(8)}`;
  return digits;
}

const ROTULO_BOT: Record<string, string> = {
  pergunta_pendencia: 'Perguntou',
  lancado: 'Lançou',
  arquivado: 'Guardou',
  anotado: 'Anotou',
  acao_executada: 'Executou',
  resposta: 'Respondeu',
  aviso: 'Avisou',
};

/** A conversa de um chat, dos dois lados, em ordem de tempo. */
export async function listConversa(chatId: string, limite = 200): Promise<BalaoDaConversa[]> {
  const supabase = await createClient();
  const ehTelefone = !chatId.includes('@');
  let q = supabase
    .from('mensagens_whats')
    .select(
      'id, telefone_from, chat_id, tipo, status, texto_bruto, texto_transcrito, midia_storage_path, pagamento_id, documento_id, registro_id, created_at, autorizados(nome)',
    )
    .order('created_at', { ascending: false })
    .limit(limite);
  q = ehTelefone ? q.eq('telefone_from', chatId) : q.eq('chat_id', chatId);
  const [recebidas, enviadas] = await Promise.all([
    q,
    supabase
      .from('mensagens_enviadas')
      .select(
        'id, texto, tipo, confirmacao_id, pagamento_id, documento_id, registro_id, created_at',
      )
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limite),
  ]);

  const baloes: BalaoDaConversa[] = [];
  for (const m of recebidas.data ?? []) {
    const nome = (m as unknown as { autorizados?: { nome?: string } | null }).autorizados?.nome;
    baloes.push({
      id: m.id,
      lado: 'pessoa',
      quando: m.created_at ?? '',
      texto: m.texto_bruto ?? m.texto_transcrito,
      rotulo: nome ?? formatTelefone(m.telefone_from),
      tipo: m.tipo,
      temArquivo: !!m.midia_storage_path,
      status: m.status,
      link: m.pagamento_id
        ? { href: `/pagamentos/${m.pagamento_id}`, rotulo: 'ver pagamento' }
        : m.documento_id
          ? { href: `/documentos/${m.documento_id}`, rotulo: 'ver arquivo' }
          : m.status === 'classificada'
            ? { href: '/pendentes', rotulo: 'confirmar em Pendentes' }
            : null,
    });
  }
  for (const e of enviadas.data ?? []) {
    baloes.push({
      id: e.id,
      lado: 'bot',
      quando: e.created_at,
      texto: e.texto,
      rotulo: ROTULO_BOT[e.tipo] ?? 'Respondeu',
      tipo: e.tipo,
      link: e.pagamento_id
        ? { href: `/pagamentos/${e.pagamento_id}`, rotulo: 'ver pagamento' }
        : e.documento_id
          ? { href: `/documentos/${e.documento_id}`, rotulo: 'ver arquivo' }
          : e.confirmacao_id
            ? { href: '/pendentes', rotulo: 'ver pendência' }
            : null,
    });
  }
  baloes.sort((a, b) => a.quando.localeCompare(b.quando));
  return baloes;
}
