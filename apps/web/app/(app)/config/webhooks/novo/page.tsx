import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { criarWebhook } from '../actions';
import '../webhooks.css';
import { estadoDoFormulario } from '@/app/(app)/_shared/form-erros';
import '@/app/(app)/_shared/form-layout.css';

export const metadata = { title: 'Novo webhook' };

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
  {
    value: 'confirmacao_resolvida',
    label: 'confirmacao_resolvida',
    desc: 'Pendencia confirmada (pelo painel ou pelo "SIM" no WhatsApp)',
  },
  {
    value: 'confirmacao_recusada',
    label: 'confirmacao_recusada',
    desc: 'Pendencia recusada (pelo painel ou pelo "NAO" no WhatsApp)',
  },
] as const;

export default async function NovoWebhookPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; campo?: string; v?: string }>;
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
  const estado = estadoDoFormulario(params);
  const v = estado.valores;
  const campo = estado.campo;
  const erroCurto = estado.error ? estado.error.replace(/^[^:]+:\s*/u, '') : undefined;
  const erroDe = (name: string) => (campo === name ? erroCurto : undefined);
  // `eventos` são checkboxes múltiplos; a action os junta por vírgula para
  // sobreviverem à URL (o codificador guarda um valor por chave).
  const eventosPreservados =
    v.eventos !== undefined ? new Set(v.eventos.split(',').filter(Boolean)) : null;
  const errorMsg = estado.error ?? null;

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
                  defaultValue={v.nome ?? ''}
                  placeholder="Ex: Notificacoes n8n producao"
                  autoComplete="off"
                  error={erroDe('nome')}
                  autoFocus={campo === 'nome'}
                />
              </div>
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="URL do endpoint"
                  name="url"
                  type="url"
                  required
                  defaultValue={v.url ?? ''}
                  placeholder="https://seu-servidor.com/webhook"
                  autoComplete="off"
                  hint="Deve comecar com https:// (ou http:// para testes locais)"
                  error={erroDe('url')}
                  autoFocus={campo === 'url'}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Eventos</legend>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                margin: '8px 0 0 0',
                lineHeight: 1.5,
              }}
            >
              Selecione quais eventos devem disparar este webhook. Ao menos um obrigatorio.
            </p>
            <div
              className="wh-eventos-group"
              // biome-ignore lint/a11y/useSemanticElements: grupo de checkboxes com rótulo (fieldset quebraria o grid)
              role="group"
              aria-label="Eventos do webhook"
            >
              {EVENTOS.map((ev) => (
                <label key={ev.value} className="wh-evento-label">
                  <input
                    type="checkbox"
                    name="eventos"
                    value={ev.value}
                    defaultChecked={eventosPreservados?.has(ev.value) ?? false}
                  />
                  <div className="wh-evento-info">
                    <span className="wh-evento-name">{ev.label}</span>
                    <span className="wh-evento-desc">{ev.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="form-layout__obrigatorio">* obrigatório</p>

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
