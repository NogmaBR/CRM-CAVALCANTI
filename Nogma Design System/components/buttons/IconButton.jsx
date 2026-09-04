import React from "react";

const CSS = `
.ng-iconbtn{
  --_bg:transparent; --_fg:var(--text-primary); --_bd:transparent;
  display:inline-flex; align-items:center; justify-content:center;
  border:var(--border-thin) solid var(--_bd); border-radius:var(--radius-md);
  background:var(--_bg); color:var(--_fg); cursor:pointer; padding:0;
  transition:background var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base);
  -webkit-tap-highlight-color:transparent;
}
.ng-iconbtn:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); }
.ng-iconbtn:active{ transform:scale(.9); }
.ng-iconbtn[disabled]{ opacity:.45; pointer-events:none; }
.ng-iconbtn--sm{ width:36px; height:36px; }
.ng-iconbtn--md{ width:44px; height:44px; }
.ng-iconbtn--lg{ width:52px; height:52px; }
.ng-iconbtn--round{ border-radius:var(--radius-pill); }
.ng-iconbtn--ghost:hover{ --_bg:var(--neutral-100); }
.ng-iconbtn--outline{ --_bd:var(--border-default); }
.ng-iconbtn--outline:hover{ --_bg:var(--neutral-50); --_bd:var(--border-strong); }
.ng-iconbtn--primary{ --_bg:var(--lime-500); --_fg:var(--petroleum-950); }
.ng-iconbtn--primary:hover{ --_bg:var(--lime-300); }
.ng-iconbtn--solid{ --_bg:var(--petroleum-800); --_fg:#fff; }
.ng-iconbtn--solid:hover{ --_bg:var(--petroleum-700); }
.on-dark .ng-iconbtn,[data-theme="dark"] .ng-iconbtn,.on-black .ng-iconbtn,[data-theme="black"] .ng-iconbtn{ --_fg:var(--white); }
.on-dark .ng-iconbtn--ghost:hover,[data-theme="dark"] .ng-iconbtn--ghost:hover,.on-black .ng-iconbtn--ghost:hover,[data-theme="black"] .ng-iconbtn--ghost:hover{ --_bg:color-mix(in srgb,#fff 12%,transparent); }
`;

function inject(){ if(typeof document==="undefined"||document.getElementById("ng-iconbtn-css"))return;
  const s=document.createElement("style"); s.id="ng-iconbtn-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Square/round icon-only button. Always pass an accessible `label`. */
export function IconButton({ icon, label, variant="ghost", size="md", round=false, className="", ...props }) {
  React.useEffect(inject, []);
  const cls = ["ng-iconbtn",`ng-iconbtn--${variant}`,`ng-iconbtn--${size}`, round?"ng-iconbtn--round":"", className].filter(Boolean).join(" ");
  return <button className={cls} aria-label={label} title={label} {...props}>{icon}</button>;
}
