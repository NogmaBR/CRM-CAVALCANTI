import { TopBar } from '@/components/layout/topbar';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { RelatoriosForms } from './relatorios-forms';

export const metadata = { title: 'Relatórios' };

export default async function RelatoriosPage() {
  const [obras, fornecedores] = await Promise.all([
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
  ]);

  return (
    <>
      <TopBar
        title="Relatórios"
        subtitle="Exports em PDF e CSV para análise financeira e contabilidade"
      />
      <div className="nos-page-body">
        <RelatoriosForms obras={obras} fornecedores={fornecedores} />
      </div>
    </>
  );
}
