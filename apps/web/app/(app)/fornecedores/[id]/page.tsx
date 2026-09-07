import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Archive, RotateCcw } from 'lucide-react';
import '../../_shared/detail-layout.css';
import { TopBar } from '@/components/layout/topbar';
import { Badge } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import { listCategorias } from '@/lib/data/categorias';
import { getFornecedor, listFornecedorApelidos } from '@/lib/data/fornecedores';
import { formatDocumento } from '@/lib/schemas/fornecedor';
import { archiveFornecedor, restoreFornecedor } from '../actions';
import { Section, Row } from '../../_shared/detail-primitives';
import { ApelidosSection } from './apelidos-section';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function FornecedorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [fornecedor, categorias] = await Promise.all([getFornecedor(id), listCategorias()]);
  if (!fornecedor) notFound();

  const apelidos = await listFornecedorApelidos(fornecedor.id);

  const isArquivado = fornecedor.deleted_at != null;
  const isAtivo = fornecedor.ativo === true && !isArquivado;
  const categoria = fornecedor.categoria_id
    ? categorias.find((c) => c.id === fornecedor.categoria_id) ?? null
    : null;

  return (
    <>
      <TopBar
        title={fornecedor.nome}
        subtitle={fornecedor.razao_social ?? 'Fornecedor sem razão social cadastrada'}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/fornecedores" className="detail-layout__back">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar
            </Link>
            <Link href={`/fornecedores/${fornecedor.id}/editar`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" leadingIcon={<Pencil size={14} />}>Editar</Button>
            </Link>
            {isArquivado ? (
              <form action={restoreFornecedor} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={fornecedor.id} />
                <Button type="submit" variant="secondary" leadingIcon={<RotateCcw size={14} />}>
                  Restaurar
                </Button>
              </form>
            ) : (
              <form action={archiveFornecedor} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={fornecedor.id} />
                <Button type="submit" variant="secondary" leadingIcon={<Archive size={14} />}>
                  Arquivar
                </Button>
              </form>
            )}
          </div>
        }
      />

      <div className="nos-page-body">
        {sp.success ? (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--brand, #a3e635) 12%, transparent)',
              color: 'var(--brand, #a3e635)',
              fontSize: 13,
              border: '1px solid color-mix(in srgb, var(--brand, #a3e635) 30%, transparent)',
            }}
          >
            {sp.success}
          </div>
        ) : null}
        {sp.error ? (
          <div className="detail-layout__error" role="alert">
            {sp.error}
          </div>
        ) : null}

        <div className="detail-layout__header">
          {isArquivado ? (
            <Badge variant="neutral">Arquivado</Badge>
          ) : isAtivo ? (
            <Badge variant="success">Ativo</Badge>
          ) : (
            <Badge variant="warning">Inativo</Badge>
          )}
          {fornecedor.documento_tipo ? (
            <span className="detail-layout__tipo">
              {fornecedor.documento_tipo.toUpperCase()}
            </span>
          ) : null}
        </div>

        <div className="detail-layout__grid">
          <Section title="Identificação">
            <Row label="Nome" value={fornecedor.nome} />
            <Row label="Razão social" value={fornecedor.razao_social ?? '—'} />
            <Row
              label="Documento"
              value={formatDocumento(fornecedor.documento, fornecedor.documento_tipo)}
            />
            <Row label="Origem" value={fornecedor.origem === 'auto_detectado' ? 'Detectado por IA' : 'Manual'} />
          </Section>

          <Section title="Categorização">
            <Row
              label="Categoria"
              value={categoria ? categoria.nome : '— sem categoria —'}
              swatch={categoria?.cor ?? null}
            />
            <Row label="Status" value={isArquivado ? 'Arquivado' : isAtivo ? 'Ativo' : 'Inativo'} />
          </Section>

          <Section title="Contato" span={2}>
            <Row label="Telefone" value={fornecedor.telefone ?? '—'} />
            <Row label="E-mail" value={fornecedor.email ?? '—'} />
          </Section>

          <Section title="Apelidos" span={2}>
            <ApelidosSection fornecedorId={fornecedor.id} apelidos={apelidos} />
          </Section>

          <Section title="Metadados" span={2}>
            <Row label="Criado em" value={formatDateTime(fornecedor.created_at)} />
            <Row label="Última atualização" value={formatDateTime(fornecedor.updated_at)} />
            {fornecedor.deleted_at ? (
              <Row label="Arquivado em" value={formatDateTime(fornecedor.deleted_at)} />
            ) : null}
          </Section>
        </div>
      </div>
    </>
  );
}
