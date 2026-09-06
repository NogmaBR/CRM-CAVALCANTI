import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { createFornecedor } from '../actions';
import { FornecedorForm } from '../fornecedor-form';

export default async function NovoFornecedorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, categorias] = await Promise.all([searchParams, listCategorias()]);
  return (
    <>
      <TopBar title="Novo Fornecedor" subtitle="Cadastro de fornecedor" />
      <div className="nos-page-body">
        <FornecedorForm
          mode="create"
          categorias={categorias}
          action={createFornecedor}
          error={params.error}
        />
      </div>
    </>
  );
}
