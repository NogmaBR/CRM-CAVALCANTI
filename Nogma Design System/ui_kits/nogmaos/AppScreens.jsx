/* NogmaOS — Dashboard, Automations, Agent chat. Exports window.NogmaOSScreens */
const { Card, Stat, Badge, Switch, Progress, Button, Avatar, Tabs } = window.NogmaDesignSystem_54b71f;
const Ic = window.NogmaIcon;

const AUTOMATIONS = [
  { name: "Conciliação de notas fiscais", agent: "Fiscal", status: "active", runs: "1.240", rate: 98, last: "há 4 min" },
  { name: "Follow-up de propostas", agent: "Vendas", status: "active", runs: "612", rate: 91, last: "há 18 min" },
  { name: "Triagem de atendimento", agent: "Suporte", status: "active", runs: "3.480", rate: 96, last: "há 2 min" },
  { name: "Fechamento financeiro", agent: "Fiscal", status: "paused", runs: "88", rate: 100, last: "ontem" },
  { name: "Onboarding de clientes", agent: "CS", status: "active", runs: "204", rate: 87, last: "há 1 h" },
];

/* ---------------- Dashboard ---------------- */
function DashboardScreen({ onOpenAgent }) {
  return (
    <div className="nos-page">
      <div className="nos-greet">
        <div>
          <div className="nos-eyebrow">Segunda, 1 de julho</div>
          <h2 className="nos-greet__title">Bom dia, Ana 👋</h2>
        </div>
        <Button variant="primary" leadingIcon={<Ic name="plus" size={18} />}>Nova automação</Button>
      </div>

      <div className="nos-kpis">
        <Card accent><Stat label="Horas economizadas / mês" value="128h" delta="+18%" caption="vs. junho" /></Card>
        <Card><Stat label="Processos ativos" value="24" delta="+3" caption="este mês" /></Card>
        <Card><Stat label="Taxa de sucesso" value="95%" delta="+1,2pp" caption="média 30 dias" /></Card>
        <Card><Stat label="Execuções / semana" value="6.4k" delta="-2%" direction="down" caption="vs. semana anterior" /></Card>
      </div>

      <div className="nos-cols">
        <Card padded={false} className="nos-tablecard">
          <div className="nos-tablecard__head">
            <div>
              <div className="nos-tablecard__title">Automações ativas</div>
              <div className="nos-tablecard__sub">Rodando agora na sua operação</div>
            </div>
            <button className="nos-linkbtn" onClick={()=>onOpenAgent("automations")}>Ver todas <Ic name="arrow-right" size={15} /></button>
          </div>
          <table className="nos-table">
            <thead><tr><th>Automação</th><th>Agente</th><th>Status</th><th>Sucesso</th><th></th></tr></thead>
            <tbody>
              {AUTOMATIONS.slice(0,4).map((a) => (
                <tr key={a.name}>
                  <td><div className="nos-cellmain">{a.name}</div><div className="nos-cellsub">{a.runs} execuções · {a.last}</div></td>
                  <td><Badge variant="petroleum">{a.agent}</Badge></td>
                  <td>{a.status === "active"
                    ? <Badge variant="success" dot>Ativa</Badge>
                    : <Badge variant="neutral" dot>Pausada</Badge>}</td>
                  <td style={{width:130}}><Progress value={a.rate} tone={a.rate>=95?"lime":"petroleum"} /></td>
                  <td><button className="nos-iconbtn nos-iconbtn--ghost" aria-label="Abrir" onClick={()=>onOpenAgent("agents")}><Ic name="chevron-right" size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="nos-side">
          <Card className="nos-agentcard">
            <div className="nos-agentcard__top">
              <span className="nos-agentcard__ic"><Ic name="sparkles" size={20} color="var(--petroleum-950)" /></span>
              <div><div className="nos-agentcard__title">Agente Fiscal</div><div className="nos-agentcard__meta">Online · aprendeu 3 regras hoje</div></div>
            </div>
            <p className="nos-agentcard__body">“Concluí a conciliação de 142 notas. 2 exigem sua revisão.”</p>
            <Button variant="solid" size="sm" block onClick={()=>onOpenAgent("agents")} trailingIcon={<Ic name="message-square" size={16} />}>Conversar</Button>
          </Card>

          <Card title="Atividade recente" padded>
            <ul className="nos-feed">
              <li><span className="nos-feed__dot nos-feed__dot--ok" /><div><b>Triagem de atendimento</b> processou 38 tickets<span className="nos-feed__t">há 2 min</span></div></li>
              <li><span className="nos-feed__dot nos-feed__dot--warn" /><div><b>Follow-up</b> aguarda aprovação de 4 propostas<span className="nos-feed__t">há 18 min</span></div></li>
              <li><span className="nos-feed__dot nos-feed__dot--ok" /><div><b>Onboarding</b> concluiu cadastro de 12 clientes<span className="nos-feed__t">há 1 h</span></div></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Automations list ---------------- */
function AutomationsScreen({ onOpenAgent }) {
  const [tab, setTab] = React.useState("ativos");
  const [toggles, setToggles] = React.useState(() => AUTOMATIONS.map(a => a.status === "active"));
  const rows = AUTOMATIONS.filter((a) =>
    tab === "todos" ? true : tab === "ativos" ? a.status === "active" : a.status === "paused");
  return (
    <div className="nos-page">
      <div className="nos-greet">
        <Tabs variant="line" value={tab} onChange={setTab}
          items={[{value:"ativos",label:"Ativas",count:AUTOMATIONS.filter(a=>a.status==="active").length},
                  {value:"pausados",label:"Pausadas",count:AUTOMATIONS.filter(a=>a.status==="paused").length},
                  {value:"todos",label:"Todas",count:AUTOMATIONS.length}]} />
        <div style={{display:"flex",gap:10}}>
          <Button variant="secondary" leadingIcon={<Ic name="filter" size={16} />}>Filtrar</Button>
          <Button variant="primary" leadingIcon={<Ic name="plus" size={18} />}>Nova automação</Button>
        </div>
      </div>

      <Card padded={false} className="nos-tablecard">
        <table className="nos-table nos-table--full">
          <thead><tr><th>Automação</th><th>Agente</th><th>Execuções</th><th>Taxa de sucesso</th><th>Última</th><th>Ativa</th><th></th></tr></thead>
          <tbody>
            {rows.map((a) => {
              const idx = AUTOMATIONS.indexOf(a);
              return (
              <tr key={a.name}>
                <td><div className="nos-cellmain">{a.name}</div></td>
                <td><Badge variant="petroleum">{a.agent}</Badge></td>
                <td className="nos-num">{a.runs}</td>
                <td style={{width:170}}><Progress value={a.rate} showValue tone={a.rate>=95?"lime":"petroleum"} /></td>
                <td className="nos-cellsub">{a.last}</td>
                <td><Switch tone="lime" checked={toggles[idx]} onChange={()=>setToggles(t=>t.map((v,i)=>i===idx?!v:v))} /></td>
                <td><button className="nos-iconbtn nos-iconbtn--ghost" aria-label="Abrir" onClick={()=>onOpenAgent("agents")}><Ic name="chevron-right" size={18} /></button></td>
              </tr>);
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------- Agent chat ---------------- */
const SEED = [
  { from: "agent", text: "Oi, Ana. Rodei a conciliação de notas fiscais de hoje: 142 documentos, 140 conciliados automaticamente." },
  { from: "agent", text: "2 notas ficaram com divergência de valor. Quer que eu envie para revisão do financeiro?" },
  { from: "user", text: "Sim, envia. E me mostra o resumo da semana." },
  { from: "agent", text: "Feito ✅ — enviei as 2 divergências para o João. Na semana: 1.240 notas processadas, 98% de sucesso, ~11h economizadas." },
];

function AgentScreen() {
  const [msgs, setMsgs] = React.useState(SEED);
  const [draft, setDraft] = React.useState("");
  const bodyRef = React.useRef(null);
  React.useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs]);
  const send = () => {
    const t = draft.trim(); if (!t) return;
    setMsgs((m) => [...m, { from: "user", text: t }]); setDraft("");
    setTimeout(() => setMsgs((m) => [...m, { from: "agent", text: "Entendido — já estou processando isso e te aviso assim que concluir." }]), 650);
  };
  return (
    <div className="nos-agent">
      <div className="nos-chat">
        <div className="nos-chat__head">
          <span className="nos-chat__ic"><Ic name="sparkles" size={20} color="var(--petroleum-950)" /></span>
          <div className="nos-chat__id"><div className="nos-chat__name">Agente Fiscal</div><div className="nos-chat__status"><span className="nos-online" />Online · conectado ao ERP</div></div>
          <Badge variant="lime">GPT-4 · pt-BR</Badge>
        </div>
        <div className="nos-chat__body" ref={bodyRef}>
          {msgs.map((m, i) => (
            <div key={i} className={"nos-msg nos-msg--" + m.from}>
              {m.from === "agent" && <span className="nos-msg__av"><Ic name="bot" size={16} color="var(--lime-500)" /></span>}
              <div className="nos-msg__bubble">{m.text}</div>
            </div>
          ))}
        </div>
        <div className="nos-chat__composer">
          <button className="nos-iconbtn nos-iconbtn--ghost" aria-label="Anexar"><Ic name="file-text" size={18} /></button>
          <input value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter") send(); }} placeholder="Peça um resumo, ajuste uma regra…" />
          <button className="nos-sendbtn" onClick={send} aria-label="Enviar"><Ic name="send" size={18} color="var(--petroleum-950)" /></button>
        </div>
      </div>

      <div className="nos-agent__rail">
        <Card title="Ferramentas conectadas" padded>
          <ul className="nos-tools">
            <li><span className="nos-tool__ic"><Ic name="file-text" size={16} /></span>ERP Fiscal<Badge variant="success" dot>OK</Badge></li>
            <li><span className="nos-tool__ic"><Ic name="mail" size={16} /></span>E-mail<Badge variant="success" dot>OK</Badge></li>
            <li><span className="nos-tool__ic"><Ic name="chart" size={16} /></span>Planilhas<Badge variant="warning" dot>Token</Badge></li>
          </ul>
        </Card>
        <Card title="Esta semana" padded>
          <div className="nos-railstats">
            <Stat label="Notas processadas" value="1.240" />
            <Stat label="Horas economizadas" value="11h" delta="+9%" />
          </div>
        </Card>
      </div>
    </div>
  );
}

window.NogmaOSScreens = { DashboardScreen, AutomationsScreen, AgentScreen };
