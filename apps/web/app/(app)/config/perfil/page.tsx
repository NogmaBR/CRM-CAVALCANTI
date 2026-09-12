import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { getMyProfile } from '@/lib/data/perfil';
import { PAPEL_LABELS } from '@/lib/data/usuarios';
import { TEMA_LABELS, TIMEZONE_OPTIONS } from '@/lib/schemas/perfil';
import type { Tema } from '@/lib/schemas/perfil';
import { getServerTheme } from '@/lib/theme';
import { Globe, Palette, User } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { salvarPerfil } from './actions';
import './perfil.css';
import '@/app/(app)/_shared/form-layout.css';

const TEMA_PREVIEW_CLASS: Record<Tema, string> = {
  light: 'perfil-tema-preview perfil-tema-preview--light',
  black: 'perfil-tema-preview perfil-tema-preview--black',
  dark: 'perfil-tema-preview perfil-tema-preview--dark',
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [profile, temaAtual] = await Promise.all([getMyProfile(), getServerTheme()]);
  if (!profile) redirect('/login');

  const params = await searchParams;
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;

  const temas = Object.entries(TEMA_LABELS) as [Tema, string][];

  return (
    <>
      <TopBar title="Meu perfil" subtitle="Preferências pessoais e notificações" />

      <div className="nos-page-body">
        {successMsg ? (
          // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 8,
              background: 'color-mix(in srgb, var(--brand, #a3e635) 12%, transparent)',
              color: 'var(--brand, #a3e635)',
              fontSize: 13,
              border: '1px solid color-mix(in srgb, var(--brand, #a3e635) 30%, transparent)',
            }}
          >
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="form-layout__error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        <form action={salvarPerfil} className="form-layout">
          {/* ── Fieldset 1: Informações ── */}
          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">
              <User
                size={12}
                aria-hidden="true"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              Informações
            </legend>
            <div className="form-layout__grid">
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Email"
                  name="email_readonly"
                  type="email"
                  defaultValue={profile.email}
                  readOnly
                  hint="Contate o administrador se precisar alterar"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Nome completo"
                  name="nome"
                  type="text"
                  defaultValue={profile.nome ?? ''}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Seu nome completo"
                  autoComplete="name"
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Telefone"
                  name="telefone"
                  type="tel"
                  defaultValue={profile.telefone ?? ''}
                  placeholder="(11) 98765-4321"
                  autoComplete="tel"
                />
              </div>

              <div className="form-layout__field form-layout__field--wide">
                <span className="form-layout__label">Papel</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span className="perfil-badge">{PAPEL_LABELS[profile.papel]}</span>
                </div>
                <p className="perfil-hint">Contate o administrador para alterar o papel</p>
              </div>
            </div>
          </fieldset>

          {/* ── Fieldset 2: Aparência ── */}
          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">
              <Palette
                size={12}
                aria-hidden="true"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              Aparência
            </legend>
            <div className="perfil-tema-grid">
              {temas.map(([value, label]) => (
                <label key={value} className="perfil-tema-card">
                  <input
                    type="radio"
                    name="tema"
                    value={value}
                    defaultChecked={temaAtual === value}
                  />
                  <span className={TEMA_PREVIEW_CLASS[value]} aria-hidden="true" />
                  <span className="perfil-tema-card__label">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* ── Fieldset 3: Fuso horário ── */}
          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">
              <Globe
                size={12}
                aria-hidden="true"
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              Fuso horário
            </legend>
            <div style={{ marginTop: 12 }}>
              <label className="form-layout__label" htmlFor="perfil-timezone">
                Timezone
              </label>
              <select
                id="perfil-timezone"
                name="timezone"
                className="perfil-select"
                defaultValue={profile.timezone ?? 'America/Sao_Paulo'}
                style={{ marginTop: 6 }}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="perfil-hint">Usado em datas de emails e relatórios</p>
            </div>
          </fieldset>

          {/* Nota: fieldset de notificações por email removido — automação de
              e-mail fora do escopo contratado (briefing de alinhamento 16/09). */}

          {/* ── Actions ── */}
          <div className="form-layout__actions">
            <Link href="/config/perfil" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Salvar preferências
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
