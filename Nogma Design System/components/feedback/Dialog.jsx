import React from "react";

const CSS = `
.ng-dialog__overlay{
  position:fixed; inset:0; z-index:var(--z-modal); background:var(--overlay);
  display:flex; align-items:center; justify-content:center; padding:20px;
  backdrop-filter:blur(2px); animation:ngFade var(--dur-base) var(--ease-out);
}
.ng-dialog{
  width:100%; max-width:460px; background:var(--surface-card); border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xl); overflow:hidden; animation:ngPop var(--dur-base) var(--ease-out);
  border:var(--border-hair) solid var(--border-subtle);
}
.ng-dialog__head{ padding:22px 24px 0; display:flex; flex-direction:column; gap:6px; }
.ng-dialog__title{ font-family:var(--font-sans); font-weight:var(--fw-extrabold); font-size:var(--text-2xl);
  letter-spacing:var(--tracking-tight); color:var(--text-primary); }
.ng-dialog__desc{ font-size:var(--text-sm); color:var(--text-secondary); line-height:1.5; }
.ng-dialog__body{ padding:16px 24px; }
.ng-dialog__foot{ padding:16px 24px 22px; display:flex; gap:10px; justify-content:flex-end; }
.ng-dialog__close{ position:absolute; }
@keyframes ngFade{ from{opacity:0} to{opacity:1} }
@keyframes ngPop{ from{opacity:0; transform:translateY(8px) scale(.98)} to{opacity:1; transform:none} }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-dialog-css"))return;
  const s=document.createElement("style"); s.id="ng-dialog-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Centered modal dialog. Controlled via `open` + `onClose`. `footer` for actions. */
export function Dialog({ open, onClose, title, description, children, footer, className="", ...props }) {
  React.useEffect(inject, []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ng-dialog__overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget && onClose) onClose(); }}>
      <div className={["ng-dialog", className].filter(Boolean).join(" ")} role="dialog" aria-modal="true" {...props}>
        {(title || description) ? (
          <div className="ng-dialog__head">
            {title ? <div className="ng-dialog__title">{title}</div> : null}
            {description ? <div className="ng-dialog__desc">{description}</div> : null}
          </div>
        ) : null}
        {children ? <div className="ng-dialog__body">{children}</div> : null}
        {footer ? <div className="ng-dialog__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
