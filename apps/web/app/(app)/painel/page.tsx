import { Plus, Building2, FileText, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Stat } from '@/components/nogma/Stat';
import { Sparkline } from '@/components/nogma/Sparkline';
import { createClient } from '@/lib/supabase/server';
import {
  getKpisResumo,
  getSerieMensal,
  getGastoPorCategoria,
  getAtividadeRecente,
  relativeTime,
  type KpiCard,
} from '@/lib/data/painel';
import { BarSerieMensal } from './charts/bar-serie-mensal';
import { DonutCategoria } from './charts/donut-categoria';
import { LineAcumulado } from './charts/line-acumulado';
import './painel.css';

function statDir(dir: 'up' | 'down' | 'flat'): 'up' | 'down' {
  return dir === 'down' ? 'down' : 'up';
}

function statDelta(kpi: KpiCard): string {
  if (kpi.delta_pct !== null) {
    return `${kpi.delta_pct > 0 ? '+' : ''}${kpi.delta_pct.toFixed(1)}%`;
  }
  return kpi.caption;
}

const TIPO_ICON = {
  pagamento: Building2,
  documento: FileText,
  mensagem: MessageSquare,
} as const;

export default async function PainelPage() {
  const supabase = await createClient();

  const [kpis, serieMensal, categorias, atividade, userR] = await Promise.all([
    getKpisResumo(),
    getSerieMensal(12),
    getGastoPorCategoria(5),
    getAtividadeRecente(10),
    supabase.auth.getUser(),
  ]);

  const email = userR.data.user?.email ?? 'voce';
  const primeiroNomeRaw = email.split('@')[0]?.split('.')[0] ?? 'voce';
  const primeiroNome = primeiroNomeRaw[0]!.toUpperCase() + primeiroNomeRaw.slice(1);

  const hoje = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

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
        subtitle="Visao geral da operacao"
        actions={
          <Link href="/obras/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Nova Obra
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <p className="eyebrow nos-eyebrow-date">{hoje}</p>
        <h2 className="nos-greeting">
          Bom dia, <span className="mark-lime">{primeiroNome}</span>
        </h2>

        {/* KPI Grid */}
        <div className="nos-kpi-grid" style={{ marginTop: 28 }}>
          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 0 }}>
            <Stat
              label={kpis.obras_ativas.label}
              value={kpis.obras_ativas.value}
              delta={statDelta(kpis.obras_ativas)}
              direction={statDir(kpis.obras_ativas.direction)}
              caption={kpis.obras_ativas.caption}
            />
            <div className="nos-stat-spark">
              <Sparkline
                data={kpis.obras_ativas.trend8m}
                ariaLabel="Tendencia obras ultimos 8 meses"
              />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 1 }}>
            <Stat
              label={kpis.gasto_mes.label}
              value={kpis.gasto_mes.value}
              delta={statDelta(kpis.gasto_mes)}
              direction={statDir(kpis.gasto_mes.direction)}
              caption={kpis.gasto_mes.caption}
            />
            <div className="nos-stat-spark">
              <Sparkline
                data={kpis.gasto_mes.trend8m}
                ariaLabel="Tendencia gasto mensal"
              />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 2 }}>
            <Stat
              label={kpis.gasto_total.label}
              value={kpis.gasto_total.value}
              delta={statDelta(kpis.gasto_total)}
              direction={statDir(kpis.gasto_total.direction)}
              caption={kpis.gasto_total.caption}
            />
            <div className="nos-stat-spark">
              <Sparkline
                data={kpis.gasto_total.trend8m}
                ariaLabel="Total acumulado"
              />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 3 }}>
            <Stat
              label={kpis.pendencias.label}
              value={kpis.pendencias.value}
              delta={statDelta(kpis.pendencias)}
              direction={statDir(kpis.pendencias.direction)}
              caption={kpis.pendencias.caption}
            />
            <div className="nos-stat-spark">
              <Sparkline
                data={kpis.pendencias.trend8m}
                stroke="var(--warning, #eab308)"
                fill="color-mix(in srgb, var(--warning, #eab308) 18%, transparent)"
                ariaLabel="Pendencias ao longo do tempo"
              />
            </div>
          </div>
        </div>

        {/* Analises Section */}
        <section className="nos-section nos-fade-up" style={{ ['--i' as string]: 4 }}>
          <h3 className="nos-section__title">Analises</h3>

          {/* Bar chart: full width */}
          <div className="painel-chart-card" style={{ marginBottom: 16 }}>
            <h3 className="painel-chart-card__title">Gastos mensais — ultimos 12 meses</h3>
            <BarSerieMensal data={serieMensal} />
          </div>

          {/* Donut + Line side by side */}
          <div className="painel-charts-grid">
            <div className="painel-chart-card">
              <h3 className="painel-chart-card__title">Gasto por categoria — ultimos 3 meses</h3>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <h3 className="nos-section__title">Atividade recente</h3>
            <span className="nos-section__hint">Ultimas 48h</span>
          </div>

          {atividade.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Nenhuma atividade nas ultimas 48h.
            </p>
          ) : (
            <div className="nos-activity">
              {atividade.map((item) => {
                const Icon = TIPO_ICON[item.tipo];
                const content = (
                  <div className="nos-activity__item">
                    <div className="nos-activity__icon">
                      <Icon size={18} />
                    </div>
                    <div className="nos-activity__body">
                      <div className="nos-activity__title">{item.titulo}</div>
                      <div className="nos-activity__meta">{item.meta}</div>
                    </div>
                    <div className="nos-activity__time">
                      {relativeTime(item.timestamp)}{' '}
                      <ArrowRight
                        size={13}
                        style={{ verticalAlign: 'middle', marginLeft: 4, opacity: 0.5 }}
                      />
                    </div>
                  </div>
                );

                return item.href ? (
                  <Link
                    key={item.id}
                    href={item.href}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
