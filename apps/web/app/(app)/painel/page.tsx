import { Plus, Building2, FileText, MessageSquare, ArrowRight } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Stat } from '@/components/nogma/Stat';
import { Sparkline } from '@/components/nogma/Sparkline';

/**
 * Painel — Landing page do CRM. Enquanto Fase 3 não plugar dados reais,
 * exibimos mocks representativos com sparklines para mostrar o layout
 * final. A troca para dados vivos é uma substituição das constantes MOCK_*.
 */

const MOCK_OBRAS = { value: '10', delta: '+2', trend: [3, 4, 5, 4, 6, 7, 8, 10] };
const MOCK_GASTO = { value: 'R$ 128k', delta: '+18%', trend: [80, 92, 88, 105, 118, 121, 125, 128] };
const MOCK_TOTAL = { value: 'R$ 453k', delta: '+9%', trend: [280, 315, 350, 380, 400, 425, 445, 453] };
const MOCK_PEND = { value: '4', delta: '-2', trend: [12, 11, 9, 8, 7, 6, 5, 4] };

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

export default function PainelPage() {
  const hoje = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
  const primeiroNome = 'Fernando';

  return (
    <>
      <TopBar
        title="Painel"
        subtitle="Visão geral da operação"
        actions={
          <Button variant="primary" leadingIcon={<Plus size={16} />}>
            Nova Obra
          </Button>
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
              value={MOCK_OBRAS.value}
              delta={MOCK_OBRAS.delta}
              direction="up"
              caption="12 total · 2 novas este mês"
            />
            <div className="nos-stat-spark">
              <Sparkline data={MOCK_OBRAS.trend} ariaLabel="Tendência obras últimos 8 meses" />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 1 }}>
            <Stat
              label="Gasto no Mês"
              value={MOCK_GASTO.value}
              delta={MOCK_GASTO.delta}
              direction="up"
              caption="34 pagamentos confirmados"
            />
            <div className="nos-stat-spark">
              <Sparkline data={MOCK_GASTO.trend} ariaLabel="Tendência gasto mensal" />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 2 }}>
            <Stat
              label="Total Acumulado"
              value={MOCK_TOTAL.value}
              delta={MOCK_TOTAL.delta}
              direction="up"
              caption="todas as obras"
            />
            <div className="nos-stat-spark">
              <Sparkline data={MOCK_TOTAL.trend} ariaLabel="Total acumulado" />
            </div>
          </div>

          <div className="nos-stat-wrap nos-fade-up" style={{ ['--i' as string]: 3 }}>
            <Stat
              label="Pendentes NF"
              value={MOCK_PEND.value}
              delta={MOCK_PEND.delta}
              direction="down"
              caption="pagamentos sem comprovante"
            />
            <div className="nos-stat-spark">
              <Sparkline
                data={MOCK_PEND.trend}
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
