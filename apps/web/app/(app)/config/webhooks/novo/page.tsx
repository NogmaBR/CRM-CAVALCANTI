import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import { criarWebhook } from '../actions';
import '../webhooks.css';
import '@/app/(app)/_shared/form-layout.css';

const EVENTOS = [
  {
    value: 'pagamento_created',
    label: 'pagamento_created',
    desc: 'Novo pagamento registrado em qualquer obra',
  },
  {
    value: 'pagamento_updated',
    label: 'pagamento_updated',
    desc: 'Pagamento editado (valor, categoria, status)',
  },
  {
    value: 'confirmacao_pendente_created',
    label: 'confirmacao_pendente_created',
    desc: 'Novo item aguardando confirmacao financeira',
  },
  {
    value: 'documento_created',
    label: 'documento_created',
    desc: 'Arquivo/documento anexado a uma obra',
  },
  {
    value: 'obra_created',
    label: 'obra_created',
    desc: 'Nova obra criada no sistema',
  },
  {
    value: 'obra_archived',
    label: 'obra_archived',
    desc: 'Obra arquivada/encerrada',
  },
] as const;

export default async function NovoWebhookPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();

  if (profile?.papel !== 'admin') notFound();

  const params = await searchParams;
  const errorMsg = params.error ?? null;

  return (
    <>
      <TopBar
        title="Novo webhook"
        subtitle="Configure um endpoint para receber notificacoes do CRM"
      />

      <div className="nos-page-body">
        <form action={criarWebhook} className="form-layout">
          {errorMsg ? (
            <div className="form-layout__error" role="alert">
              {errorMsg}
            </div>
          ) : null}

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Identificacao</legend>
            <div className="form-layout__grid">
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="Nome"
                  name="nome"
                  required
                  minLength={3}
                  maxLength={80}
                  placeholder="Ex: Notificacoes n8n producao"
                  autoComplete="off"
                />
              </div>
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="URL do endpoint"
                  name="url"
                  type="url"
                  required
                  placeholder="https://seu-servidor.com/webhook"
                  autoComplete="off"
                  hint="Deve comecar com https:// (ou http:// para testes locais)"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Eventos</legend>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: 1.5 }}>
              Selecione quais eventos devem disparar este webhook. Ao menos um obrigatorio.
            </p>
            <div className="wh-eventos-group" role="group" aria-label="Eventos do webhook">
              {EVENTOS.map((ev) => (
                <label key={ev.value} className="wh-evento-label">
                  <input type="checkbox" name="eventos" value={ev.value} />
                  <div className="wh-evento-info">
                    <span className="wh-evento-name">{ev.label}</span>
                    <span className="wh-evento-desc">{ev.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-layout__actions">
            <Link href="/config/webhooks" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Criar webhook
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
