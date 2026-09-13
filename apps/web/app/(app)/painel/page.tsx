import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
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
import { LIMITE_SEM_DOCUMENTO, listPagamentosSemDocumento } from '@/lib/data/pendentes';
import { createClient } from '@/lib/supabase/server';
import {
  ArrowRight,
  Building2,
  FileText,
  MessageSquare,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { BarSerieMensal } from './charts/bar-serie-mensal';
import { DonutCategoria } from './charts/donut-categoria';
import { LineAcumulado } from './charts/line-acumulado';
import './painel.css';

/**
 * Cartão de KPI.
 *
 * Antes o mesmo texto aparecia duas vezes (como "delta" e como legenda) e a
 * sparkline era absoluta por cima do número. Agora: delta só quando existe
 * variação real contra o mês anterior; a legenda fica embaixo; a sparkline
 * tem a própria linha.
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

export default async function PainelPage() {
  const supabase = await createClient();

  const [kpis, serieMensal, categorias, atividade, userR, semDocumento, confirmacoesR] =
    await Promise.all([
      getKpisResumo(),
      getSerieMensal(12),
      getGastoPorCategoria(5),
      getAtividadeRecente(10),
      supabase.auth.getUser(),
      listPagamentosSemDocumento(),
      supabase
        .from('confirmacoes_pendentes')
        .select('*', { count: 'exact', head: true })
        .eq('resolvida', false),
    ]);

  // Banner de alertas: o que precisa de ação humana hoje, montado a partir do
  // que já é consultado em outras telas. Aparece só quando há algo — banner
  // permanente vira ruído e para de ser lido.
  const aguardandoConfirmacao = confirmacoesR.count ?? 0;
  const semDocCriticos = semDocumento.filter((p) => p.dias > 7).length;
  // Lista no teto = há mais do que foi trazido; o número vira piso ("50+").
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

  const email = userR.data.user?.email ?? 'voce';
  const primeiroNomeRaw = email.split('@')[0]?.split('.')[0] ?? 'voce';
  const primeiroNome = primeiroNomeRaw[0]!.toUpperCase() + primeiroNomeRaw.slice(1);

  // Data e saudação em hora de Brasília: o runtime da Vercel é UTC, e às
  // 22h o painel dizia "Bom dia" com a data de amanhã.
  const agora = new Date();
  const hoje = agora
    .toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Sao_Paulo',
    })
    .toUpperCase();
  const hora = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(agora),
  );
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  // Running sum for area chart — computed server-side
  let acc = 0;
  const acumuladoData = serieMensal.map((p) => {
    acc += p.total;
    return { label: p.label, total: acc };
  });

  return (
    <>
      <TopBar
        title="Painel"
        subtitle="Visão geral da operação"
        actions={
          <Link href="/obras/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Nova Obra
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <div className="painel-saudacao">
          <p className="eyebrow nos-eyebrow-date">{hoje}</p>
          <h2 className="nos-greeting">
            {saudacao}, {primeiroNome}
          </h2>
        </div>

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
          </div>
        ) : null}

        {/* KPIs */}
        <div className="nos-kpi-grid" style={{ marginTop: 28 }}>
          <Kpi kpi={kpis.obras_ativas} icon={Building2} i={0} />
          <Kpi kpi={kpis.gasto_mes} icon={Wallet} i={1} />
          <Kpi kpi={kpis.gasto_total} icon={TrendingUp} i={2} />
          <Kpi kpi={kpis.pendencias} icon={MessageSquare} i={3} tone="warning" />
        </div>

        {/* Analises Section */}
        <section className="nos-section nos-fade-up" style={{ ['--i' as string]: 4 }}>
          <h3 className="nos-section__title">Análises</h3>

          {/* Bar chart: full width */}
          <div className="painel-chart-card" style={{ marginBottom: 16 }}>
            <h3 className="painel-chart-card__title">Gastos mensais — últimos 12 meses</h3>
            <BarSerieMensal data={serieMensal} />
          </div>

          {/* Donut + Line side by side */}
          <div className="painel-charts-grid">
            <div className="painel-chart-card">
              <h3 className="painel-chart-card__title">Gasto por categoria — últimos 3 meses</h3>
              <DonutCategoria data={categorias} />
            </div>
            <div className="painel-chart-card">
              <h3 className="painel-chart-card__title">Total acumulado</h3>
              <LineAcumulado data={acumuladoData} />
            </div>
          </div>
        </section>

        {/* Activity Section */}
        <section className="nos-section nos-fade-up" style={{ ['--i' as string]: 5 }}>
          <div className="nos-page-head">
            <h3 className="nos-section__title" style={{ margin: 0 }}>
              Atividade recente
            </h3>
            <span className="nos-section__hint">Últimas 48h</span>
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
      </div>
    </>
  );
}
