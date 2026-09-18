import { Card } from '@/components/nogma/Card';
import type { Completude } from '@/lib/completude/regras';
import type { Pagamento } from '@/lib/data/pagamentos';
import { porExtensoCurto } from '@/lib/financeiro/agregacoes';
import { formatBRL } from '@/lib/schemas/pagamento';
import {
  PAGAMENTO_STATUS_LABEL,
  type PagamentoStatus,
  STATUS_QUE_CONTAM,
} from '@/lib/status-labels';
import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import './resumo.css';

/**
 * O cartão do topo da lista de pagamentos: o total do que está na tela, a
 * barra por status (aprovado · pendente · recusado · erro) e o contador
 * vermelho de quantos estão sem comprovante — com quanto dinheiro isso
 * representa. Tudo calculado da lista já filtrada.
 */
const ORDEM: PagamentoStatus[] = ['confirmado', 'aguardando', 'recusado', 'erro'];
const COR: Record<PagamentoStatus, string> = {
  confirmado: 'var(--serie-entra)',
  aguardando: 'var(--warning)',
  recusado: 'var(--danger)',
  erro: 'var(--text-secondary)',
};

export function ResumoDosPagamentos({
  pagamentos,
  completude,
}: {
  pagamentos: Pagamento[];
  completude: Map<string, Completude>;
}) {
  const contam = pagamentos.filter((p) =>
    (STATUS_QUE_CONTAM as readonly string[]).includes(p.status_pagto ?? 'confirmado'),
  );
  const total = contam.reduce((s, p) => s + Number(p.valor), 0);
  const porStatus = ORDEM.map((st) => {
    const lista = pagamentos.filter((p) => (p.status_pagto ?? 'confirmado') === st);
    return { status: st, n: lista.length, valor: lista.reduce((s, p) => s + Number(p.valor), 0) };
  }).filter((x) => x.n > 0);
  const semComprovante = pagamentos.filter((p) =>
    completude.get(p.id)?.faltas.some((f) => f.chave === 'comprovante'),
  );
  const valorSemComprovante = semComprovante.reduce((s, p) => s + Number(p.valor), 0);
  const n = pagamentos.length;

  return (
    <Card className="resumo-pag">
      <div className="resumo-pag__total">
        <span className="resumo-pag__rotulo">Total do que está na tela</span>
        <span className="resumo-pag__valor">{formatBRL(total)}</span>
        <span className="resumo-pag__nota">
          {porExtensoCurto(total)} · {contam.length}{' '}
          {contam.length === 1 ? 'pagamento' : 'pagamentos'} que contam
          {n !== contam.length ? ` (${n} no total, com recusados e erros)` : ''}
        </span>
      </div>

      <div className="resumo-pag__status">
        <span className="resumo-pag__rotulo">Por status</span>
        {n === 0 ? (
          <span className="resumo-pag__nota">Nenhum pagamento com estes filtros.</span>
        ) : (
          <>
            <div className="resumo-pag__barra" role="img" aria-label="Pagamentos por status">
              {porStatus.map((x) => (
                <span
                  key={x.status}
                  className="resumo-pag__trecho"
                  style={{ flexBasis: `${(x.n / n) * 100}%`, background: COR[x.status] }}
                  title={`${PAGAMENTO_STATUS_LABEL[x.status]}: ${x.n}`}
                />
              ))}
            </div>
            <ul className="resumo-pag__legenda">
              {porStatus.map((x) => (
                <li key={x.status}>
                  <span className="resumo-pag__cor" style={{ background: COR[x.status] }} />
                  {PAGAMENTO_STATUS_LABEL[x.status]} <strong>{x.n}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div
        className={`resumo-pag__sem-nota${semComprovante.length > 0 ? ' resumo-pag__sem-nota--alerta' : ''}`}
      >
        <span className="resumo-pag__rotulo">Sem comprovante</span>
        <span className="resumo-pag__valor resumo-pag__valor--n">
          {semComprovante.length > 0 ? <TriangleAlert size={20} aria-hidden="true" /> : null}
          {semComprovante.length}
        </span>
        <span className="resumo-pag__nota">
          {semComprovante.length === 0 ? (
            'Tudo comprovado.'
          ) : (
            <>
              {formatBRL(valorSemComprovante)} sem nota nem comprovante.{' '}
              <Link href="/pendentes">Ver pendências</Link>
            </>
          )}
        </span>
      </div>
    </Card>
  );
}
