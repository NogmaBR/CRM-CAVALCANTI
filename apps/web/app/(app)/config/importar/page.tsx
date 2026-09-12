import { TopBar } from '@/components/layout/topbar';
import { Card } from '@/components/nogma/Card';
import { CSV_TEMPLATE } from '@/lib/schemas/import-pagamento';
import { createClient } from '@/lib/supabase/server';
import { Upload } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ImportarClient } from './importar-client';

async function getAdminOrNotFound() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) notFound();
  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', userData.user.id)
    .single();
  if (profile?.papel !== 'admin') notFound();
}

export default async function ImportarPage() {
  await getAdminOrNotFound();

  const templateDataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

  return (
    <>
      <TopBar title="Importar pagamentos" subtitle="Upload de CSV em batch" />
      <div className="nos-page-body">
        <Card title="Como usar" accent className="importar-how-to-card">
          <ol className="importar-how-to-list">
            <li>Baixe o template CSV e abra no Excel ou Google Sheets</li>
            <li>Preencha uma linha por pagamento (obra, fornecedor, categoria, valor, data)</li>
            <li>Salve como CSV (UTF-8) e faça upload abaixo</li>
            <li>Verifique o preview: linhas com erro ficam destacadas</li>
            <li>Confirme a importação — apenas linhas válidas são inseridas</li>
          </ol>
          <a
            href={templateDataUrl}
            download="template-pagamentos.csv"
            className="importar-template-btn"
          >
            <Upload size={14} aria-hidden="true" />
            Baixar template CSV
          </a>
        </Card>

        <ImportarClient />
      </div>
    </>
  );
}
