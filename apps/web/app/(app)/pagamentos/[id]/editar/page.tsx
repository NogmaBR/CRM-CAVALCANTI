import { notFound } from 'next/navigation';
import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { getPagamento } from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';
import { updatePagamento } from '../../actions';
import { PagamentoForm } from '../../pagamento-form';

export default async function EditarPagamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, sp, obras, fornecedores, categorias] = await Promise.all([
    params,
    searchParams,
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
    listCategorias(),
  ]);
  const pagamento = await getPagamento(id);
  if (!pagamento) notFound();

  return (
    <>
      <TopBar
        title={`Editar pagamento — ${formatBRL(pagamento.valor)}`}
        subtitle="Atualize os dados deste lançamento"
      />
      <div className="nos-page-body">
        <PagamentoForm
          mode="edit"
          initial={pagamento}
          obras={obras}
          fornecedores={fornecedores}
          categorias={categorias}
          action={updatePagamento}
          error={sp.error}
        />
      </div>
    </>
  );
}
