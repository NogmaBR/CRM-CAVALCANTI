import { notFound } from 'next/navigation';
import { TopBar } from '@/components/layout/topbar';
import { getDocumento } from '@/lib/data/documentos';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listPagamentos } from '@/lib/data/pagamentos';
import { updateDocumento } from '../../actions';
import { DocumentoForm } from '../../documento-form';

export default async function EditarDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, sp, obras, pagamentos, fornecedores] = await Promise.all([
    params,
    searchParams,
    listObras({ includeArchived: true }),
    listPagamentos({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
  ]);
  const documento = await getDocumento(id);
  if (!documento) notFound();

  return (
    <>
      <TopBar
        title={`Editar: ${documento.nome_arquivo}`}
        subtitle="Atualize as referências e classificação"
      />
      <div className="nos-page-body">
        <DocumentoForm
          mode="edit"
          initial={documento}
          obras={obras}
          pagamentos={pagamentos}
          fornecedores={fornecedores}
          action={updateDocumento}
          error={sp.error}
        />
      </div>
    </>
  );
}
