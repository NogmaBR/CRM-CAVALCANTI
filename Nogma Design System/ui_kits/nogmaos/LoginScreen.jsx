/* NogmaOS — Login screen. Exports window.NogmaOSLogin */
const { Button, Input, Checkbox } = window.NogmaDesignSystem_54b71f;
const NgIcon = window.NogmaIcon;

function LoginScreen({ onLogin }) {
  const [email, setEmail] = React.useState("ana@vitrine.com.br");
  const [pw, setPw] = React.useState("••••••••");
  return (
    <div className="nos-login">
      <div className="nos-login__aside">
        <img className="nos-login__logo" src="../../assets/logo-nogma-lime.png" alt="nogma" />
        <div className="nos-login__pitch">
          <div className="nos-login__eyebrow">NogmaOS</div>
          <h2>Sua operação no <span className="nos-mark">piloto automático</span>.</h2>
          <p>Seu painel de agentes, fluxos e indicadores — num só lugar.</p>
        </div>
        <div className="nos-login__stats">
          <div><strong>128h</strong><span>economizadas / mês</span></div>
          <div><strong>+42%</strong><span>produtividade</span></div>
          <div><strong>24</strong><span>processos ativos</span></div>
        </div>
      </div>

      <div className="nos-login__panel">
        <div className="nos-login__card">
          <h1>Entrar</h1>
          <p className="nos-login__hint">Acesse o painel da sua operação.</p>
          <div className="nos-login__form">
            <Input label="E-mail" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} leading={<NgIcon name="mail" size={16} color="var(--text-muted)" />} />
            <Input label="Senha" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} leading={<NgIcon name="lock" size={16} color="var(--text-muted)" />} />
            <div className="nos-login__row">
              <Checkbox label="Manter conectada" defaultChecked />
              <a className="nos-login__link" href="#">Esqueci a senha</a>
            </div>
            <Button variant="primary" size="lg" block onClick={onLogin} trailingIcon={<NgIcon name="arrow-right" size={18} />}>Entrar</Button>
          </div>
          <div className="nos-login__foot">Protegido por SSO · Nogma Consultoria</div>
        </div>
      </div>
    </div>
  );
}
window.NogmaOSLogin = LoginScreen;
