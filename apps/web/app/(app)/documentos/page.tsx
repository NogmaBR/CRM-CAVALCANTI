import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { type Documento, listDocumentos } from '@/lib/data/documentos';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { DocumentosAgrupados } from './documentos-agrupados';
import { DocumentosFilters } from './documentos-filters';
import { DocumentosTable } from './documentos-table';
import './documentos.css';

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
  searchParams: Promise<{ tipo?: string; obra_id?: string; agrupar?: string; q?: string }>;
}) {
  const params = await searchParams;
  const tipo = params.tipo ?? '';
  const obraId = params.obra_id ?? '';
  const busca = (params.q ?? '').trim();
  const agrupar =
    params.agrupar === 'fornecedor' || params.agrupar === 'obra' ? params.agrupar : '';

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
    const merged = { tipo, obra_id: obraId, agrupar, q: busca, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && typeof v === 'string' && v.length > 0) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/documentos?${qs}` : '/documentos';
  };

  // A busca cobre arquivo, nº da NF, fornecedor e obra numa caixa só — é como
  // a pergunta chega ("a NF do Votorantim de janeiro"), sem o usuário ter que
  // decidir antes em qual campo procurar. Feita em memória porque os nomes de
  // fornecedor e obra vivem em outras tabelas e a listagem já carrega tudo.
  const obraNome = new Map(obras.map((o) => [o.id, o.nome]));
  const fornecedorNome = new Map(fornecedores.map((f) => [f.id, f.nome]));

  const enriquecidos = documentos.map((d) => ({
    ...d,
    obra_nome: d.obra_id ? (obraNome.get(d.obra_id) ?? null) : null,
    fornecedor_nome: d.fornecedor_id ? (fornecedorNome.get(d.fornecedor_id) ?? null) : null,
  }));

  const normalizar = (v: string) =>
    v
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const alvo = normalizar(busca);
  const filtrados =
    alvo === ''
      ? enriquecidos
      : enriquecidos.filter((d) =>
          [d.nome_arquivo, d.numero_nf, d.fornecedor_nome, d.obra_nome]
            .filter((v): v is string => !!v)
            .some((v) => normalizar(v).includes(alvo)),
        );

  const VISOES = [
    { value: '', label: 'Lista' },
    { value: 'fornecedor', label: 'Por fornecedor' },
    { value: 'obra', label: 'Por obra' },
  ] as const;

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

        {/* Form GET simples: busca sem client component nenhum. */}
        <form method="get" className="docs-busca" role="search">
          {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
          {obraId ? <input type="hidden" name="obra_id" value={obraId} /> : null}
          {agrupar ? <input type="hidden" name="agrupar" value={agrupar} /> : null}
          <input
            className="docs-busca__input"
            type="search"
            name="q"
            defaultValue={busca}
            placeholder="Buscar por arquivo, nº da NF, fornecedor ou obra"
            aria-label="Buscar documentos"
          />
          <button type="submit" className="docs-busca__botao">
            Buscar
          </button>
          {busca ? (
            <Link href={buildHref({ q: '' })} className="docs-busca__limpar">
              Limpar
            </Link>
          ) : null}
        </form>

        <nav className="obras-filter-tabs" aria-label="Modo de visualização">
          {VISOES.map((v) => {
            const active = v.value === agrupar;
            return (
              <Link
                key={v.value || 'lista'}
                href={buildHref({ agrupar: v.value })}
                className={active ? 'obras-filter-tab is-active' : 'obras-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: 24 }}>
          {agrupar ? (
            <DocumentosAgrupados documentos={filtrados} por={agrupar} />
          ) : (
            <DocumentosTable documentos={filtrados} obras={obras} fornecedores={fornecedores} />
          )}
        </div>
      </div>
    </>
  );
}
