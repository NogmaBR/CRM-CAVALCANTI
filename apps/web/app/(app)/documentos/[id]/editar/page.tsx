import { TopBar } from '@/components/layout/topbar';
import { getDocumento } from '@/lib/data/documentos';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listPagamentos } from '@/lib/data/pagamentos';
import { pareceUuid } from '@/lib/util/uuid';
import { notFound } from 'next/navigation';
import { estadoDoFormulario } from '../../../_shared/form-erros';
import { updateDocumento } from '../../actions';
import { DocumentoForm } from '../../documento-form';

export const metadata = { title: 'Editar documento' };

export default async function EditarDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
}) {
  const { id } = await params;
  // Id que nem parece uuid é recusado antes de qualquer consulta. Não muda o
  // status HTTP (T-QA-7): o `loading.tsx` de `documentos/` envolve esta rota
  // numa Suspense e o 200 sai antes — a correção é escopar o skeleton à lista.
  if (!pareceUuid(id)) notFound();
  const [sp, obras, pagamentos, fornecedores] = await Promise.all([
    searchParams,
    listObras({ includeArchived: true }),
    listPagamentos({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
  ]);
  const documento = await getDocumento(id);
  if (!documento) notFound();
  const estado = estadoDoFormulario(sp);

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
          error={estado.error}
          campo={estado.campo}
          valores={estado.valores}
        />
      </div>
    </>
  );
}
