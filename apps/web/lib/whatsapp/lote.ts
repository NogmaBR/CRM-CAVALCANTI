import type { UazapiInbound } from '@/lib/schemas/uazapi';
import type { DocCategoria } from '@/lib/status-labels';
import { CATEGORIA_LABELS } from '@/lib/status-labels';
import type { Opcao } from './escolha';
import { listaNumerada, valorLegivel } from './textos';

/**
 * Lote: mensagens do mesmo remetente, no mesmo chat, dentro da janela de
 * silêncio, tratadas como UMA entrada.
 *
 * Duas partes, ambas puras:
 *   - `planejarLote`: o que fazer com as mensagens (juntar textos, usar o
 *     texto como legenda das fotos, ou uma só);
 *   - `textoDoLote`: a resposta única depois que cada mídia foi processada
 *     ("Li 3 comprovantes: 1) … 2) … Responda SIM para lançar todos").
 */

export type PlanoDoLote =
  | { modo: 'unico'; payload: UazapiInbound }
  /** Só textos: viram uma mensagem, na ordem ("obra em uma, valor em outra"). */
  | { modo: 'texto_unido'; payload: UazapiInbound; idsAgrupados: string[] }
  /** Mídias, com os textos soltos virando legenda das que não tinham. */
  | { modo: 'midias'; payloads: UazapiInbound[]; idsDeTexto: string[] };

const TEM_MIDIA = new Set(['image', 'document', 'audio', 'video']);

export function planejarLote(mensagens: readonly UazapiInbound[]): PlanoDoLote {
  const ordenadas = [...mensagens].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  const primeira = ordenadas[0];
  if (!primeira) throw new Error('lote vazio');
  if (ordenadas.length === 1) return { modo: 'unico', payload: primeira };

  const midias = ordenadas.filter((m) => TEM_MIDIA.has(m.type) && m.media);
  const textos = ordenadas.filter((m) => !(TEM_MIDIA.has(m.type) && m.media));

  if (midias.length === 0) {
    const texto = textos
      .map((t) => t.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
    return {
      modo: 'texto_unido',
      payload: { ...primeira, text: texto, quotedId: ordenadas.find((m) => m.quotedId)?.quotedId },
      idsAgrupados: ordenadas.slice(1).map((m) => m.id),
    };
  }

  // Áudio não recebe legenda: ele É a fala. Foto, PDF e vídeo recebem.
  const legenda = textos
    .map((t) => t.text?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
  const semLegenda = midias.filter((m) => !m.text?.trim() && m.type !== 'audio');
  const alvoDaLegenda =
    semLegenda.length > 0 ? semLegenda : midias.filter((m) => m.type !== 'audio');
  const payloads = midias.map((m) => {
    if (!legenda || !alvoDaLegenda.includes(m)) return m;
    const proprio = m.text?.trim();
    return { ...m, text: proprio ? `${proprio} ${legenda}` : legenda };
  });
  return { modo: 'midias', payloads, idsDeTexto: textos.map((t) => t.id) };
}

// ---------------------------------------------------------------------------
// A resposta única
// ---------------------------------------------------------------------------

export interface ItemPagamento {
  n: number;
  valor: number | null;
  fornecedor: string | null;
  obra: string | null;
  descricao: string | null;
}

export interface ResumoDoLote {
  /** Comprovantes que viraram pendência de pagamento (com valor). */
  pagamentos: ItemPagamento[];
  /** Arquivos que não têm obra: uma pergunta para todos, com as opções. */
  semObra: { quantidade: number; opcoes: Opcao[] };
  /** Arquivos guardados, agrupados por obra e pasta. */
  guardados: Array<{ obra: string; pasta: DocCategoria; quantidade: number; link?: string | null }>;
  /** Anotações no diário, por obra. */
  anotados: Array<{ obra: string; quantidade: number }>;
  /** Mensagens que deram erro ou não tinham valor legível. */
  comProblema: number;
}

/** "3 arquivos" / "1 arquivo", "2 comprovantes"… */
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function textoDoLote(r: ResumoDoLote): string {
  const secoes: string[] = [];

  if (r.pagamentos.length > 0) {
    const linhas = [`Li ${plural(r.pagamentos.length, 'comprovante', 'comprovantes')}:`, ''];
    for (const p of r.pagamentos) {
      const partes = [
        p.valor != null ? valorLegivel(p.valor) : 'sem valor',
        p.fornecedor,
        p.obra,
        p.descricao,
      ]
        .filter(Boolean)
        .join(' · ');
      linhas.push(`${p.n}) ${partes}`);
    }
    linhas.push(
      '',
      'Responda *SIM* para lançar todos, ou *NÃO* para cancelar todos.',
      'Para mudar um só: "2 não", ou "2 é na INOX".',
    );
    secoes.push(linhas.join('\n'));
  }

  if (r.semObra.quantidade > 0) {
    secoes.push(
      [
        `Recebi ${plural(r.semObra.quantidade, 'arquivo', 'arquivos')}. *De qual obra?*`,
        '',
        listaNumerada(r.semObra.opcoes),
        '',
        'Responda só o *número* da obra: vale para todos.',
      ].join('\n'),
    );
  }

  for (const g of r.guardados) {
    const pasta = CATEGORIA_LABELS[g.pasta]?.rotulo ?? 'Outros';
    const linhas = [
      `📁 Guardei ${plural(g.quantidade, 'arquivo', 'arquivos')} na obra *${g.obra}*, pasta *${pasta}*.`,
    ];
    if (g.link) linhas.push(`Ver: ${g.link}`);
    secoes.push(linhas.join('\n'));
  }

  for (const a of r.anotados) {
    secoes.push(
      `📝 Anotei ${plural(a.quantidade, 'registro', 'registros')} no diário da obra *${a.obra}*.`,
    );
  }

  if (r.comProblema > 0) {
    secoes.push(
      `⚠️ ${plural(r.comProblema, 'arquivo ficou', 'arquivos ficaram')} sem leitura. O gestor vê no painel.`,
    );
  }

  return secoes.join('\n\n');
}
