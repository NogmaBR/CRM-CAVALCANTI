import { EmptyState } from '@/components/nogma/EmptyState';
import { dadosPorObra } from '@/lib/data/painel-empresario';
import { porExtensoCurto, rotuloDoMes } from '@/lib/financeiro/agregacoes';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { Cartao, Tabela, brl, pct } from '../cartao';
import { BarrasPorObra } from '../charts/barras-por-obra';
import { EmpilhadoMensal } from '../charts/empilhado-mensal';

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
