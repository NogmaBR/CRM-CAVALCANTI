import { BarSerieMensal } from '@/components/graficos/bar-serie-mensal';
import { Cartao, Tabela, brl } from '@/components/graficos/cartao';
import { DonutCategoria } from '@/components/graficos/donut-categoria';
import { BarraDeDinheiro, LinhaDoTempo } from '@/components/graficos/progresso';
import { getGastoPorCategoria, getSerieMensal } from '@/lib/data/painel';
import {
  type RitmoDaObra,
  fraseDoRitmo,
  porExtensoCurto,
  ritmoDaObra,
} from '@/lib/financeiro/agregacoes';
import type { ResumoFinanceiroDaObra } from '@/lib/financeiro/resumo-obra';
import { hojeBR } from '@/lib/util/datas';
import Link from 'next/link';

/**
 * Os gráficos da obra: dinheiro (contrato × gasto × recebido), prazo
 * (início → fim, com hoje), gasto mês a mês e por etapa. Cada um num
 * `Cartao` com a frase de leitura e a tabela — a regra do painel.
 */
export async function GraficosDaObra({
  obra,
  resumo,
}: {
  obra: {
    id: string;
    data_inicio: string | null;
    data_prevista_fim: string | null;
    status: string | null;
  };
  resumo: ResumoFinanceiroDaObra;
}) {
  const [serie, etapas] = await Promise.all([
    getSerieMensal(12, { obraId: obra.id }),
    getGastoPorCategoria(6, { obraId: obra.id, meses: null }),
  ]);
  const ritmo: RitmoDaObra = ritmoDaObra({
    hoje: hojeBR(),
    data_inicio: obra.data_inicio,
    data_prevista_fim: obra.data_prevista_fim,
    gasto: resumo.gasto,
    contrato: resumo.contrato,
  });
  const mesMaisCaro = [...serie].sort((a, b) => b.total - a.total)[0];
  const totalNoAno = serie.reduce((a, m) => a + m.total, 0);
  const maiorEtapa = etapas[0];
  const totalEtapas = etapas.reduce((a, e) => a + e.total, 0);
  const pctRecebido =
    resumo.contrato != null && resumo.contrato > 0
      ? Math.round((resumo.recebido / resumo.contrato) * 100)
      : null;
  const faltaReceber =
    resumo.contrato != null ? Math.max(0, resumo.contrato - resumo.recebido) : null;

  return (
    <div className="grade-de-cartoes">
      <Cartao
        titulo="Contrato, gasto e recebido"
        leitura={
          resumo.contrato == null ? (
            <>
              Sem o valor do contrato não dá para saber quanto falta receber nem a margem.{' '}
              <Link href={`/obras/${obra.id}/editar`}>Informar o contrato</Link>.
            </>
          ) : (
            <>
              O cliente já pagou <strong>{pctRecebido}%</strong> do contrato e a obra já gastou{' '}
              <strong>{Math.round(resumo.percentualGastoDoContrato ?? 0)}%</strong>.
              {faltaReceber != null && faltaReceber > 0
                ? ` Falta receber ${brl(faltaReceber)} (${porExtensoCurto(faltaReceber)}).`
                : ' O contrato está todo recebido.'}
            </>
          )
        }
      >
        <BarraDeDinheiro
          contrato={resumo.contrato}
          gasto={resumo.gasto}
          recebido={resumo.recebido}
        />
      </Cartao>

      <Cartao
        titulo="Prazo da obra"
        leitura={
          obra.status !== 'ativa' && obra.status != null
            ? 'Obra não está ativa; o prazo é só histórico.'
            : fraseDoRitmo(ritmo)
        }
      >
        <LinhaDoTempo inicio={obra.data_inicio} fim={obra.data_prevista_fim} ritmo={ritmo} />
      </Cartao>

      <Cartao
        titulo="Quanto esta obra gastou por mês"
        largo
        leitura={
          totalNoAno === 0 ? (
            'Nenhum pagamento nos últimos 12 meses.'
          ) : (
            <>
              Nos últimos 12 meses saíram <strong>{brl(totalNoAno)}</strong> (
              {porExtensoCurto(totalNoAno)}).
              {mesMaisCaro && mesMaisCaro.total > 0
                ? ` O mês mais caro foi ${mesMaisCaro.label}, com ${brl(mesMaisCaro.total)}.`
                : ''}
            </>
          )
        }
        tabela={
          <Tabela
            cabecalho={['Mês', 'Gasto', 'Pagamentos']}
            linhas={serie.map((m) => [m.label, brl(m.total), m.count])}
            rodape={['Total', brl(totalNoAno), serie.reduce((a, m) => a + m.count, 0)]}
          />
        }
      >
        <BarSerieMensal data={serie} />
      </Cartao>

      <Cartao
        titulo="Para onde o dinheiro desta obra foi, por etapa"
        largo
        leitura={
          maiorEtapa ? (
            <>
              A maior fatia é <strong>{maiorEtapa.nome}</strong>: {brl(maiorEtapa.total)} (
              {totalEtapas > 0 ? Math.round((maiorEtapa.total / totalEtapas) * 100) : 0}% do gasto).
            </>
          ) : (
            'Nenhum pagamento com etapa ainda.'
          )
        }
        tabela={
          <Tabela
            cabecalho={['Etapa', 'Total', 'Pagamentos']}
            linhas={etapas.map((e) => [e.nome, brl(e.total), e.count])}
            rodape={['Total', brl(totalEtapas), etapas.reduce((a, e) => a + e.count, 0)]}
          />
        }
      >
        <DonutCategoria data={etapas} />
      </Cartao>
    </div>
  );
}
