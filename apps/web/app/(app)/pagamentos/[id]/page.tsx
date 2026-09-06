import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Archive, RotateCcw } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { getPagamento } from '@/lib/data/pagamentos';
import { formatBRL } from '@/lib/schemas/pagamento';
import { archivePagamento, restorePagamento } from '../actions';
import '../../_shared/detail-layout.css';

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

const STATUS_VARIANT: Record<'confirmado' | 'aguardando' | 'erro', BadgeVariant> = {
  confirmado: 'success',
  aguardando: 'warning',
  erro: 'danger',
};

const STATUS_LABEL: Record<'confirmado' | 'aguardando' | 'erro', string> = {
  confirmado: 'Confirmado',
  aguardando: 'Aguardando',
  erro: 'Erro',
};

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
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pagamento = await getPagamento(id);
  if (!pagamento) notFound();

  const [obras, fornecedores, categorias] = await Promise.all([
    listObras({ includeArchived: true }),
    listFornecedores({ includeArchived: true }),
    listCategorias(),
  ]);

  const obra = obras.find((o) => o.id === pagamento.obra_id) ?? null;
  const fornecedor = pagamento.fornecedor_id
    ? fornecedores.find((f) => f.id === pagamento.fornecedor_id) ?? null
    : null;
  const categoria = pagamento.categoria_id
    ? categorias.find((c) => c.id === pagamento.categoria_id) ?? null
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
              <Button variant="secondary" leadingIcon={<Pencil size={14} />}>Editar</Button>
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

function Section({
  title,
  span = 1,
  children,
}: {
  title: string;
  span?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <section className={`detail-layout__section ${span === 2 ? 'detail-layout__section--wide' : ''}`}>
      <h3 className="detail-layout__legend">{title}</h3>
      <dl className="detail-layout__rows">{children}</dl>
    </section>
  );
}

function Row({
  label,
  value,
  href,
  swatch,
  strong,
  multiline,
}: {
  label: string;
  value: string;
  href?: string | undefined;
  swatch?: string | null;
  strong?: boolean;
  multiline?: boolean;
}) {
  const style: React.CSSProperties = {};
  if (strong) style.fontWeight = 600;
  return (
    <div className="detail-layout__row">
      <dt className="detail-layout__label">{label}</dt>
      <dd
        className={multiline ? 'detail-layout__value detail-layout__value--multiline' : 'detail-layout__value'}
        style={style}
      >
        {swatch ? (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 3,
              background: swatch,
              marginRight: 8,
              verticalAlign: 'middle',
            }}
          />
        ) : null}
        {href ? (
          <Link href={href} className="obras-row-link">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
