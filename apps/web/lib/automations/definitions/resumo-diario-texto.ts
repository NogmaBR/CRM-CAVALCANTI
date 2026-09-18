import type { Alerta } from '@/lib/financeiro/agregacoes';

/**
 * O texto do resumo diário do semáforo (PM4) — puro, testado à parte da
 * automação. Curto, com números, uma linha por tipo de cadastro, os alertas
 * mais graves e o link para o painel. Quem recebe está no celular às 9h.
 */

export interface ResumoDeNiveisTexto {
  completo: number;
  parcial: number;
  critico: number;
  total: number;
}

export interface EntradaDoResumoDiario {
  /** AAAA-MM-DD (Brasília). */
  hoje: string;
  saude: {
    obras: ResumoDeNiveisTexto;
    pagamentos: ResumoDeNiveisTexto;
    fornecedores: ResumoDeNiveisTexto;
    documentos: ResumoDeNiveisTexto;
  };
  alertas: Alerta[];
  appUrl: string;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function dataLegivel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const data = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  return `${DIAS[data.getUTCDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function linhaDoCadastro(rotulo: string, r: ResumoDeNiveisTexto): string | null {
  const pend = r.parcial + r.critico;
  if (r.total === 0 || pend === 0) return null;
  const grave = r.critico > 0 ? ` (${r.critico} grave${r.critico === 1 ? '' : 's'})` : '';
  return `• ${rotulo}: ${pend} de ${r.total} com pendência${grave}`;
}

/** Quantos itens têm pendência, somando os quatro tipos. */
export function totalDePendencias(saude: EntradaDoResumoDiario['saude']): number {
  return Object.values(saude).reduce((a, r) => a + r.parcial + r.critico, 0);
}

export function montarResumoDiario(e: EntradaDoResumoDiario): string {
  const linhas: string[] = [`*Resumo do CRM — ${dataLegivel(e.hoje)}*`, ''];
  const total = totalDePendencias(e.saude);

  if (total === 0 && e.alertas.length === 0) {
    linhas.push('🟢 Tudo em dia: nenhum pagamento sem nota, nenhuma obra sem contrato, nenhum alerta.');
    linhas.push('', `Painel: ${e.appUrl}/painel`);
    return linhas.join('\n');
  }

  const cadastro = [
    linhaDoCadastro('Pagamentos', e.saude.pagamentos),
    linhaDoCadastro('Obras', e.saude.obras),
    linhaDoCadastro('Fornecedores', e.saude.fornecedores),
    linhaDoCadastro('Documentos', e.saude.documentos),
  ].filter((l): l is string => l !== null);
  if (cadastro.length > 0) {
    linhas.push(`🔴 *${total} ${total === 1 ? 'item' : 'itens'} com pendência de cadastro*`);
    linhas.push(...cadastro);
    linhas.push('');
  }

  const graves = e.alertas.filter((a) => a.gravidade === 'alta');
  const outros = e.alertas.filter((a) => a.gravidade !== 'alta');
  if (graves.length > 0) {
    linhas.push('⚠️ *Precisa de ação*');
    for (const a of graves.slice(0, 4)) linhas.push(`• ${a.titulo}`);
    linhas.push('');
  }
  if (outros.length > 0) {
    linhas.push('🟡 *Vale olhar*');
    for (const a of outros.slice(0, 3)) linhas.push(`• ${a.titulo}`);
    linhas.push('');
  }

  linhas.push(`Ver tudo: ${e.appUrl}/painel?aba=alertas`);
  return linhas.join('\n');
}

/** "5573998489747, (55) 32 98806-8174" → ["5573998489747", "5532988068174"], só os válidos. */
export function lerTelefones(texto: unknown): string[] {
  if (typeof texto !== 'string') return [];
  return texto
    .split(/[,;\n]+/u)
    .map((t) => t.replace(/\D+/gu, ''))
    .filter((t) => t.length >= 10 && t.length <= 13);
}
