import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Archive, RotateCcw, Download } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import { Section, Row } from '../../_shared/detail-primitives';
import { getDocumento } from '@/lib/data/documentos';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { listPagamentos } from '@/lib/data/pagamentos';
import { ANEXO_TIPO_LABELS, formatBytes, type AnexoTipo } from '@/lib/schemas/documento';
import { archiveDocumento, downloadDocumento, restoreDocumento } from '../actions';
import '../../_shared/detail-layout.css';

const TIPO_VARIANT: Record<AnexoTipo, BadgeVariant> = {
  nota_fiscal: 'success',
  comprovante: 'warning',
  contrato: 'neutral',
  outro: 'neutral',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default async function DocumentoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const documento = await getDocumento(id);
  if (!documento) notFound();

  const [obras, pagamentos, fornecedores] = await Promise.all([
    listObras({ includeArchived: true }),
    listPagamentos({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
  ]);

  const obra = documento.obra_id ? obras.find((o) => o.id === documento.obra_id) ?? null : null;
  const pagamento = documento.pagamento_id
    ? pagamentos.find((p) => p.id === documento.pagamento_id) ?? null
    : null;
  const fornecedor = documento.fornecedor_id
    ? fornecedores.find((f) => f.id === documento.fornecedor_id) ?? null
    : null;

  const isArquivado = documento.deleted_at != null;
  const tipo = documento.tipo as AnexoTipo;

  return (
    <>
      <TopBar
        title={documento.nome_arquivo}
        subtitle={`${ANEXO_TIPO_LABELS[tipo]} · ${formatBytes(documento.tamanho_bytes)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/documentos" className="detail-layout__back">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar
            </Link>
            <form action={downloadDocumento} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={documento.id} />
              <Button type="submit" variant="primary" leadingIcon={<Download size={14} />}>
                Download
              </Button>
            </form>
            <Link href={`/documentos/${documento.id}/editar`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" leadingIcon={<Pencil size={14} />}>Editar</Button>
            </Link>
            {isArquivado ? (
              <form action={restoreDocumento} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={documento.id} />
                <Button type="submit" variant="secondary" leadingIcon={<RotateCcw size={14} />}>Restaurar</Button>
              </form>
            ) : (
              <form action={archiveDocumento} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={documento.id} />
                <Button type="submit" variant="secondary" leadingIcon={<Archive size={14} />}>Arquivar</Button>
              </form>
            )}
          </div>
        }
      />

      <div className="nos-page-body">
        {sp.error ? (
          <div className="detail-layout__error" role="alert">
            {sp.error}
          </div>
        ) : null}

        <div className="detail-layout__header">
          {isArquivado ? (
            <Badge variant="neutral">Arquivado</Badge>
          ) : (
            <Badge variant={TIPO_VARIANT[tipo]}>{ANEXO_TIPO_LABELS[tipo]}</Badge>
          )}
          <span className="detail-layout__tipo">{documento.mime_type}</span>
        </div>

        <div className="detail-layout__grid">
          <Section title="Arquivo">
            <Row label="Nome" value={documento.nome_arquivo} strong />
            <Row label="Tipo MIME" value={documento.mime_type} />
            <Row label="Tamanho" value={formatBytes(documento.tamanho_bytes)} />
          </Section>

          <Section title="Classificação">
            <Row label="Categoria" value={ANEXO_TIPO_LABELS[tipo]} />
            <Row label="Número NF" value={documento.numero_nf ?? '—'} />
            <Row label="Chave acesso NF" value={documento.chave_acesso_nf ?? '—'} />
          </Section>

          <Section title="Referências" span={2}>
            <Row
              label="Obra"
              value={obra ? obra.nome : '— sem obra —'}
              href={obra ? `/obras/${obra.id}` : undefined}
            />
            <Row
              label="Pagamento"
              value={
                pagamento
                  ? `${pagamento.data_pagamento} · ${Number(pagamento.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                  : '— sem pagamento —'
              }
              href={pagamento ? `/pagamentos/${pagamento.id}` : undefined}
            />
            <Row
              label="Fornecedor"
              value={fornecedor ? fornecedor.nome : '— sem fornecedor —'}
              href={fornecedor ? `/fornecedores/${fornecedor.id}` : undefined}
            />
          </Section>

          <Section title="Metadados" span={2}>
            <Row label="Criado em" value={formatDateTime(documento.created_at)} />
            <Row label="Última atualização" value={formatDateTime(documento.updated_at)} />
            {documento.deleted_at ? (
              <Row label="Arquivado em" value={formatDateTime(documento.deleted_at)} />
            ) : null}
            <Row label="Storage path" value={documento.storage_path} />
          </Section>
        </div>
      </div>
    </>
  );
}
