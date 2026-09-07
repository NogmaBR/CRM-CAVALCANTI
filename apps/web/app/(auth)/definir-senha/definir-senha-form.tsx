'use client';

import { useFormStatus } from 'react-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { definirSenha } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      block
      disabled={pending}
      trailingIcon={<ArrowRight size={18} aria-hidden="true" />}
    >
      {pending ? 'Definindo...' : 'Definir e entrar'}
    </Button>
  );
}

export function DefinirSenhaForm() {
  return (
    <form action={definirSenha} className="nos-login__form" noValidate>
      <Input
        label="Nova senha"
        type="password"
        name="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        leading={<Lock size={16} color="var(--text-muted)" aria-hidden="true" />}
        hint="Use pelo menos 8 caracteres com letras e números"
      />
      <Input
        label="Confirmar senha"
        type="password"
        name="password_confirm"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Repita a senha"
        leading={<Lock size={16} color="var(--text-muted)" aria-hidden="true" />}
      />
      <SubmitButton />
    </form>
  );
}
