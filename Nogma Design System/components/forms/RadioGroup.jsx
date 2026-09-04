import React from "react";

const CSS = `
.ng-radiogroup{ display:flex; flex-direction:column; gap:10px; font-family:var(--font-sans); }
.ng-radio{ display:inline-flex; align-items:flex-start; gap:10px; cursor:pointer; user-select:none; }
.ng-radio--disabled{ opacity:.5; pointer-events:none; }
.ng-radio input{ position:absolute; opacity:0; width:0; height:0; }
.ng-radio__dot{
  flex:none; width:20px; height:20px; margin-top:1px; border-radius:50%;
  border:var(--border-thin) solid var(--border-strong); background:var(--surface-card);
  display:inline-flex; align-items:center; justify-content:center;
  transition:border-color var(--dur-fast) var(--ease-out);
}
.ng-radio__dot::after{ content:""; width:10px; height:10px; border-radius:50%; background:var(--lime-500);
  transform:scale(0); transition:transform var(--dur-fast) var(--ease-out); }
.ng-radio input:checked + .ng-radio__dot{ border-color:var(--petroleum-800); }
.ng-radio input:checked + .ng-radio__dot::after{ transform:scale(1); background:var(--lime-500); }
.ng-radio input:focus-visible + .ng-radio__dot{ box-shadow:0 0 0 3px var(--ring); }
.ng-radio__label{ font-size:var(--text-base); color:var(--text-primary); line-height:1.35; }
.ng-radio__desc{ font-size:var(--text-sm); color:var(--text-muted); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-radio-css"))return;
  const s=document.createElement("style"); s.id="ng-radio-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Controlled radio group. `options`: array of {value,label,description}. */
export function RadioGroup({ name, value, onChange, options = [], className="" }) {
  React.useEffect(inject, []);
  const gname = name || React.useId();
  return (
    <div className={["ng-radiogroup", className].filter(Boolean).join(" ")} role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={["ng-radio", o.disabled?"ng-radio--disabled":""].filter(Boolean).join(" ")}>
          <input type="radio" name={gname} value={o.value} checked={value===o.value}
                 disabled={o.disabled} onChange={() => onChange && onChange(o.value)} />
          <span className="ng-radio__dot" />
          <span>
            <span className="ng-radio__label">{o.label}</span>
            {o.description ? <span className="ng-radio__desc" style={{display:"block"}}>{o.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
