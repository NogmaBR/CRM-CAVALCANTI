import { BarSerieMensal } from '@/components/graficos/bar-serie-mensal';
import { BarrasHorizontais } from '@/components/graficos/barras-horizontais';
import { Cartao, Tabela, brl } from '@/components/graficos/cartao';
import { getSerieMensal } from '@/lib/data/painel';
import { porExtensoCurto, somar } from '@/lib/financeiro/agregacoes';
import { STATUS_QUE_CONTAM } from '@/lib/status-labels';
import { createClient } from '@/lib/supabase/server';
import { hojeBR } from '@/lib/util/datas';
import Link from 'next/link';
import './fornecedor-graficos.css';

/**
 * O que este fornecedor recebeu: números do ano, mês a mês e por obra —
 * e quantos dos pagamentos dele estão sem nota (é o que a cobrança
 * automática vai pedir).
 */
export async function GraficosDoFornecedor({ fornecedorId }: { fornecedorId: string }) {
  const supabase = await createClient();
  const ano = hojeBR().slice(0, 4);
  const [serie, pagsR, docsR] = await Promise.all([
    getSerieMensal(12, { fornecedorId }),
    supabase
      .from('pagamentos')
      .select('id, obra_id, valor, data_pagamento, obras ( nome )')
      .eq('fornecedor_id', fornecedorId)
      .in('status_pagto', [...STATUS_QUE_CONTAM])
      .is('deleted_at', null)
      .order('data_pagamento', { ascending: false })
      .limit(5000),
    supabase
      .from('documentos')
      .select('pagamento_id')
      .eq('fornecedor_id', fornecedorId)
      .not('pagamento_id', 'is', null)
      .is('deleted_at', null)
      .limit(10000),
  ]);
  const pagamentos = pagsR.data ?? [];
  const comDocumento = new Set((docsR.data ?? []).map((d) => d.pagamento_id));
  const totalGeral = somar(pagamentos.map((p) => Number(p.valor)));
  const noAno = pagamentos.filter((p) => (p.data_pagamento ?? '').startsWith(ano));
  const totalNoAno = somar(noAno.map((p) => Number(p.valor)));
  const ultimo = pagamentos[0];
  const semNota = pagamentos.filter((p) => !comDocumento.has(p.id));

  const porObra = new Map<string, { nome: string; total: number; n: number }>();
  for (const p of pagamentos) {
    const obra = p.obras as { nome: string } | null;
    const nome = obra?.nome ?? 'Sem obra';
    const cur = porObra.get(p.obra_id) ?? { nome, total: 0, n: 0 };
    cur.total = Math.round((cur.total + Number(p.valor)) * 100) / 100;
    cur.n += 1;
    porObra.set(p.obra_id, cur);
  }
  const ranking = [...porObra.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.total - a.total);

  if (pagamentos.length === 0) {
    return (
      <p className="detail-layout__aviso">
        Nenhum pagamento a este fornecedor ainda. Quando houver, os gráficos aparecem aqui.
      </p>
    );
  }

  return (
    <>
      <div className="fornecedor-tiles">
        <div className="fornecedor-tile">
          <span className="fornecedor-tile__rotulo">Pago em {ano}</span>
          <strong className="fornecedor-tile__valor">{brl(totalNoAno)}</strong>
          <span className="fornecedor-tile__nota">
            {noAno.length} {noAno.length === 1 ? 'pagamento' : 'pagamentos'}
          </span>
        </div>
        <div className="fornecedor-tile">
          <span className="fornecedor-tile__rotulo">Pago no total</span>
          <strong className="fornecedor-tile__valor">{brl(totalGeral)}</strong>
          <span className="fornecedor-tile__nota">
            {pagamentos.length} {pagamentos.length === 1 ? 'pagamento' : 'pagamentos'}
          </span>
        </div>
        <div className="fornecedor-tile">
          <span className="fornecedor-tile__rotulo">Último pagamento</span>
          <strong className="fornecedor-tile__valor">
            {ultimo ? brl(Number(ultimo.valor)) : '—'}
          </strong>
          <span className="fornecedor-tile__nota">
            {ultimo?.data_pagamento
              ? ultimo.data_pagamento.split('-').reverse().join('/')
              : 'sem data'}
          </span>
        </div>
        <div
          className={`fornecedor-tile${semNota.length > 0 ? ' fornecedor-tile--alerta' : ' fornecedor-tile--ok'}`}
        >
          <span className="fornecedor-tile__rotulo">Sem nota ou comprovante</span>
          <strong className="fornecedor-tile__valor">{semNota.length}</strong>
          <span className="fornecedor-tile__nota">
            {semNota.length === 0 ? (
              'tudo comprovado'
            ) : (
              <Link href={`/pagamentos?fornecedor_id=${fornecedorId}&situacao=pendente`}>
                ver quais ({brl(somar(semNota.map((p) => Number(p.valor))))})
              </Link>
            )}
          </span>
        </div>
      </div>

      <div className="grade-de-cartoes" style={{ marginTop: 16 }}>
        <Cartao
          titulo="Quanto pagamos a este fornecedor por mês"
          leitura={
            <>
              Nos últimos 12 meses: <strong>{brl(serie.reduce((a, m) => a + m.total, 0))}</strong> (
              {porExtensoCurto(serie.reduce((a, m) => a + m.total, 0))}).
            </>
          }
          tabela={
            <Tabela
              cabecalho={['Mês', 'Pago', 'Pagamentos']}
              linhas={serie.map((m) => [m.label, brl(m.total), m.count])}
            />
          }
        >
          <BarSerieMensal data={serie} />
        </Cartao>

        <Cartao
          titulo="Em quais obras este fornecedor trabalhou"
          leitura={
            ranking[0] ? (
              <>
                A obra que mais pagou a ele foi <strong>{ranking[0].nome}</strong>:{' '}
                {brl(ranking[0].total)}.
              </>
            ) : null
          }
          tabela={
            <Tabela
              cabecalho={['Obra', 'Total', 'Pagamentos']}
              linhas={ranking.map((r) => [
                <Link key={r.id} href={`/obras/${r.id}`}>
                  {r.nome}
                </Link>,
                brl(r.total),
                r.n,
              ])}
            />
          }
        >
          <BarrasHorizontais
            data={ranking.map((r) => ({
              nome: r.nome,
              valor: r.total,
              detalhe: `${r.n} pagamento(s)`,
            }))}
          />
        </Cartao>
      </div>
    </>
  );
}
