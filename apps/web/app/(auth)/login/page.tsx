import Image from 'next/image';
import { ArrowRight, Mail, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { Checkbox } from '@/components/nogma/Checkbox';
import { login } from './actions';

type SearchParams = Promise<{ error?: string }>;

export const metadata = {
  title: 'Entrar · Gestor de Obras Nogma',
};

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;

  return (
    <div className="nos-login">
      <aside className="nos-login__aside on-black">
        <Image
          className="nos-login__logo"
          src="/logos/logo-nogma-lime.png"
          alt="Nogma"
          width={140}
          height={34}
          priority
        />
        <div className="nos-login__pitch">
          <h2>
            Sua obra <span className="nos-mark">controlada no WhatsApp</span>.
          </h2>
          <p>Pagamentos, comprovantes e notas fiscais organizados sozinhos.</p>
        </div>
        <div className="nos-login__stats">
          <div>
            <strong>10</strong>
            <span>obras ativas</span>
          </div>
          <div>
            <strong>R$ 453k</strong>
            <span>investido</span>
          </div>
          <div>
            <strong>124</strong>
            <span>documentos</span>
          </div>
        </div>
      </aside>

      <main className="nos-login__panel">
        <div className="nos-login__card">
          <h1>Entrar</h1>
          <p className="nos-login__hint">Acesse o painel da Cavalcanti.</p>

          {error ? (
            <div className="nos-login__error" role="alert">
              <AlertCircle size={16} strokeWidth={2.4} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <form action={login} className="nos-login__form" noValidate>
            <Input
              label="E-mail"
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="voce@cavalcanti.com.br"
              leading={<Mail size={16} color="var(--text-muted)" aria-hidden="true" />}
            />
            <Input
              label="Senha"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              leading={<Lock size={16} color="var(--text-muted)" aria-hidden="true" />}
            />
            <div className="nos-login__row">
              <Checkbox label="Manter conectada" name="remember" defaultChecked />
              <span className="nos-login__link nos-login__link--disabled" title="Em breve">
                Esqueci a senha
              </span>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
            >
              Entrar
            </Button>
          </form>
          <div className="nos-login__foot">Nogma · Gestor de Obras</div>
        </div>
      </main>
    </div>
  );
}
