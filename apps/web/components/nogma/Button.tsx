import * as React from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'solid' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Nogma action button. The lime `primary` variant is the brand's signature CTA;
 * use `solid` (petroleum) for strong secondary actions, `secondary`/`ghost` for
 * lower-emphasis actions, `danger` for destructive ones.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. @default "primary" */
  variant?: ButtonVariant;
  /** @default "md" */
  size?: ButtonSize;
  /** Stretch to full container width. */
  block?: boolean;
  /** Icon element rendered before the label. */
  leadingIcon?: React.ReactNode;
  /** Icon element rendered after the label. */
  trailingIcon?: React.ReactNode;
  /** Render as another element/component (e.g. "a"). @default "button" */
  as?: React.ElementType;
  children?: React.ReactNode;
}

/**
 * Nogma primary action button. `primary` = lime CTA, the brand's signature call to action.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  leadingIcon,
  trailingIcon,
  as: Tag = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const cls = [
    'ng-btn',
    `ng-btn--${variant}`,
    `ng-btn--${size}`,
    block ? 'ng-btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Component = Tag as React.ElementType;
  return (
    <Component className={cls} {...props}>
      {leadingIcon ? (
        <span className="ng-btn__icon" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}
      {children}
      {trailingIcon ? (
        <span className="ng-btn__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}
    </Component>
  );
}
