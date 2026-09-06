import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listDocumentos, type Documento } from '@/lib/data/documentos';
import { DocumentosFilters } from './documentos-filters';
import { DocumentosTable } from './documentos-table';

const TIPO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'nota_fiscal', label: 'Notas fiscais' },
  { value: 'comprovante', label: 'Comprovantes' },
  { value: 'contrato', label: 'Contratos' },
  { value: 'outro', label: 'Outros' },
  { value: 'arquivado', label: 'Arquivados' },
];

type Tipo = 'nota_fiscal' | 'comprovante' | 'contrato' | 'outro';

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; obra_id?: string }>;
}) {
  const params = await searchParams;
  const tipo = params.tipo ?? '';
  const obraId = params.obra_id ?? '';

  const isArquivado = tipo === 'arquivado';
  const tipoFilter: Tipo | undefined = isArquivado
    ? undefined
    : (['nota_fiscal', 'comprovante', 'contrato', 'outro'] as const).includes(tipo as Tipo)
      ? (tipo as Tipo)
      : undefined;

  const [documentos, obras, fornecedores]: [
    Documento[],
    Awaited<ReturnType<typeof listObras>>,
    Awaited<ReturnType<typeof listFornecedores>>,
  ] = await Promise.all([
    listDocumentos({
      tipo: tipoFilter,
      obra_id: obraId || undefined,
      onlyArchived: isArquivado,
    }),
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
  ]);

  const buildHref = (overrides: Partial<Record<string, string>>) => {
    const p = new URLSearchParams();
    const merged = { tipo, obra_id: obraId, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && typeof v === 'string' && v.length > 0) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/documentos?${qs}` : '/documentos';
  };

  return (
    <>
      <TopBar
        title="Documentos"
        subtitle="NFs, comprovantes, contratos e anexos"
        actions={
          <Link href="/documentos/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Novo Documento
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <nav className="obras-filter-tabs" aria-label="Filtrar por tipo">
          {TIPO_OPTIONS.map((opt) => {
            const href = buildHref({ tipo: opt.value });
            const active = opt.value === tipo;
            return (
              <Link
                key={opt.value || 'todos'}
                href={href}
                className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        <DocumentosFilters
          obras={obras.map((o) => ({ value: o.id, label: o.nome }))}
          selectedObraId={obraId}
        />

        <div style={{ marginTop: 24 }}>
          <DocumentosTable documentos={documentos} obras={obras} fornecedores={fornecedores} />
        </div>
      </div>
    </>
  );
}
