import { notFound } from 'next/navigation';
import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { getFornecedor } from '@/lib/data/fornecedores';
import { updateFornecedor } from '../../actions';
import { FornecedorForm } from '../../fornecedor-form';

export default async function EditarFornecedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, sp, categorias] = await Promise.all([
    params,
    searchParams,
    listCategorias(),
  ]);
  const fornecedor = await getFornecedor(id);
  if (!fornecedor) notFound();

  return (
    <>
      <TopBar
        title={`Editar: ${fornecedor.nome}`}
        subtitle="Atualize os dados deste fornecedor"
      />
      <div className="nos-page-body">
        <FornecedorForm
          mode="edit"
          initial={fornecedor}
          categorias={categorias}
          action={updateFornecedor}
          error={sp.error}
        />
      </div>
    </>
  );
}
