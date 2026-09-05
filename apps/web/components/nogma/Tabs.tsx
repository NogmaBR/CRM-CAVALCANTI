'use client';
import * as React from 'react';
import './Tabs.css';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional count shown after the label. */
  count?: number;
}

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** @default "line" */
  variant?: 'line' | 'pill';
}

/** Tab switcher. Controlled via `value`+`onChange`, or uncontrolled with `defaultValue`. */
export function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = 'line',
  className = '',
  ...props
}: TabsProps) {
  const [internal, setInternal] = React.useState(
    defaultValue ?? (items[0] && items[0].value),
  );
  const active = value !== undefined ? value : internal;

  const select = (v: string) => {
    if (value === undefined) setInternal(v);
    if (onChange) onChange(v);
  };

  return (
    <div
      className={['ng-tabs', `ng-tabs--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <div className="ng-tabs__list" role="tablist">
        {items.map((it) => (
          <button
            key={it.value}
            role="tab"
            aria-selected={active === it.value}
            className="ng-tabs__tab"
            onClick={() => select(it.value)}
          >
            {it.label}
            {it.count != null ? (
              <span className="ng-tabs__count">{it.count}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
