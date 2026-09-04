import React from "react";

const CSS = `
.ng-tip{ position:relative; display:inline-flex; }
.ng-tip__bubble{
  position:absolute; z-index:var(--z-overlay); left:50%; transform:translateX(-50%) translateY(4px);
  bottom:calc(100% + 8px); padding:6px 10px; border-radius:var(--radius-sm);
  background:var(--petroleum-950); color:#fff; font-family:var(--font-sans); font-size:var(--text-xs);
  font-weight:var(--fw-medium); white-space:nowrap; box-shadow:var(--shadow-md);
  opacity:0; pointer-events:none; transition:opacity var(--dur-base), transform var(--dur-base) var(--ease-out);
}
.ng-tip__bubble::after{ content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
  border:5px solid transparent; border-top-color:var(--petroleum-950); }
.ng-tip:hover .ng-tip__bubble, .ng-tip:focus-within .ng-tip__bubble{ opacity:1; transform:translateX(-50%) translateY(0); }
.ng-tip--bottom .ng-tip__bubble{ bottom:auto; top:calc(100% + 8px); }
.ng-tip--bottom .ng-tip__bubble::after{ top:auto; bottom:100%; border-top-color:transparent; border-bottom-color:var(--petroleum-950); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-tip-css"))return;
  const s=document.createElement("style"); s.id="ng-tip-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Lightweight CSS tooltip. Wrap the trigger; provide `label`. */
export function Tooltip({ label, side="top", children, className="", ...props }) {
  React.useEffect(inject, []);
  return (
    <span className={["ng-tip", side==="bottom"?"ng-tip--bottom":"", className].filter(Boolean).join(" ")} {...props}>
      {children}
      <span className="ng-tip__bubble" role="tooltip">{label}</span>
    </span>
  );
}
