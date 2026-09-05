import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Stat } from '@/components/nogma/Stat';
import { Plus } from 'lucide-react';

export default function PainelPage() {
  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase();

  return (
    <>
      <TopBar
        title="Painel"
        subtitle="Visão geral da operação"
        actions={<Button variant="primary" leadingIcon={<Plus size={16} />}>Nova Obra</Button>}
      />
      <div style={{ padding: '32px 40px' }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>{hoje}</p>
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-4xl)', fontWeight: 800 }}>
          Bom dia, <span className="mark-lime">Fernando 👋</span>
        </h2>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Stat label="Obras Ativas" value="—" caption="10 total" />
          <Stat label="Gasto no Mês" value="—" caption="0 pagamentos" />
          <Stat label="Total Acumulado" value="—" caption="Todas as obras" />
          <Stat label="Pendentes NF" value="—" caption="0 sem comprovante" />
        </div>
      </div>
    </>
  );
}
