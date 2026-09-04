import React from "react";

/* Inject component styles once (design-system tokens drive all values). */
const CSS = `
.ng-btn{
  --_bg: var(--brand); --_fg: var(--brand-text); --_bd: transparent;
  display:inline-flex; align-items:center; justify-content:center; gap:.5em;
  font-family:var(--font-sans); font-weight:var(--fw-semibold);
  letter-spacing:var(--tracking-tight); line-height:1; white-space:nowrap;
  border:var(--border-thin) solid var(--_bd); border-radius:var(--radius-md);
  background:var(--_bg); color:var(--_fg); cursor:pointer;
  transition:transform var(--dur-fast) var(--ease-out),
             background var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out), opacity var(--dur-base);
  -webkit-tap-highlight-color:transparent; user-select:none; text-decoration:none;
}
.ng-btn:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); }
.ng-btn:active{ transform:translateY(1px) scale(.985); }
.ng-btn[disabled]{ opacity:.45; pointer-events:none; }

/* sizes */
.ng-btn--sm{ height:36px; padding:0 14px; font-size:var(--text-sm); }
.ng-btn--md{ height:44px; padding:0 20px; font-size:var(--text-base); }
.ng-btn--lg{ height:52px; padding:0 28px; font-size:var(--text-lg); }
.ng-btn--block{ width:100%; }

/* variants */
.ng-btn--primary{ --_bg:var(--lime-500); --_fg:var(--petroleum-950); }
.ng-btn--primary:hover{ --_bg:var(--lime-300); box-shadow:var(--shadow-lime); }
.ng-btn--solid{ --_bg:var(--petroleum-800); --_fg:var(--white); }
.ng-btn--solid:hover{ --_bg:var(--petroleum-700); }
.ng-btn--secondary{ --_bg:transparent; --_fg:var(--text-primary); --_bd:var(--border-default); }
.ng-btn--secondary:hover{ --_bg:var(--neutral-50); --_bd:var(--border-strong); }
.ng-btn--ghost{ --_bg:transparent; --_fg:var(--text-primary); }
.ng-btn--ghost:hover{ --_bg:var(--neutral-100); }
.ng-btn--danger{ --_bg:var(--danger); --_fg:#fff; }
.ng-btn--danger:hover{ --_bg:color-mix(in srgb, var(--danger) 88%, #000); }
.on-dark .ng-btn--secondary,[data-theme="dark"] .ng-btn--secondary,.on-black .ng-btn--secondary,[data-theme="black"] .ng-btn--secondary{ --_fg:var(--white); }
.on-dark .ng-btn--ghost:hover,[data-theme="dark"] .ng-btn--ghost:hover,.on-black .ng-btn--ghost:hover,[data-theme="black"] .ng-btn--ghost:hover{ --_bg:color-mix(in srgb,#fff 12%,transparent); }
`;

function useInjected(id, css) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id; el.textContent = css; document.head.appendChild(el);
  }, [id, css]);
}

/**
 * Nogma primary action button. `primary` = lime CTA, the brand's signature call to action.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  leadingIcon,
  trailingIcon,
  as = "button",
  className = "",
  ...props
}) {
  useInjected("ng-btn-css", CSS);
  const Tag = as;
  const cls = [
    "ng-btn",
    `ng-btn--${variant}`,
    `ng-btn--${size}`,
    block ? "ng-btn--block" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <Tag className={cls} {...props}>
      {leadingIcon ? <span className="ng-btn__icon" aria-hidden="true">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span className="ng-btn__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </Tag>
  );
}
