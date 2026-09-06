import { Plus, Building2, FileText, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Stat } from '@/components/nogma/Stat';
import { Sparkline } from '@/components/nogma/Sparkline';
import { createClient } from '@/lib/supabase/server';
import { sumPagamentosBy } from '@/lib/data/pagamentos';

const MOCK_TREND_OBRAS = [3, 4, 5, 4, 6, 7, 8, 10];
const MOCK_TREND_GASTO = [80, 92, 88, 105, 118, 121, 125, 128];
const MOCK_TREND_TOTAL = [280, 315, 350, 380, 400, 425, 445, 453];
const MOCK_TREND_PEND = [12, 11, 9, 8, 7, 6, 5, 4];

const MOCK_ACTIVITY: Array<{
  icon: 'obra' | 'doc' | 'msg';
  title: string;
  meta: string;
  time: string;
}> = [
  {
    icon: 'msg',
    title: 'Nova mensagem no WhatsApp — Fornecedor XYZ',
    meta: 'Comprovante Obra Bela Vista · aguardando classificação',
    time: 'agora',
  },
  {
    icon: 'doc',
    title: 'NF 4592 confirmada — R$ 8.320,00',
    meta: 'Obra Centro · categoria Material',
    time: '2h',
  },
  {
    icon: 'obra',
    title: 'Obra "Residencial Cavalcanti II" criada',
    meta: 'Início 12/set · orçamento R$ 890k',
    time: 'ontem',
  },
  {
    icon: 'msg',
    title: 'Fernando marcou 3 mensagens como resolvidas',
    meta: 'WhatsApp · Obra Zona Sul',
    time: 'ontem',
  },
];

export default async function PainelPage() {
  const supabase = await createClient();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [obrasR, gastoMes, gastoTotal, msgsR, userR] = await Promise.all([
    supabase.from('obras').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sumPagamentosBy({ month: currentMonth, status_pagto: 'confirmado' }),
    sumPagamentosBy({ status_pagto: 'confirmado' }),
    supabase
      .from('mensagens_whats')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'recebida'),
    supabase.auth.getUser(),
  ]);
  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const email = userR.data.user?.email ?? 'você';
  const primeiroNomeRaw = email.split('@')[0]?.split('.')[0] ?? 'você';
  const primeiroNome = primeiroNomeRaw[0]!.toUpperCase() + primeiroNomeRaw.slice(1);

  const hoje = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();

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
        <p className="eyebrow nos-eyebrow-date">{hoje}</p>
        <h2 className="nos-greeting">
          Bom dia, <span className="mark-lime">{primeiroNome} 👋</span>
        </h2>

        <div className="nos-kpi-grid" style={{ marginTop: 28 }}>
          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 0 }}>
            <Stat
              label="Obras Ativas"
              value={String(obrasR.count ?? 0)}
              delta="+0"
              direction="up"
              caption="ativas + arquivadas"
            />
            <div className="nos-stat-spark">
              <Sparkline data={MOCK_TREND_OBRAS} ariaLabel="Tendência obras últimos 8 meses" />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 1 }}>
            <Stat
              label="Gasto no Mês"
              value={brl(gastoMes.total)}
              delta={gastoMes.count > 0 ? `${gastoMes.count} pgto${gastoMes.count === 1 ? '' : 's'}` : '+0'}
              direction="up"
              caption="pagamentos confirmados este mês"
            />
            <div className="nos-stat-spark">
              <Sparkline data={MOCK_TREND_GASTO} ariaLabel="Tendência gasto mensal" />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 2 }}>
            <Stat
              label="Total Acumulado"
              value={brl(gastoTotal.total)}
              delta={gastoTotal.count > 0 ? `${gastoTotal.count} pgto${gastoTotal.count === 1 ? '' : 's'}` : '+0'}
              direction="up"
              caption="todas as obras"
            />
            <div className="nos-stat-spark">
              <Sparkline data={MOCK_TREND_TOTAL} ariaLabel="Total acumulado" />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 3 }}>
            <Stat
              label="Pendentes NF"
              value={String(msgsR.count ?? 0)}
              delta="+0"
              direction="down"
              caption="mensagens aguardando classificação"
            />
            <div className="nos-stat-spark">
              <Sparkline
                data={MOCK_TREND_PEND}
                stroke="var(--warning, #eab308)"
                fill="color-mix(in srgb, var(--warning, #eab308) 18%, transparent)"
                ariaLabel="Pendências ao longo do tempo"
              />
            </div>
          </div>
        </div>

        <section className="nos-section nos-fade-up" style={{ ['--i' as string]: 4 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <h3 className="nos-section__title">Atividade recente</h3>
            <span className="nos-section__hint">Últimas 24h</span>
          </div>
          <div className="nos-activity">
            {MOCK_ACTIVITY.map((item, i) => {
              const Icon =
                item.icon === 'obra' ? Building2 : item.icon === 'doc' ? FileText : MessageSquare;
              return (
                <div key={i} className="nos-activity__item">
                  <div className="nos-activity__icon">
                    <Icon size={18} />
                  </div>
                  <div className="nos-activity__body">
                    <div className="nos-activity__title">{item.title}</div>
                    <div className="nos-activity__meta">{item.meta}</div>
                  </div>
                  <div className="nos-activity__time">
                    {item.time}{' '}
                    <ArrowRight
                      size={13}
                      style={{ verticalAlign: 'middle', marginLeft: 4, opacity: 0.5 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
