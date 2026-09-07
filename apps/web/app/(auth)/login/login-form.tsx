'use client';

import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useRef, useState } from 'react';
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { Checkbox } from '@/components/nogma/Checkbox';
import { login } from './actions';

export function LoginForm() {
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaToken, setCaptchaToken] = useState<string>('');

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  return (
    <form
      action={async (fd) => {
        fd.set('captchaToken', captchaToken);
        await login(fd);
        // On redirect-based error, reset captcha so user can retry
        captchaRef.current?.resetCaptcha();
        setCaptchaToken('');
      }}
      className="nos-login__form"
      noValidate
    >
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

      {siteKey ? (
        <div style={{ margin: '8px 0', display: 'flex', justifyContent: 'center' }}>
          <HCaptcha
            ref={captchaRef}
            sitekey={siteKey}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken('')}
            theme="dark"
          />
        </div>
      ) : null}

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
        disabled={!captchaToken}
      >
        Entrar
      </Button>
    </form>
  );
}
