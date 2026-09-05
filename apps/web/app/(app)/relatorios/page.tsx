import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function RelatoriosPage() {
  return (
    <>
      <TopBar title="Relatórios" subtitle="Análises financeiras e exports" />
      <div className="nos-page-body">
        <ComingSoon
          title="Em construção"
          phase="Fase 7 · Analytics"
          lead="Relatórios prontos para o contador, dashboards visuais para decisão e exports em CSV/PDF/XLSX."
          items={[
            { label: 'Fechamento mensal', hint: 'por obra e por categoria' },
            { label: 'Fluxo de caixa', hint: 'previsto vs realizado' },
            { label: 'Consolidado por fornecedor', hint: 'para negociação de preço' },
            { label: 'Export CSV/PDF/XLSX', hint: 'pronto para o contador' },
          ]}
        />
      </div>
    </>
  );
}
