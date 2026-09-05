import { TopBar } from '@/components/layout/topbar';
import { createObra } from '../actions';
import { ObraForm } from '../obra-form';

export default async function NovaObraPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      <TopBar title="Nova Obra" subtitle="Cadastro de nova obra" />
      <div className="nos-page-body">
        <ObraForm mode="create" action={createObra} error={params.error} />
      </div>
    </>
  );
}
