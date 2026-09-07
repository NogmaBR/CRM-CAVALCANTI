import Link from 'next/link';
import { MessageSquare, Paperclip, ArrowRight } from 'lucide-react';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { listMensagens, type MensagemFeedItem, type MsgStatus } from '@/lib/data/mensagens';
import './whatsapp.css';

const STATUS_VARIANT: Record<MsgStatus, BadgeVariant> = {
  recebida: 'neutral',
  processando: 'warning',
  classificada: 'warning',
  confirmada: 'success',
  erro: 'danger',
};

const STATUS_LABEL: Record<MsgStatus, string> = {
  recebida: 'Recebida',
  processando: 'Processando',
  classificada: 'Aguarda confirmação',
  confirmada: 'Confirmada',
  erro: 'Erro / rejeitada',
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'classificada', label: 'Aguarda confirmação' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'erro', label: 'Erro' },
];

function formatTelefone(digits: string): string {
  // '5511987654321' → '+55 (11) 98765-4321'
  const s = digits.replace(/\D/gu, '');
  if (s.length === 13) return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
  if (s.length === 12) return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 8)}-${s.slice(8)}`;
  return digits;
}

function formatBRL(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = (params.status ?? '') as '' | MsgStatus;

  const all = await listMensagens(200);
  const items = statusFilter === '' ? all : all.filter((m) => m.status === statusFilter);

  return (
    <>
      <TopBar title="WhatsApp" subtitle="Fila de mensagens recebidas e classificadas pela IA" />
      <div className="nos-page-body">
        <nav className="whatsapp-filter-tabs" aria-label="Filtrar por status">
          {FILTER_OPTIONS.map((opt) => {
            const href = opt.value === '' ? '/whatsapp' : `/whatsapp?status=${opt.value}`;
            const active = opt.value === statusFilter;
            return (
              <Link
                key={opt.value || 'todas'}
                href={href}
                className={active ? 'whatsapp-filter-tab is-active' : 'whatsapp-filter-tab'}
                aria-current={active ? 'page' : undefined}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>

        {items.length === 0 ? (
          <div className="whatsapp-empty">
            <MessageSquare size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              {statusFilter
                ? `Nenhuma mensagem com status "${STATUS_LABEL[statusFilter as MsgStatus]}".`
                : 'Ainda não recebemos mensagens de WhatsApp. Quando o UAZAPI estiver ligado, elas aparecem aqui em tempo real.'}
            </p>
          </div>
        ) : (
          <ul className="whatsapp-feed" style={{ listStyle: 'none', padding: 0 }}>
            {items.map((m) => (
              <MensagemRow key={m.id} m={m} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function MensagemRow({ m }: { m: MensagemFeedItem }) {
  const hasMedia = !!m.midia_mime;
  return (
    <li className="wa-item">
      <div>
        <div className="wa-item__header">
          <span className="wa-item__phone">{formatTelefone(m.telefone_from)}</span>
          <span>·</span>
          <span>{formatDateTime(m.recebida_em)}</span>
          <span>·</span>
          <span style={{ textTransform: 'capitalize' }}>{m.tipo}</span>
          {hasMedia ? (
            <>
              <span>·</span>
              <span aria-label={`Anexo ${m.midia_mime}`}>
                <Paperclip size={12} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {m.midia_mime}
              </span>
            </>
          ) : null}
        </div>
        <div className="wa-item__body">{m.texto_bruto ?? <em style={{ color: 'var(--text-secondary)' }}>(sem texto)</em>}</div>
        {m.status === 'erro' && m.erro_msg ? (
          <div className="wa-item__error">Erro: {m.erro_msg}</div>
        ) : null}
      </div>
      <div className="wa-item__meta">
        <Badge variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Badge>
        {m.confianca_ia != null ? (
          <span>Confiança IA: {Math.round(Number(m.confianca_ia) * 100)}%</span>
        ) : null}
        {m.pagamento_id ? (
          <Link href={`/pagamentos/${m.pagamento_id}`} className="wa-item__link">
            {formatBRL(m.pagamento_valor)}
            {m.pagamento_obra_nome ? ` · ${m.pagamento_obra_nome}` : ''}{' '}
            <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: 'middle' }} />
          </Link>
        ) : m.status === 'classificada' ? (
          <Link href="/pendentes" className="wa-item__link">
            Confirmar em Pendentes <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: 'middle' }} />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
