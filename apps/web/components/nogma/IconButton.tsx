import * as React from 'react';
import './IconButton.css';

export type IconButtonVariant = 'ghost' | 'outline' | 'primary' | 'solid';
export type IconButtonSize = 'sm' | 'md' | 'lg';

/** Icon-only button. Requires an accessible `label` (used for aria-label + tooltip). */
export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** The icon node (SVG / icon-font element). */
  icon: React.ReactNode;
  /** Accessible label — required. */
  label: string;
  /** @default "ghost" */
  variant?: IconButtonVariant;
  /** @default "md" */
  size?: IconButtonSize;
  /** Fully rounded (pill/circle). */
  round?: boolean;
}

/** Square/round icon-only button. Always pass an accessible `label`. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  round = false,
  className = '',
  ...props
}: IconButtonProps) {
  const cls = [
    'ng-iconbtn',
    `ng-iconbtn--${variant}`,
    `ng-iconbtn--${size}`,
    round ? 'ng-iconbtn--round' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} aria-label={label} title={label} {...props}>
      {icon}
    </button>
  );
}
