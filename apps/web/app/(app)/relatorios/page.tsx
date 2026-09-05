import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function RelatoriosPage() {
  return (
    <>
      <TopBar title="Relatórios" subtitle="Análises financeiras e exports" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="FASE 7 · ANALYTICS"
          title="Relatórios"
          lead="Relatórios prontos para o contador, dashboards visuais para tomada de decisão, e exports em CSV/PDF/XLSX para consolidação externa."
          items={[
            { label: 'Fechamento mensal', hint: ' — por obra e por categoria' },
            { label: 'Fluxo de caixa', hint: ' — previsto vs realizado' },
            { label: 'Consolidado por fornecedor', hint: ' — para negociação de preço' },
            { label: 'Export CSV/PDF/XLSX', hint: ' — pronto para o contador' },
          ]}
        />
      </div>
    </>
  );
}
