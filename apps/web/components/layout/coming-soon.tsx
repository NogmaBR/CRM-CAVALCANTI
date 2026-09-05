import { Check } from 'lucide-react';

export interface ComingSoonProps {
  /** e.g. "PRÓXIMA FASE — FASE 4" */
  eyebrow?: string;
  /** Big headline, e.g. "Obras". */
  title: string;
  /** Lead paragraph explaining what this section will do. */
  lead: string;
  /** Bullet list of concrete deliverables. */
  items: Array<{ label: string; hint?: string }>;
}

/**
 * Elegant placeholder for future CRM sections. Follows Nogma DS voice:
 * eyebrow → big display headline → lead → concrete deliverables list with
 * lime tick icons. Used across /obras, /documentos, /whatsapp, etc.
 */
export function ComingSoon({ eyebrow = 'EM CONSTRUÇÃO', title, lead, items }: ComingSoonProps) {
  return (
    <article className="nos-coming nos-fade-up">
      <div className="nos-coming__eyebrow">{eyebrow}</div>
      <h2 className="nos-coming__title">
        {title}
      </h2>
      <p className="nos-coming__lead">{lead}</p>
      <ul className="nos-coming__list">
        {items.map((item, i) => (
          <li key={i}>
            <Check size={16} strokeWidth={2.6} />
            <span>
              <strong>{item.label}</strong>
              {item.hint ? <span style={{ color: 'var(--text-muted)' }}>{item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
