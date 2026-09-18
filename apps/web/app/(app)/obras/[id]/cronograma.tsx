import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { EtapaObra, ResumoDoCronograma } from '@/lib/data/cronograma';
import {
  type LinhaOrcadoRealizado,
  type SituacaoDaEtapa,
  fraseDoTripe,
} from '@/lib/financeiro/cronograma';
import { Archive, ListPlus } from 'lucide-react';
import type { EstadoDoFormulario } from '../../_shared/form-erros';
import {
  arquivarEtapa,
  arquivarOrcamentoEtapa,
  criarEtapa,
  criarEtapasDoPlano,
  medirEtapa,
  salvarOrcamentoEtapa,
} from './cronograma/actions';
import './cronograma.css';

/**
 * PM1 + PM2 na tela da obra: o cronograma físico (etapas com % concluído,
 * medição inline) e o orçado × realizado por etapa. Server components; os
 * formulários vão para as server actions com o padrão de erro do projeto.
 */

function brl(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function dataBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

const SITUACAO_ROTULO: Record<SituacaoDaEtapa, string> = {
  ok: 'dentro do orçado',
  atencao: 'perto do limite',
  estourado: 'acima do orçado',
  sem_orcado: 'sem orçado',
};

export function CronogramaFisico({
  obraId,
  resumo,
  financeiroPct,
  prazoPct,
  estado,
  podeEscrever,
}: {
  obraId: string;
  resumo: ResumoDoCronograma;
  financeiroPct: number | null;
  prazoPct: number | null;
  estado: EstadoDoFormulario;
  podeEscrever: boolean;
}) {
  const v = estado.valores ?? {};
  const erroDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);
  const avanco = resumo.avancoFisico;

  return (
    <div className="cronograma" id="cronograma">
      <div className="cronograma__tripe">
        <Medidor rotulo="Obra executada" pct={avanco} classe="fisico" />
        <Medidor rotulo="Contrato gasto" pct={financeiroPct} classe="financeiro" />
        <Medidor rotulo="Prazo usado" pct={prazoPct} classe="prazo" />
      </div>
      <p className="cronograma__leitura">
        {fraseDoTripe({ fisicoPct: avanco, financeiroPct, prazoPct })}
      </p>

      {resumo.etapas.length === 0 ? (
        <div className="cronograma__vazio">
          <p>
            Nenhuma etapa ainda. Crie as etapas a partir do plano de contas (uma por categoria que
            já tem gasto) ou adicione uma a uma. Depois, atualize o % pelo painel ou mande no grupo:{' '}
            <em>"laje 100%"</em>.
          </p>
          {podeEscrever ? (
            <form action={criarEtapasDoPlano}>
              <input type="hidden" name="obra_id" value={obraId} />
              <Button type="submit" variant="secondary" leadingIcon={<ListPlus size={14} />}>
                Criar etapas do plano de contas
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <ol className="cronograma__etapas" aria-label="Etapas da obra">
          {resumo.etapas.map((e) => (
            <EtapaLinha
              key={e.id}
              etapa={e}
              obraId={obraId}
              podeEscrever={podeEscrever}
              estado={estado}
            />
          ))}
        </ol>
      )}

      {podeEscrever ? (
        <form action={criarEtapa} className="cronograma__form">
          <input type="hidden" name="obra_id" value={obraId} />
          <Input
            label="Nova etapa"
            name="nome"
            placeholder="ex.: Laje do 2º piso"
            defaultValue={v.nome ?? ''}
            error={erroDe('nome')}
            autoFocus={estado.campo === 'nome'}
            required
          />
          <Input
            label="Peso"
            name="peso"
            inputMode="decimal"
            placeholder="1"
            defaultValue={v.peso ?? ''}
            error={erroDe('peso')}
          />
          <Input
            label="% já feito"
            name="percentual_concluido"
            inputMode="numeric"
            placeholder="0"
            defaultValue={v.percentual_concluido ?? ''}
            error={erroDe('percentual_concluido')}
          />
          <label className="ng-field">
            <span className="ng-field__label">Etapa do plano de contas</span>
            <select
              name="categoria_id"
              className="cronograma__select"
              defaultValue={v.categoria_id ?? ''}
            >
              <option value="">— nenhuma —</option>
              {resumo.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Prevista para"
            name="data_prevista"
            type="date"
            defaultValue={v.data_prevista ?? ''}
            error={erroDe('data_prevista')}
          />
          <div className="cronograma__form-acao">
            <Button type="submit">Adicionar etapa</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Medidor({
  rotulo,
  pct,
  classe,
}: {
  rotulo: string;
  pct: number | null;
  classe: 'fisico' | 'financeiro' | 'prazo';
}) {
  const largura = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className={`medidor medidor--${classe}`}>
      <div className="medidor__topo">
        <span className="medidor__rotulo">{rotulo}</span>
        <strong className="medidor__valor">{pct == null ? '—' : `${Math.round(pct)}%`}</strong>
      </div>
      <div
        className="medidor__trilho"
        role="meter"
        aria-valuenow={largura}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo}
      >
        <div
          className={`medidor__preenchida${pct != null && pct > 100 ? ' medidor__preenchida--estouro' : ''}`}
          style={{ width: `${largura}%` }}
        />
      </div>
    </div>
  );
}

function EtapaLinha({
  etapa,
  obraId,
  podeEscrever,
  estado,
}: {
  etapa: EtapaObra;
  obraId: string;
  podeEscrever: boolean;
  estado: EstadoDoFormulario;
}) {
  const pct = etapa.percentual_concluido;
  const campo = `percentual_${etapa.id}`;
  const erro = estado.campo === campo ? estado.error : undefined;
  return (
    <li className={`etapa${pct >= 100 ? ' etapa--concluida' : ''}`}>
      <div className="etapa__cabeca">
        <span className="etapa__nome">
          {etapa.nome}
          {etapa.peso !== 1 ? <small> · peso {etapa.peso}</small> : null}
        </span>
        <span className="etapa__meta">
          {etapa.medido_em ? `medido em ${dataBR(etapa.medido_em)}` : 'sem medição'}
          {etapa.data_prevista ? ` · prevista ${dataBR(etapa.data_prevista)}` : ''}
          {etapa.origem === 'whatsapp' ? ' · via WhatsApp' : ''}
        </span>
      </div>
      <div
        className="etapa__barra"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${etapa.nome}: ${pct}% concluído`}
      >
        <div className="etapa__preenchida" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {podeEscrever ? (
        <div className="etapa__acoes">
          <form action={medirEtapa} className="etapa__medir">
            <input type="hidden" name="id" value={etapa.id} />
            <input type="hidden" name="obra_id" value={obraId} />
            <Input
              aria-label={`Percentual concluído de ${etapa.nome}`}
              name="percentual_concluido"
              inputMode="numeric"
              defaultValue={String(pct)}
              error={erro}
              autoFocus={!!erro}
              trailing={<span aria-hidden="true">%</span>}
            />
            <Button type="submit" variant="secondary" size="sm">
              Salvar
            </Button>
          </form>
          <form action={arquivarEtapa}>
            <input type="hidden" name="id" value={etapa.id} />
            <input type="hidden" name="obra_id" value={obraId} />
            <Button type="submit" variant="ghost" size="sm" leadingIcon={<Archive size={14} />}>
              Remover
            </Button>
          </form>
        </div>
      ) : (
        <span className="etapa__pct">{pct}%</span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Orçado × realizado por etapa (categoria)
// ---------------------------------------------------------------------------

export function OrcadoVsRealizado({
  obraId,
  resumo,
  orcamentoDaObra,
  estado,
  podeEscrever,
}: {
  obraId: string;
  resumo: ResumoDoCronograma;
  orcamentoDaObra: number | null;
  estado: EstadoDoFormulario;
  podeEscrever: boolean;
}) {
  const v = estado.valores ?? {};
  const erroDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);
  const { linhas, totais } = resumo.orcado;
  const comOrcado = linhas.filter((l) => l.orcado != null);
  const teto = Math.max(1, ...linhas.map((l) => Math.max(l.orcado ?? 0, l.realizado)));
  // Para apagar um orçado a linha precisa do id: casa pela categoria.
  const idPorCategoria = new Map(resumo.orcamentos.map((o) => [o.categoria_id, o.id]));

  return (
    <div className="orcado">
      {linhas.length === 0 ? (
        <p className="cronograma__vazio">
          Nenhum orçado por etapa e nenhum gasto com etapa ainda. Informe quanto planejou gastar em
          cada etapa para ver onde está estourando.
        </p>
      ) : (
        <>
          <p className="cronograma__leitura">
            {comOrcado.length === 0 ? (
              'Nenhuma etapa tem orçado ainda — as barras mostram só o realizado.'
            ) : totais.estouradas > 0 ? (
              <>
                <strong>{totais.estouradas}</strong>{' '}
                {totais.estouradas === 1 ? 'etapa passou' : 'etapas passaram'} do orçado. Orçado
                total: {brl(totais.orcado)}; realizado: {brl(totais.realizado)}.
              </>
            ) : (
              <>
                Nenhuma etapa acima do orçado. Orçado total: {brl(totais.orcado)}; realizado:{' '}
                {brl(totais.realizado)}
                {orcamentoDaObra != null && totais.orcado > orcamentoDaObra
                  ? ` — atenção: a soma dos orçados por etapa passa do orçamento da obra (${brl(orcamentoDaObra)}).`
                  : '.'}
              </>
            )}
          </p>
          <ul className="orcado__lista" aria-label="Orçado e realizado por etapa">
            {linhas.map((l) => (
              <LinhaOrcado
                key={l.categoria_id}
                linha={l}
                teto={teto}
                obraId={obraId}
                podeEscrever={podeEscrever}
                idPorCategoria={idPorCategoria}
              />
            ))}
          </ul>
        </>
      )}

      {podeEscrever ? (
        <form action={salvarOrcamentoEtapa} className="orcado__form">
          <input type="hidden" name="obra_id" value={obraId} />
          <label className="ng-field">
            <span className="ng-field__label">Etapa</span>
            <select
              name="categoria_id"
              className="cronograma__select"
              defaultValue={v.categoria_id ?? ''}
              required
            >
              <option value="">— escolha —</option>
              {resumo.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {erroDe('categoria_id') ? (
              <span className="ng-field__error">{erroDe('categoria_id')}</span>
            ) : null}
          </label>
          <Input
            label="Valor orçado (R$)"
            name="valor"
            inputMode="decimal"
            placeholder="ex.: 45.000,00"
            defaultValue={v.valor ?? ''}
            error={erroDe('valor')}
            autoFocus={estado.campo === 'valor'}
            required
          />
          <div className="cronograma__form-acao">
            <Button type="submit">Salvar orçado</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function LinhaOrcado({
  linha,
  teto,
  obraId,
  podeEscrever,
  idPorCategoria,
}: {
  linha: LinhaOrcadoRealizado;
  teto: number;
  obraId: string;
  podeEscrever: boolean;
  idPorCategoria: Map<string, string>;
}) {
  const l = linha;
  const pctOrcado = l.orcado == null ? 0 : (l.orcado / teto) * 100;
  const pctReal = (l.realizado / teto) * 100;
  const id = idPorCategoria.get(l.categoria_id);
  return (
    <li className={`orcado__linha orcado__linha--${l.situacao}`}>
      <div className="orcado__cabeca">
        <span className="orcado__nome">{l.categoria}</span>
        <span className={`orcado__situacao orcado__situacao--${l.situacao}`}>
          {SITUACAO_ROTULO[l.situacao]}
          {l.pct != null ? ` · ${Math.round(l.pct)}%` : ''}
        </span>
      </div>
      <div className="orcado__barras" aria-hidden="true">
        <div className="orcado__trilho">
          <div className="orcado__orcado" style={{ width: `${pctOrcado}%` }} />
        </div>
        <div className="orcado__trilho">
          <div
            className={`orcado__realizado${l.situacao === 'estourado' ? ' orcado__realizado--estouro' : ''}`}
            style={{ width: `${Math.min(100, pctReal)}%` }}
          />
        </div>
      </div>
      <div className="orcado__numeros">
        <span>
          Orçado <strong>{brl(l.orcado)}</strong>
        </span>
        <span>
          Realizado <strong>{brl(l.realizado)}</strong>
        </span>
        <span className={l.saldo != null && l.saldo < 0 ? 'orcado__saldo--negativo' : undefined}>
          {l.saldo == null
            ? ''
            : l.saldo < 0
              ? `Estourou ${brl(-l.saldo)}`
              : `Sobram ${brl(l.saldo)}`}
        </span>
        {podeEscrever && id ? (
          <form action={arquivarOrcamentoEtapa} className="orcado__remover">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="obra_id" value={obraId} />
            <Button type="submit" variant="ghost" size="sm">
              Remover orçado
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
