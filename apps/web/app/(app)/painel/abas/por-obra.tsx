import { BarrasPorObra } from '@/components/graficos/barras-por-obra';
import { Cartao, Tabela, brl, pct } from '@/components/graficos/cartao';
import { EmpilhadoMensal } from '@/components/graficos/empilhado-mensal';
import { LinhaDoTempo } from '@/components/graficos/progresso';
import { EmptyState } from '@/components/nogma/EmptyState';
import { dadosPorObra } from '@/lib/data/painel-empresario';
import { fraseDoRitmo, porExtensoCurto, rotuloDoMes } from '@/lib/financeiro/agregacoes';
import { Building2 } from 'lucide-react';
import Link from 'next/link';

export async function AbaPorObra() {
  const d = await dadosPorObra();
  if (d.linhas.length === 0) {
    return (
      <EmptyState
        icon={<Building2 size={24} aria-hidden="true" />}
        title="Nenhuma obra em andamento"
      >
        Cadastre uma obra para ver os gastos aqui.
      </EmptyState>
    );
  }

  const maisCara = [...d.linhas].sort((a, b) => b.gasto - a.gasto)[0];
  const totalGasto = d.linhas.reduce((a, l) => a + l.gasto, 0);
  const mesAtual = d.mensal.at(-1);
  const mesAnterior = d.mensal.at(-2);
  const obraDoMes = mesAtual
    ? [...d.obras].sort((a, b) => Number(mesAtual[b] ?? 0) - Number(mesAtual[a] ?? 0))[0]
    : null;

  return (
    <div className="painel-abas__grade">
      <Cartao
        titulo="Quanto cada obra já custou, e quanto o cliente já pagou"
        largo
        leitura={
          maisCara ? (
            <>
              A obra que mais gastou até hoje é <strong>{maisCara.obra}</strong>:{' '}
              {brl(maisCara.gasto)} ({porExtensoCurto(maisCara.gasto)}). Somando as{' '}
              {d.linhas.length} obras, foram {brl(totalGasto)} ({porExtensoCurto(totalGasto)}).
              {d.linhas.some((l) => l.contrato == null)
                ? ' Obra sem valor de contrato não mostra a margem — informe em Obras › Editar.'
                : ''}
            </>
          ) : null
        }
        tabela={
          <Tabela
            cabecalho={[
              'Obra',
              'Gasto',
              'Recebido',
              'Contrato',
              'Resultado',
              'Margem prevista',
              'Pagamentos',
            ]}
            linhas={d.linhas.map((l) => [
              <Link key={l.obra_id} href={`/obras/${l.obra_id}`}>
                {l.obra}
              </Link>,
              brl(l.gasto),
              brl(l.recebido),
              brl(l.contrato),
              brl(l.resultado),
              brl(l.margem_prevista),
              l.pagamentos,
            ])}
            rodape={[
              'Total',
              brl(totalGasto),
              brl(d.linhas.reduce((a, l) => a + l.recebido, 0)),
              brl(d.linhas.reduce((a, l) => a + (l.contrato ?? 0), 0)),
              brl(d.linhas.reduce((a, l) => a + l.resultado, 0)),
              '',
              d.linhas.reduce((a, l) => a + l.pagamentos, 0),
            ]}
          />
        }
      >
        <BarrasPorObra
          data={d.linhas.map((l) => ({ obra: l.obra, gasto: l.gasto, recebido: l.recebido }))}
        />
      </Cartao>

      <Cartao
        titulo="Gasto de cada obra, mês a mês (últimos 6 meses)"
        largo
        leitura={
          mesAtual && obraDoMes ? (
            <>
              Em {rotuloDoMes(String(mesAtual.mes))} a obra que mais gastou foi{' '}
              <strong>{obraDoMes}</strong> ({brl(Number(mesAtual[obraDoMes] ?? 0))}). O mês fechou
              em {brl(Number(mesAtual.total))}
              {mesAnterior && Number(mesAnterior.total) > 0
                ? `, contra ${brl(Number(mesAnterior.total))} no mês anterior.`
                : '.'}
            </>
          ) : null
        }
        tabela={
          <Tabela
            cabecalho={['Mês', ...d.obras, 'Total']}
            linhas={d.mensal.map((m) => [
              String(m.label),
              ...d.obras.map((o) => brl(Number(m[o] ?? 0))),
              brl(Number(m.total)),
            ])}
          />
        }
      >
        <EmpilhadoMensal data={d.mensal} series={d.obras} />
      </Cartao>

      <Cartao
        titulo="Prazo de cada obra: quanto do tempo passou, quanto do dinheiro saiu"
        largo
        leitura={
          d.ritmo.some((r) => r.ritmo.leitura === 'vencido') ? (
            <>
              <strong>
                {d.ritmo
                  .filter((r) => r.ritmo.leitura === 'vencido')
                  .map((r) => r.obra)
                  .join(', ')}
              </strong>{' '}
              já{' '}
              {d.ritmo.filter((r) => r.ritmo.leitura === 'vencido').length === 1
                ? 'passou'
                : 'passaram'}{' '}
              do prazo previsto. Atualize a data ou marque como concluída.
            </>
          ) : d.ritmo.some((r) => r.ritmo.leitura === 'na_frente') ? (
            <>
              Em{' '}
              <strong>
                {d.ritmo
                  .filter((r) => r.ritmo.leitura === 'na_frente')
                  .map((r) => r.obra)
                  .join(', ')}
              </strong>{' '}
              o dinheiro está saindo mais rápido que o tempo — vale conferir se o contrato vai dar.
            </>
          ) : d.ritmo.every((r) => r.ritmo.prazoPct == null) ? (
            'Nenhuma obra tem data de início e fim previsto. Informe em Obras › Editar para acompanhar o prazo.'
          ) : (
            'O ritmo das obras está em dia: o dinheiro acompanha o tempo.'
          )
        }
        tabela={
          <Tabela
            cabecalho={['Obra', 'Prazo usado', 'Contrato gasto', 'Restam', 'Leitura']}
            linhas={d.ritmo.map((r) => [
              <Link key={r.obra_id} href={`/obras/${r.obra_id}`}>
                {r.obra}
              </Link>,
              r.ritmo.prazoPct == null ? '—' : pct(Math.min(100, r.ritmo.prazoPct)),
              r.ritmo.gastoPct == null ? '—' : pct(r.ritmo.gastoPct),
              r.ritmo.diasRestantes == null
                ? '—'
                : r.ritmo.diasRestantes < 0
                  ? `venceu há ${Math.abs(r.ritmo.diasRestantes)} d`
                  : `${r.ritmo.diasRestantes} d`,
              fraseDoRitmo(r.ritmo),
            ])}
          />
        }
      >
        <div className="painel-ritmo">
          {d.ritmo.map((r) => (
            <div key={r.obra_id} className="painel-ritmo__obra">
              <Link href={`/obras/${r.obra_id}`} className="painel-ritmo__nome">
                {r.obra}
              </Link>
              <LinhaDoTempo inicio={r.data_inicio} fim={r.data_prevista_fim} ritmo={r.ritmo} />
            </div>
          ))}
        </div>
      </Cartao>

      {d.etapas.map((e) => (
        <Cartao
          key={e.obra}
          titulo={`Em que etapa está indo o dinheiro — ${e.obra}`}
          leitura={
            e.etapas[0] ? (
              <>
                A maior parte foi para <strong>{e.etapas[0].etapa}</strong>: {pct(e.etapas[0].pct)}{' '}
                do total de {brl(e.total)}.
              </>
            ) : (
              'Ainda não há pagamentos nesta obra.'
            )
          }
        >
          <ol className="lista-etapas">
            {e.etapas.map((et) => (
              <li key={et.etapa} className="lista-etapas__item">
                <span className="lista-etapas__nome">{et.etapa}</span>
                <span className="lista-etapas__barra" aria-hidden="true">
                  <span className="lista-etapas__preenchida" style={{ width: `${et.pct}%` }} />
                </span>
                <span className="lista-etapas__valor">
                  {brl(et.total)} <small>({pct(et.pct)})</small>
                </span>
              </li>
            ))}
          </ol>
        </Cartao>
      ))}
    </div>
  );
}
