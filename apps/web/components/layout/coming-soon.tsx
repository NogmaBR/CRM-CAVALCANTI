import { Check, Sparkles } from 'lucide-react';

export interface ComingSoonProps {
  /** Product-context tag (e.g. "Fase 4 · CRUD Base"). Rendered as functional
   *  Badge in-flow, NOT as eyebrow above the title. */
  phase?: string;
  /** Big headline, e.g. "Chega em breve" or "Em construção". */
  title: string;
  /** Lead paragraph explaining what this section will do. */
  lead: string;
  /** Bullet list of concrete deliverables. */
  items: Array<{ label: string; hint?: string }>;
}

/**
 * Elegant placeholder for future CRM sections. Follows Nogma DS voice:
 * a Badge with the phase context sits *inline* (not eyebrow), then the
 * heading carries its own weight. Lead paragraph, then a checked
 * deliverable list with lime tick icons.
 */
export function ComingSoon({ phase, title, lead, items }: ComingSoonProps) {
  return (
    <article className="nos-coming nos-fade-up">
      <h2 className="nos-coming__title">{title}</h2>
      {phase ? (
        <span className="nos-coming__phase">
          <Sparkles size={13} strokeWidth={2.5} />
          {phase}
        </span>
      ) : null}
      <p className="nos-coming__lead">{lead}</p>
      <ul className="nos-coming__list">
        {items.map((item, i) => (
          <li key={i}>
            <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            <span>
              <strong>{item.label}</strong>
              {item.hint ? <span className="nos-coming__hint">{item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
