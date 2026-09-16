import { AnexoDaMensagem } from '@/components/arquivos/anexo-da-mensagem';
import { GradeDeArquivos } from '@/components/arquivos/grade';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import { listCategorias } from '@/lib/data/categorias';
import { listDocumentos } from '@/lib/data/documentos';
import { listFornecedores } from '@/lib/data/fornecedores';
import { getMensagem } from '@/lib/data/mensagens';
import { listObras } from '@/lib/data/obras';
import { getPagamento } from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';
import { Archive, ArrowLeft, Pencil, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { archivePagamento, restorePagamento } from '../actions';
import '../../_shared/detail-layout.css';
import {
  PAGAMENTO_STATUS_LABEL as STATUS_LABEL,
  PAGAMENTO_STATUS_VARIANT as STATUS_VARIANT,
} from '@/lib/status-labels';
import { Row, Section } from '../../_shared/detail-primitives';

export const metadata = { title: 'Pagamento' };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

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

const ORIGEM_LABEL: Record<'manual' | 'whatsapp' | 'importado', string> = {
  manual: 'Manual',
  whatsapp: 'WhatsApp',
  importado: 'Importado',
};

export default async function PagamentoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  // Pagamento e lookups numa ida só: em série o TTFB somava as duas.
  const [sp, pagamento, obras, fornecedores, categorias] = await Promise.all([
    searchParams,
    getPagamento(id),
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
    listCategorias(),
  ]);
  if (!pagamento) notFound();

  // Os comprovantes e NFs deste lançamento, e — quando nasceu no WhatsApp — a
  // mensagem original, para ver a foto que a pessoa mandou mesmo antes de ela
  // virar documento.
  const [documentos, mensagemOrigem] = await Promise.all([
    listDocumentos({ pagamento_id: pagamento.id }),
    pagamento.criado_via_msg_id ? getMensagem(pagamento.criado_via_msg_id) : Promise.resolve(null),
  ]);
  const mostrarMidiaDaMensagem =
    !!mensagemOrigem?.midia_storage_path &&
    !documentos.some((d) => d.id === mensagemOrigem.documento_id);

  const obra = obras.find((o) => o.id === pagamento.obra_id) ?? null;
  const fornecedor = pagamento.fornecedor_id
    ? (fornecedores.find((f) => f.id === pagamento.fornecedor_id) ?? null)
    : null;
  const categoria = pagamento.categoria_id
    ? (categorias.find((c) => c.id === pagamento.categoria_id) ?? null)
    : null;

  const isArquivado = pagamento.deleted_at != null;
  const status = pagamento.status_pagto ?? 'confirmado';
  const origem = pagamento.origem ?? 'manual';

  return (
    <>
      <TopBar
        title={formatBRL(pagamento.valor)}
        subtitle={`Pagamento em ${formatDate(pagamento.data_pagamento)}${obra ? ` · ${obra.nome}` : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/pagamentos" className="detail-layout__back">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar
            </Link>
            <Link href={`/pagamentos/${pagamento.id}/editar`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" leadingIcon={<Pencil size={14} />}>
                Editar
              </Button>
            </Link>
            {isArquivado ? (
              <form action={restorePagamento} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={pagamento.id} />
                <Button type="submit" variant="secondary" leadingIcon={<RotateCcw size={14} />}>
                  Restaurar
                </Button>
              </form>
            ) : (
              <form action={archivePagamento} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={pagamento.id} />
                <Button type="submit" variant="secondary" leadingIcon={<Archive size={14} />}>
                  Arquivar
                </Button>
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
            <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
          )}
          <span className="detail-layout__tipo">{ORIGEM_LABEL[origem]}</span>
        </div>

        <div className="detail-layout__grid">
          <Section title="Valores">
            <Row label="Valor" value={formatBRL(pagamento.valor)} strong />
            <Row label="Data do pagamento" value={formatDate(pagamento.data_pagamento)} />
            <Row label="Status" value={STATUS_LABEL[status]} />
          </Section>

          <Section title="Origem">
            <Row label="Origem do registro" value={ORIGEM_LABEL[origem]} />
            <Row
              label="Criado via mensagem"
              value={pagamento.criado_via_msg_id ? 'Sim (WhatsApp)' : 'Não (manual)'}
            />
          </Section>

          <Section title="Referências" span={2}>
            <Row
              label="Obra"
              value={obra ? obra.nome : '— não encontrada —'}
              href={obra ? `/obras/${obra.id}` : undefined}
            />
            <Row
              label="Fornecedor"
              value={fornecedor ? fornecedor.nome : '— sem fornecedor —'}
              href={fornecedor ? `/fornecedores/${fornecedor.id}` : undefined}
            />
            <Row
              label="Categoria"
              value={categoria ? categoria.nome : '— sem categoria —'}
              swatch={categoria?.cor ?? null}
            />
          </Section>

          <section className="detail-layout__section detail-layout__section--wide">
            <h3 className="detail-layout__legend">Documentos</h3>
            {documentos.length > 0 ? (
              <GradeDeArquivos
                rotulo="Documentos do pagamento"
                itens={documentos.map((d) => ({
                  id: d.id,
                  mime: d.mime_type,
                  nome: d.nome_arquivo,
                  href: `/documentos/${d.id}`,
                }))}
              />
            ) : null}
            {mostrarMidiaDaMensagem && mensagemOrigem ? (
              <div style={{ marginTop: documentos.length > 0 ? 14 : 0 }}>
                <p className="detail-layout__aviso" style={{ marginBottom: 8 }}>
                  Anexo da mensagem do WhatsApp que originou este lançamento
                </p>
                <AnexoDaMensagem
                  mensagemId={mensagemOrigem.id}
                  mime={mensagemOrigem.midia_mime}
                  legenda={mensagemOrigem.texto_bruto}
                />
              </div>
            ) : null}
            {documentos.length === 0 && !mostrarMidiaDaMensagem ? (
              <p className="detail-layout__aviso">
                Nenhum documento ligado a este pagamento.{' '}
                <Link
                  href={`/documentos/novo?pagamento_id=${pagamento.id}`}
                  className="obras-row-link"
                >
                  Anexar comprovante ou NF
                </Link>
              </p>
            ) : null}
          </section>

          <Section title="Descrição & notas" span={2}>
            <Row label="Descrição" value={pagamento.descricao ?? '—'} />
            <Row label="Observações" value={pagamento.observacoes ?? '—'} multiline />
          </Section>

          <Section title="Metadados" span={2}>
            <Row label="Criado em" value={formatDateTime(pagamento.created_at)} />
            <Row label="Última atualização" value={formatDateTime(pagamento.updated_at)} />
            {pagamento.deleted_at ? (
              <Row label="Arquivado em" value={formatDateTime(pagamento.deleted_at)} />
            ) : null}
          </Section>
        </div>
      </div>
    </>
  );
}
