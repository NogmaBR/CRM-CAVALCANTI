import { CaixaMensal, SaldoAcumulado } from '@/components/graficos/caixa';
import { Cartao, Tabela, brl, pct } from '@/components/graficos/cartao';
import { dadosCaixa } from '@/lib/data/painel-empresario';
import { porExtensoCurto } from '@/lib/financeiro/agregacoes';
import Link from 'next/link';

export async function AbaCaixa() {
  const d = await dadosCaixa();
  const ultimo = d.mensal.at(-1);
  const positivo = d.totais.saldo >= 0;
  const semRecebimento = d.totais.entrou === 0;

  return (
    <div className="painel-abas__grade">
      <div className="painel-resumo-caixa">
        <div className="painel-resumo-caixa__item">
          <span className="painel-resumo-caixa__rotulo">Entrou (clientes)</span>
          <strong>{brl(d.totais.entrou)}</strong>
        </div>
        <div className="painel-resumo-caixa__item">
          <span className="painel-resumo-caixa__rotulo">Saiu (pagamentos)</span>
          <strong>{brl(d.totais.saiu)}</strong>
        </div>
        <div
          className={`painel-resumo-caixa__item painel-resumo-caixa__item--${positivo ? 'ok' : 'alerta'}`}
        >
          <span className="painel-resumo-caixa__rotulo">Saldo</span>
          <strong>{brl(d.totais.saldo)}</strong>
        </div>
        <div className="painel-resumo-caixa__item">
          <span className="painel-resumo-caixa__rotulo">Falta receber dos contratos</span>
          <strong>{brl(d.totais.faltaReceber)}</strong>
        </div>
      </div>

      {semRecebimento ? (
        <p className="painel-aviso">
          Nenhum recebimento registrado ainda. Registre o que os clientes já pagaram em Obras › a
          obra › Recebimentos do cliente (ou pelo WhatsApp: "recebi 50 mil do cliente da
          Garibaldi").
        </p>
      ) : null}

      <Cartao
        titulo="Entrou × saiu, mês a mês (últimos 12 meses)"
        largo
        leitura={
          ultimo ? (
            <>
              Em {ultimo.label} entraram {brl(ultimo.entrou)} e saíram {brl(ultimo.saiu)}: saldo do
              mês de <strong>{brl(ultimo.saldo)}</strong> ({porExtensoCurto(ultimo.saldo)}).
            </>
          ) : null
        }
        tabela={
          <Tabela
            cabecalho={['Mês', 'Entrou', 'Saiu', 'Saldo do mês', 'Acumulado']}
            linhas={d.mensal.map((m) => [
              m.label,
              brl(m.entrou),
              brl(m.saiu),
              brl(m.saldo),
              brl(m.acumulado),
            ])}
          />
        }
      >
        <CaixaMensal data={d.mensal} />
      </Cartao>

      <Cartao
        titulo="Saldo acumulado nos 12 meses"
        largo
        leitura={
          ultimo ? (
            <>
              Somando mês a mês, o caixa das obras está em <strong>{brl(ultimo.acumulado)}</strong>{' '}
              ({porExtensoCurto(ultimo.acumulado)}). Abaixo da linha tracejada, saiu mais do que
              entrou.
            </>
          ) : null
        }
      >
        <SaldoAcumulado data={d.mensal} />
      </Cartao>

      <Cartao
        titulo="Contratos × recebido: quanto falta receber de cada obra"
        largo
        leitura={
          <>
            Os contratos das obras em andamento somam <strong>{brl(d.totais.contratos)}</strong>.
            Falta receber {brl(d.totais.faltaReceber)} ({porExtensoCurto(d.totais.faltaReceber)}).
            {d.porObra.some((l) => l.contrato == null)
              ? ' Obra sem contrato informado fica de fora dessa conta.'
              : ''}
          </>
        }
      >
        <Tabela
          cabecalho={['Obra', 'Contrato', 'Recebido', '% recebido', 'Falta receber', 'Gasto']}
          linhas={d.porObra.map((l) => [
            <Link key={l.obra_id} href={`/obras/${l.obra_id}`}>
              {l.obra}
            </Link>,
            brl(l.contrato),
            brl(l.recebido),
            l.contrato ? pct(Math.round((l.recebido / l.contrato) * 1000) / 10) : '—',
            l.contrato ? brl(Math.max(0, l.contrato - l.recebido)) : '—',
            brl(l.gasto),
          ])}
        />
      </Cartao>
    </div>
  );
}
