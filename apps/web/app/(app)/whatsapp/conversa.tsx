import { Badge } from '@/components/nogma/Badge';
import type { BalaoDaConversa, ConversaResumo } from '@/lib/data/mensagens';
import { MSG_STATUS_LABEL, MSG_STATUS_VARIANT } from '@/lib/status-labels';
import { ArrowRight, MessageSquare, Paperclip } from 'lucide-react';
import Link from 'next/link';

/**
 * A conversa dos dois lados: pessoa à esquerda, agente à direita, cada balão
 * com o link do que ele criou. É o "inbox" da reunião de 18/09 — antes a
 * tela mostrava só o que a pessoa mandou, e o que o agente respondeu não
 * existia em lugar nenhum do painel.
 */

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ListaDeConversas({
  conversas,
  atual,
}: {
  conversas: ConversaResumo[];
  atual: string | null;
}) {
  if (conversas.length === 0) {
    return <p className="wa-conversas__vazio">Nenhuma conversa ainda.</p>;
  }
  return (
    <nav className="wa-conversas" aria-label="Conversas">
      {conversas.map((c) => (
        <Link
          key={c.chatId}
          href={`/whatsapp?visao=conversa&chat=${encodeURIComponent(c.chatId)}`}
          className={c.chatId === atual ? 'wa-conversa is-active' : 'wa-conversa'}
          aria-current={c.chatId === atual ? 'page' : undefined}
        >
          <MessageSquare size={16} aria-hidden="true" />
          <span className="wa-conversa__nome">{c.nome}</span>
          <span className="wa-conversa__meta">
            {c.mensagens} · {hora(c.ultimaEm)}
          </span>
        </Link>
      ))}
    </nav>
  );
}

export function Conversa({ baloes }: { baloes: BalaoDaConversa[] }) {
  if (baloes.length === 0) {
    return <p className="wa-conversas__vazio">Escolha uma conversa ao lado.</p>;
  }
  return (
    <ol className="wa-baloes" aria-label="Mensagens da conversa">
      {baloes.map((b) => (
        <li key={b.id} className={`wa-balao wa-balao--${b.lado}`}>
          <div className="wa-balao__cabeca">
            <strong>{b.rotulo}</strong>
            <span>{hora(b.quando)}</span>
            {b.temArquivo ? <Paperclip size={12} aria-hidden="true" /> : null}
            {b.lado === 'pessoa' && b.status ? (
              <Badge variant={MSG_STATUS_VARIANT[b.status]}>{MSG_STATUS_LABEL[b.status]}</Badge>
            ) : null}
          </div>
          <div className="wa-balao__texto">
            {b.texto ?? <em style={{ color: 'var(--text-secondary)' }}>(sem texto)</em>}
          </div>
          {b.link ? (
            <Link href={b.link.href} className="wa-item__link">
              {b.link.rotulo}{' '}
              <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: 'middle' }} />
            </Link>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
