import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import { atualizarWebhook, regenerarSecret } from '../../actions';
import '../../webhooks.css';
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

export default async function EditarWebhookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const sp = await searchParams;
  const errorMsg = sp.error ?? null;

  const { data: wh } = await supabase
    .from('webhooks_outbound')
    .select('id, nome, url, eventos, ativo')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!wh) notFound();

  const eventosAtivos = new Set(wh.eventos as string[]);

  return (
    <>
      <TopBar
        title="Editar webhook"
        subtitle={wh.nome}
      />

      <div className="nos-page-body">
        <form action={atualizarWebhook} className="form-layout">
          <input type="hidden" name="id" value={wh.id} />

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
                  defaultValue={wh.nome}
                  autoComplete="off"
                />
              </div>
              <div className="form-layout__field form-layout__field--wide">
                <Input
                  label="URL do endpoint"
                  name="url"
                  type="url"
                  required
                  defaultValue={wh.url}
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
                  <input
                    type="checkbox"
                    name="eventos"
                    value={ev.value}
                    defaultChecked={eventosAtivos.has(ev.value)}
                  />
                  <div className="wh-evento-info">
                    <span className="wh-evento-name">{ev.label}</span>
                    <span className="wh-evento-desc">{ev.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Disponibilidade</legend>
            <label className="wh-ativo-row">
              <input
                type="checkbox"
                name="ativo"
                value="on"
                defaultChecked={wh.ativo}
              />
              <div>
                <div className="wh-ativo-row__label">Webhook ativo</div>
                <div className="wh-ativo-row__desc">
                  Quando inativo, nenhum evento sera enviado para este endpoint
                </div>
              </div>
            </label>
          </fieldset>

          <div className="form-layout__actions">
            <Link href="/config/webhooks" className="form-layout__cancel">
              Cancelar
            </Link>
            <Button type="submit" variant="primary">
              Salvar alteracoes
            </Button>
          </div>
        </form>

        {/* Regenerar secret — acao separada, fora do form principal */}
        <div style={{ marginTop: 32, maxWidth: 960 }}>
          <fieldset
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: '16px 20px',
              background: 'var(--surface-1)',
            }}
          >
            <legend
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '0 6px',
                marginLeft: -6,
              }}
            >
              Secret de assinatura
            </legend>
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                margin: '8px 0 14px',
                lineHeight: 1.5,
              }}
            >
              O secret atual nao e exibido por seguranca. Se suspeitar de comprometimento,
              gere um novo — todos os envios posteriores usarao o novo secret.
            </p>
            <form action={regenerarSecret}>
              <input type="hidden" name="id" value={wh.id} />
              <Button type="submit" variant="secondary">
                Regenerar secret
              </Button>
            </form>
          </fieldset>
        </div>
      </div>
    </>
  );
}
