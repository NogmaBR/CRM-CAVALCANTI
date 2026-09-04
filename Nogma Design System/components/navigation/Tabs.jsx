import React from "react";

const CSS = `
.ng-tabs{ font-family:var(--font-sans); }
.ng-tabs__list{ display:inline-flex; gap:2px; position:relative; }
.ng-tabs--line .ng-tabs__list{ gap:24px; border-bottom:var(--border-hair) solid var(--border-subtle); }
.ng-tabs__tab{
  appearance:none; border:none; background:transparent; cursor:pointer; font-family:inherit;
  font-weight:var(--fw-semibold); font-size:var(--text-sm); color:var(--text-secondary);
  transition:color var(--dur-base), background var(--dur-base);
}
.ng-tabs--line .ng-tabs__tab{ padding:12px 2px; position:relative; }
.ng-tabs--line .ng-tabs__tab::after{ content:""; position:absolute; left:0; right:0; bottom:-1px; height:2.5px;
  background:var(--petroleum-800); border-radius:2px; transform:scaleX(0); transition:transform var(--dur-base) var(--ease-out); }
.ng-tabs--line .ng-tabs__tab[aria-selected="true"]{ color:var(--text-primary); }
.ng-tabs--line .ng-tabs__tab[aria-selected="true"]::after{ transform:scaleX(1); }
.ng-tabs--pill .ng-tabs__list{ background:var(--neutral-100); padding:4px; border-radius:var(--radius-md); }
.ng-tabs--pill .ng-tabs__tab{ padding:8px 16px; border-radius:var(--radius-sm); }
.ng-tabs--pill .ng-tabs__tab[aria-selected="true"]{ background:var(--surface-card); color:var(--text-primary); box-shadow:var(--shadow-xs); }
.ng-tabs__tab:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); border-radius:var(--radius-sm); }
.ng-tabs__count{ margin-left:6px; font-size:var(--text-xs); color:var(--text-muted); font-weight:var(--fw-medium); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-tabs-css"))return;
  const s=document.createElement("style"); s.id="ng-tabs-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Tab switcher. Controlled via `value`+`onChange`, or uncontrolled with `defaultValue`. */
export function Tabs({ items = [], value, defaultValue, onChange, variant="line", className="", ...props }) {
  React.useEffect(inject, []);
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = value !== undefined ? value : internal;
  const select = (v) => { if (value === undefined) setInternal(v); onChange && onChange(v); };
  return (
    <div className={["ng-tabs", `ng-tabs--${variant}`, className].filter(Boolean).join(" ")} {...props}>
      <div className="ng-tabs__list" role="tablist">
        {items.map((it) => (
          <button key={it.value} role="tab" aria-selected={active===it.value}
                  className="ng-tabs__tab" onClick={() => select(it.value)}>
            {it.label}
            {it.count != null ? <span className="ng-tabs__count">{it.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
