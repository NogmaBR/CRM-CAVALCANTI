import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import { whatsappConfigurado } from '@/lib/services/uazapi';
import { createClient } from '@/lib/supabase/server';
import {
  avaliarWebhook,
  statusDaInstancia,
  urlDoWebhook,
  webhooksDaInstancia,
} from '@/lib/whatsapp/diagnostico';
import { ArrowLeft, CheckCircle2, CircleAlert, Send, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { enviarMensagemDeTeste } from './actions';
import '../categorias/categorias.css';
import '@/app/(app)/_shared/form-layout.css';

export const metadata = { title: 'Diagnóstico do WhatsApp' };
export const dynamic = 'force-dynamic';

/**
 * Uma tela para responder "o WhatsApp está funcionando?" sem abrir o log da
 * Vercel nem o painel do provider: instância, webhook item a item, quem está
 * autorizado, o que chegou nos últimos dias (com o id do grupo pronto para
 * cadastrar) e um botão para mandar uma mensagem de teste.
 *
 * Nasceu para a fase de testes com o número do operador; fica depois, como
 * diagnóstico permanente.
 */

function Marca({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 size={16} aria-label="ok" style={{ color: '#1f7a4d', verticalAlign: 'middle' }} />
  ) : (
    <XCircle
      size={16}
      aria-label="problema"
      style={{ color: 'var(--danger)', verticalAlign: 'middle' }}
    />
  );
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export default async function WhatsappDiagnosticoPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
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

  const [status, webhooks, autorizados, grupos, eventos, ultimaMensagem] = await Promise.all([
    statusDaInstancia(),
    webhooksDaInstancia(),
    supabase
      .from('autorizados')
      .select('id, nome, telefone_norm')
      .is('deleted_at', null)
      .eq('ativo', true),
    supabase.from('whatsapp_grupos').select('id, chat_id, nome, ativo').is('deleted_at', null),
    supabase
      .from('webhook_eventos')
      .select(
        'id, recebido_em, autenticacao, evento, chat_id, remetente, is_group, tipo, acao, detalhe',
      )
      .order('recebido_em', { ascending: false })
      .limit(50),
    supabase
      .from('mensagens_whats')
      .select('created_at, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const urlEsperada = urlDoWebhook();
  const checagens = avaliarWebhook(webhooks, urlEsperada);
  const listaAutorizados = autorizados.data ?? [];
  const listaGrupos = grupos.data ?? [];
  const gruposCadastrados = new Set(listaGrupos.map((g) => g.chat_id));
  const listaEventos = eventos.data ?? [];
  const gruposVistos = [
    ...new Map(
      listaEventos
        .filter((e) => e.is_group && e.chat_id && !gruposCadastrados.has(e.chat_id))
        .map((e) => [e.chat_id as string, e]),
    ).values(),
  ];

  const provider = process.env.IA_PROVIDER ?? 'mock';
  const iaLigada =
    (provider === 'openai' && Boolean(process.env.OPENAI_API_KEY)) ||
    (provider === 'anthropic' && Boolean(process.env.ANTHROPIC_API_KEY));
  const ambiente = [
    {
      ok: whatsappConfigurado(),
      item: 'Credencial do UAZAPI na Vercel',
      detalhe: whatsappConfigurado()
        ? 'UAZAPI_BASE_URL e UAZAPI_TOKEN definidas.'
        : 'Faltam UAZAPI_BASE_URL / UAZAPI_TOKEN (e um redeploy). Sem elas o CRM recebe mas nunca responde.',
    },
    {
      ok: Boolean(process.env.WEBHOOK_HMAC_SECRET || process.env.UAZAPI_TOKEN),
      item: 'Prova de origem do webhook',
      detalhe:
        'O UAZAPI não assina: o CRM confere o token da instância que vem no corpo (ou um HMAC em x-signature).',
    },
    {
      ok: iaLigada,
      item: 'IA (classificador)',
      detalhe: iaLigada
        ? `Provider ${provider}.`
        : 'IA em modo mock: foto vira documento sem valor, texto é lido por regra fixa.',
    },
    {
      ok: listaAutorizados.length > 0,
      item: 'Números autorizados',
      detalhe:
        listaAutorizados.length > 0
          ? `${listaAutorizados.length} ativo(s): ${listaAutorizados.map((a) => a.nome).join(', ')}`
          : 'Nenhum. Toda mensagem é ignorada até cadastrar alguém em /config/autorizados.',
    },
    {
      ok: listaGrupos.some((g) => g.ativo),
      item: 'Grupos cadastrados',
      detalhe: listaGrupos.some((g) => g.ativo)
        ? listaGrupos
            .filter((g) => g.ativo)
            .map((g) => g.nome)
            .join(', ')
        : 'Nenhum grupo ativo. Mensagem de grupo é ignorada; o id aparece abaixo quando chegar.',
    },
  ];

  return (
    <>
      <TopBar
        title="Diagnóstico do WhatsApp"
        subtitle="Instância, webhook, autorizados e o que chegou"
        actions={
          <Link href="/config" className="detail-layout__back">
            <ArrowLeft size={15} aria-hidden="true" />
            Configurações
          </Link>
        }
      />

      <div className="nos-page-body">
        {params.success ? (
          // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
          <div className="categorias-banner categorias-banner--success" role="status">
            {params.success}
          </div>
        ) : null}
        {params.error ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            {params.error}
          </div>
        ) : null}

        <section className="form-layout__section" style={{ marginBottom: 24 }}>
          <h2 className="form-layout__legend">1. Instância (o número do agente)</h2>
          {!status.configurado ? (
            <p>
              <Marca ok={false} /> Sem credencial na Vercel — não dá para consultar o provider.
            </p>
          ) : !status.alcancavel ? (
            <p>
              <Marca ok={false} /> Provider não respondeu ({status.erro ?? 'sem detalhe'}). Confira
              UAZAPI_BASE_URL e UAZAPI_TOKEN.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
              <li>
                <Marca ok={status.conectado} /> Estado: <strong>{status.estado ?? '—'}</strong>
                {status.conectado ? '' : ' — conecte a instância (QR code) no painel do UAZAPI.'}
              </li>
              <li>
                Número: <code>{status.numero ?? '—'}</code>
                {status.nomePerfil ? ` · ${status.nomePerfil}` : ''}
                {status.nomeInstancia ? ` · instância "${status.nomeInstancia}"` : ''}
              </li>
              <li>Última desconexão: {fmt(status.ultimaDesconexao)}</li>
            </ul>
          )}
        </section>

        <section className="form-layout__section" style={{ marginBottom: 24 }}>
          <h2 className="form-layout__legend">2. Webhook no provider</h2>
          <p style={{ marginTop: 0 }}>
            URL que o UAZAPI precisa chamar: <code>{urlEsperada}</code>
          </p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {checagens.map((c) => (
              <li key={c.item}>
                <Marca ok={c.ok} /> <strong>{c.item}</strong> — {c.detalhe}
              </li>
            ))}
          </ul>
        </section>

        <section className="form-layout__section" style={{ marginBottom: 24 }}>
          <h2 className="form-layout__legend">3. CRM</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {ambiente.map((c) => (
              <li key={c.item}>
                <Marca ok={c.ok} /> <strong>{c.item}</strong> — {c.detalhe}
              </li>
            ))}
            <li>
              Última mensagem processada:{' '}
              {ultimaMensagem.data
                ? `${fmt(ultimaMensagem.data.created_at)} (${ultimaMensagem.data.status})`
                : 'nenhuma'}
            </li>
          </ul>
        </section>

        <section className="form-layout__section" style={{ marginBottom: 24 }}>
          <h2 className="form-layout__legend">4. Mandar uma mensagem de teste</h2>
          <form action={enviarMensagemDeTeste} className="form-layout">
            <div className="form-layout__grid">
              <div className="form-layout__field">
                <Input
                  label="Para (telefone com DDI ou id do grupo)"
                  name="destino"
                  required
                  placeholder="5551999999999 ou 1203630…@g.us"
                  autoComplete="off"
                />
              </div>
              <div className="form-layout__field">
                <Input
                  label="Texto"
                  name="texto"
                  defaultValue="Teste do CRM Cavalcanti ✔"
                  maxLength={500}
                />
              </div>
            </div>
            <div className="form-layout__actions">
              <Button type="submit" variant="primary" leadingIcon={<Send size={16} />}>
                Enviar pelo agente
              </Button>
            </div>
          </form>
        </section>

        {gruposVistos.length > 0 ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            <CircleAlert size={14} aria-hidden="true" style={{ verticalAlign: 'middle' }} /> Chegou
            mensagem de grupo que não está cadastrado:{' '}
            {gruposVistos.map((g) => (
              <span key={g.id} style={{ marginRight: 12 }}>
                <code>{g.chat_id}</code>{' '}
                <Link
                  href={`/config/autorizados/grupos?chat_id=${encodeURIComponent(g.chat_id ?? '')}`}
                >
                  cadastrar
                </Link>
              </span>
            ))}
          </div>
        ) : null}

        <section className="form-layout__section">
          <h2 className="form-layout__legend">5. Últimos eventos recebidos (7 dias)</h2>
          {listaEventos.length === 0 ? (
            <p>
              Nada chegou ainda. Mande uma mensagem para o número do agente (ou no grupo) e
              recarregue.
            </p>
          ) : (
            <div className="categorias-table-wrap">
              <table className="categorias-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Chat</th>
                    <th>De</th>
                    <th>Tipo</th>
                    <th>O que o CRM fez</th>
                  </tr>
                </thead>
                <tbody>
                  {listaEventos.map((e) => (
                    <tr key={e.id}>
                      <td>{fmt(e.recebido_em)}</td>
                      <td>
                        <code style={{ fontSize: 12 }}>{e.chat_id ?? e.evento ?? '—'}</code>
                        {e.is_group ? ' (grupo)' : ''}
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{e.remetente?.split('@')[0] ?? '—'}</code>
                      </td>
                      <td>{e.tipo ?? '—'}</td>
                      <td>
                        <strong>{e.acao}</strong>
                        {e.detalhe ? ` — ${e.detalhe}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
