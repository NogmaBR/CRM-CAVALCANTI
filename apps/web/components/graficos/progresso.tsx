import type { RitmoDaObra } from '@/lib/financeiro/agregacoes';
import './graficos.css';

/**
 * Barras de progresso em CSS puro (server component, sem Recharts): a de
 * dinheiro (contrato × gasto × recebido) e a de tempo (início → fim
 * previsto, com hoje marcado). Cada barra tem o número escrito ao lado — a
 * cor é reforço, não a informação.
 */

function brl(n: number): string {
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function dataBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function pctDe(parte: number, todo: number): number {
  if (todo <= 0) return 0;
  return Math.round((parte / todo) * 1000) / 10;
}

/**
 * Duas barras sobre o mesmo teto (o contrato, ou o maior valor quando não
 * há contrato): quanto o cliente já pagou e quanto a obra já gastou.
 */
export function BarraDeDinheiro({
  contrato,
  gasto,
  recebido,
}: {
  contrato: number | null;
  gasto: number;
  recebido: number;
}) {
  const teto = contrato != null && contrato > 0 ? contrato : Math.max(gasto, recebido, 1);
  const linhas: Array<{ rotulo: string; valor: number; classe: string }> = [
    { rotulo: 'Recebido do cliente', valor: recebido, classe: 'entra' },
    { rotulo: 'Gasto até agora', valor: gasto, classe: 'sai' },
  ];
  return (
    <div className="progresso">
      {linhas.map((l) => {
        const pct = pctDe(l.valor, teto);
        return (
          <div key={l.rotulo} className="progresso__linha">
            <div className="progresso__topo">
              <span className="progresso__rotulo">{l.rotulo}</span>
              <span className="progresso__valor">
                {brl(l.valor)}
                {contrato != null && contrato > 0 ? (
                  <small>
                    {' '}
                    · {pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% do contrato
                  </small>
                ) : null}
              </span>
            </div>
            <div
              className="progresso__trilho"
              role="meter"
              aria-valuenow={Math.min(100, pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={l.rotulo}
            >
              <div
                className={`progresso__preenchida progresso__preenchida--${l.classe}${pct > 100 ? ' progresso__preenchida--estouro' : ''}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="progresso__legenda">
        {contrato != null && contrato > 0 ? (
          <>
            A barra inteira é o contrato: <strong>{brl(contrato)}</strong>.
          </>
        ) : (
          'Sem valor de contrato, a barra inteira é o maior dos dois valores.'
        )}
      </div>
    </div>
  );
}

/** Linha do tempo do prazo: início → fim previsto, com "hoje" marcado. */
export function LinhaDoTempo({
  inicio,
  fim,
  ritmo,
}: {
  inicio: string | null;
  fim: string | null;
  ritmo: RitmoDaObra;
}) {
  if (!inicio || !fim || ritmo.prazoPct == null) {
    return (
      <div className="painel-chart-card__empty">
        {!inicio && !fim
          ? 'Informe as datas de início e fim previsto para ver o prazo.'
          : !inicio
            ? 'Falta a data de início.'
            : 'Falta a data prevista de fim.'}
      </div>
    );
  }
  const pct = Math.min(100, Math.max(0, ritmo.prazoPct));
  const vencido = ritmo.leitura === 'vencido';
  return (
    <div className="progresso">
      <div className="progresso__linha">
        <div className="progresso__topo">
          <span className="progresso__rotulo">Início · {dataBR(inicio)}</span>
          <span className="progresso__rotulo">Fim previsto · {dataBR(fim)}</span>
        </div>
        <div
          className="progresso__trilho progresso__trilho--tempo"
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Prazo decorrido"
        >
          <div
            className={`progresso__preenchida progresso__preenchida--tempo${vencido ? ' progresso__preenchida--estouro' : ''}`}
            style={{ width: `${pct}%` }}
          />
          <span className="progresso__hoje" style={{ left: `${pct}%` }}>
            <span className="progresso__hoje-rotulo">hoje</span>
          </span>
        </div>
        <div className="progresso__topo">
          <span className="progresso__valor">
            Dia {ritmo.diasDecorridos} de {ritmo.diasTotais}
            <small> · {Math.round(pct)}% do prazo</small>
          </span>
          <span className={`progresso__valor${vencido ? ' progresso__valor--alerta' : ''}`}>
            {vencido
              ? `venceu há ${Math.abs(ritmo.diasRestantes ?? 0)} dias`
              : `restam ${ritmo.diasRestantes} dias`}
          </span>
        </div>
      </div>
      {ritmo.gastoPct != null ? (
        <div className="progresso__linha">
          <div className="progresso__topo">
            <span className="progresso__rotulo">Dinheiro do contrato já gasto</span>
            <span className="progresso__valor">{Math.round(ritmo.gastoPct)}%</span>
          </div>
          <div className="progresso__trilho" aria-hidden="true">
            <div
              className={`progresso__preenchida progresso__preenchida--sai${ritmo.gastoPct > 100 ? ' progresso__preenchida--estouro' : ''}`}
              style={{ width: `${Math.min(100, ritmo.gastoPct)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
