import { EmptyState } from '@/components/nogma/EmptyState';
import { Sparkline } from '@/components/nogma/Sparkline';
import {
  type AtividadeItem,
  type KpiCard,
  getAtividadeRecente,
  getGastoPorCategoria,
  getKpisResumo,
  getSerieMensal,
  relativeTime,
} from '@/lib/data/painel';
import { resultadoDasObras } from '@/lib/data/painel-empresario';
import { LIMITE_SEM_DOCUMENTO, listPagamentosSemDocumento } from '@/lib/data/pendentes';
import { porExtensoCurto } from '@/lib/financeiro/agregacoes';
import { createClient } from '@/lib/supabase/server';
import {
  ArrowRight,
  Building2,
  FileText,
  MessageSquare,
  Minus,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Cartao, Tabela, brl } from '../cartao';
import { BarSerieMensal } from '../charts/bar-serie-mensal';
import { DonutCategoria } from '../charts/donut-categoria';
import { LineAcumulado } from '../charts/line-acumulado';

/**
 * Cartão de KPI. Delta só quando existe variação real contra o mês anterior;
 * a legenda fica embaixo; a sparkline tem a própria linha.
 */
function Kpi({
  kpi,
  icon: Icon,
  i,
  tone = 'default',
}: {
  kpi: KpiCard;
  icon: LucideIcon;
  i: number;
  tone?: 'default' | 'warning';
}) {
  const dir = kpi.direction;
  const DeltaIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  const pct = kpi.delta_pct;
  const delta = pct === null ? null : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  const stroke = tone === 'warning' ? 'var(--warning)' : undefined;
  const fill =
    tone === 'warning' ? 'color-mix(in srgb, var(--warning) 18%, transparent)' : undefined;
  return (
    <article className={`kpi kpi--${tone} nos-fade-up`} style={{ ['--i' as string]: i }}>
      <div className="kpi__top">
        <span className="kpi__label">{kpi.label}</span>
        <span className="kpi__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
      </div>
      <div className="kpi__value">{kpi.value}</div>
      <div className="kpi__meta">
        {delta ? (
          <span className={`kpi__delta kpi__delta--${dir}`}>
            <DeltaIcon size={13} aria-hidden="true" />
            {delta}
          </span>
        ) : null}
        <span className="kpi__caption">{kpi.caption}</span>
      </div>
      <div className="kpi__spark">
        <Sparkline
          data={kpi.trend8m}
          stroke={stroke}
          fill={fill}
          ariaLabel={`${kpi.label}: tendência dos últimos 8 meses`}
        />
      </div>
    </article>
  );
}

const TIPO_ICON = {
  pagamento: Building2,
  documento: FileText,
  mensagem: MessageSquare,
} as const;

function AtividadeLinha({ item }: { item: AtividadeItem }) {
  const Icon = TIPO_ICON[item.tipo];
  const conteudo = (
    <div className="nos-activity__item">
      <div className="nos-activity__icon">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="nos-activity__body">
        <div className="nos-activity__title">{item.titulo}</div>
        <div className="nos-activity__meta">{item.meta}</div>
      </div>
      <div className="nos-activity__time">
        {relativeTime(item.timestamp)}{' '}
        <ArrowRight
          size={13}
          aria-hidden="true"
          style={{ verticalAlign: 'middle', marginLeft: 4, opacity: 0.5 }}
        />
      </div>
    </div>
  );
  return item.href ? (
    <Link href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

export async function AbaVisaoGeral() {
  const supabase = await createClient();
  const [kpis, serieMensal, categorias, atividade, semDocumento, confirmacoesR, obras] =
    await Promise.all([
      getKpisResumo(),
      getSerieMensal(12),
      getGastoPorCategoria(5),
      getAtividadeRecente(10),
      listPagamentosSemDocumento(),
      supabase
        .from('confirmacoes_pendentes')
        .select('*', { count: 'exact', head: true })
        .eq('resolvida', false),
      resultadoDasObras(),
    ]);

  // Banner de alertas: o que precisa de ação humana hoje. Aparece só quando há
  // algo — banner permanente vira ruído e para de ser lido. A lista completa,
  // com explicação, está na aba Alertas.
  const aguardandoConfirmacao = confirmacoesR.count ?? 0;
  const semDocCriticos = semDocumento.filter((p) => p.dias > 7).length;
  const semDocSufixo = semDocumento.length >= LIMITE_SEM_DOCUMENTO ? '+' : '';

  const alertas: Array<{ texto: string; href: string }> = [];
  if (aguardandoConfirmacao > 0) {
    alertas.push({
      texto:
        aguardandoConfirmacao === 1
          ? '1 mensagem aguardando confirmação'
          : `${aguardandoConfirmacao} mensagens aguardando confirmação`,
      href: '/pendentes',
    });
  }
  if (semDocCriticos > 0) {
    alertas.push({
      texto:
        semDocCriticos === 1 && !semDocSufixo
          ? '1 pagamento sem nota há mais de 7 dias'
          : `${semDocCriticos}${semDocSufixo} pagamentos sem nota há mais de 7 dias`,
      href: '/pendentes',
    });
  }

  let acc = 0;
  const acumuladoData = serieMensal.map((p) => {
    acc += p.total;
    return { label: p.label, total: acc };
  });

  const totalGasto = obras.reduce((a, l) => a + l.gasto, 0);
  const comContrato = obras.filter((l) => l.contrato != null);
  const mesAtual = serieMensal.at(-1);
  const mesAnterior = serieMensal.at(-2);

  return (
    <>
      {alertas.length > 0 ? (
        // biome-ignore lint/a11y/useSemanticElements: banner de alerta (padrão do projeto)
        <div className="painel-alertas" role="status">
          <TriangleAlert size={16} aria-hidden="true" className="painel-alertas__icone" />
          <ul className="painel-alertas__lista">
            {alertas.map((a) => (
              <li key={a.texto}>
                <Link href={a.href} className="painel-alertas__link">
                  {a.texto}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/painel?aba=alertas" className="painel-alertas__todos">
            Ver todos os alertas
          </Link>
        </div>
      ) : null}

      <div className="nos-kpi-grid" style={{ marginTop: 20 }}>
        <Kpi kpi={kpis.obras_ativas} icon={Building2} i={0} />
        <Kpi kpi={kpis.gasto_mes} icon={Wallet} i={1} />
        <Kpi kpi={kpis.gasto_total} icon={TrendingUp} i={2} />
        <Kpi kpi={kpis.pendencias} icon={MessageSquare} i={3} tone="warning" />
      </div>

      <div className="painel-abas__grade" style={{ marginTop: 20 }}>
        <Cartao
          titulo="Como estão as obras"
          largo
          leitura={
            obras.length === 0 ? (
              'Nenhuma obra em andamento.'
            ) : (
              <>
                {obras.length} {obras.length === 1 ? 'obra' : 'obras'} em andamento,{' '}
                {brl(totalGasto)} ({porExtensoCurto(totalGasto)}) gastos no total.
                {comContrato.length < obras.length
                  ? ` ${obras.length - comContrato.length} sem valor de contrato — sem ele o resultado não aparece.`
                  : ''}{' '}
                <Link href="/painel?aba=por-obra">Ver obra por obra</Link>.
              </>
            )
          }
        >
          {obras.length === 0 ? null : (
            <Tabela
              cabecalho={['Obra', 'Gasto', 'Recebido', 'Contrato', 'Resultado até agora']}
              linhas={obras.map((l) => [
                <Link key={l.obra_id} href={`/obras/${l.obra_id}`}>
                  {l.obra}
                </Link>,
                brl(l.gasto),
                brl(l.recebido),
                brl(l.contrato),
                <span key="r" className={l.resultado >= 0 ? 'valor--ok' : 'valor--alerta'}>
                  {brl(l.resultado)}
                </span>,
              ])}
            />
          )}
        </Cartao>

        <Cartao
          titulo="Quanto saiu por mês, nos últimos 12 meses"
          largo
          leitura={
            mesAtual ? (
              <>
                Este mês: <strong>{brl(mesAtual.total)}</strong> ({porExtensoCurto(mesAtual.total)})
                em {mesAtual.count} {mesAtual.count === 1 ? 'pagamento' : 'pagamentos'}
                {mesAnterior && mesAnterior.total > 0
                  ? `; no mês passado foram ${brl(mesAnterior.total)}.`
                  : '.'}
              </>
            ) : null
          }
          tabela={
            <Tabela
              cabecalho={['Mês', 'Gasto', 'Pagamentos']}
              linhas={serieMensal.map((m) => [m.label, brl(m.total), m.count])}
            />
          }
        >
          <BarSerieMensal data={serieMensal} />
        </Cartao>

        <Cartao
          titulo="Para onde o dinheiro foi nos últimos 3 meses"
          leitura={
            categorias[0] ? (
              <>
                A maior fatia foi <strong>{categorias[0].nome}</strong>: {brl(categorias[0].total)}.
              </>
            ) : (
              'Sem pagamentos com etapa nos últimos 3 meses.'
            )
          }
          tabela={
            <Tabela
              cabecalho={['Etapa', 'Total']}
              linhas={categorias.map((c) => [c.nome, brl(c.total)])}
            />
          }
        >
          <DonutCategoria data={categorias} />
        </Cartao>

        <Cartao
          titulo="Total gasto, somando mês a mês"
          leitura={
            acumuladoData.at(-1) ? (
              <>
                Em 12 meses, <strong>{brl(acumuladoData.at(-1)?.total ?? 0)}</strong> (
                {porExtensoCurto(acumuladoData.at(-1)?.total ?? 0)}).
              </>
            ) : null
          }
        >
          <LineAcumulado data={acumuladoData} />
        </Cartao>
      </div>

      <section className="nos-section nos-fade-up" style={{ ['--i' as string]: 5 }}>
        <div className="nos-page-head">
          <h3 className="nos-section__title" style={{ margin: 0 }}>
            O que aconteceu nas últimas 48 horas
          </h3>
        </div>

        {atividade.length === 0 ? (
          <EmptyState
            icon={<MessageSquare size={24} aria-hidden="true" />}
            title="Nenhuma atividade nas últimas 48h"
            compact
          >
            Pagamentos, documentos e mensagens novas aparecem aqui.
          </EmptyState>
        ) : (
          <div className="nos-activity">
            {atividade.map((item) => (
              <AtividadeLinha key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
