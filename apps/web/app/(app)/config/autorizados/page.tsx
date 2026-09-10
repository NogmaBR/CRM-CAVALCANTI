import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { formatarTelefone } from '@/lib/schemas/autorizado';
import { createClient } from '@/lib/supabase/server';
import { Ban, Pencil, Plus, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { alternarAtivoAutorizado } from './actions';
// Reaproveita o CSS de categorias: mesma anatomia de tela (banner + tabela +
// vazio + ações em linha). Duplicar 300 linhas de CSS pra trocar o prefixo das
// classes só criaria duas cópias pra manter em sincronia.
import '../categorias/categorias.css';

export default async function AutorizadosPage({
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
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;

  const { data: autorizados } = await supabase
    .from('autorizados')
    .select('id, nome, telefone_whats, papel_obra, ativo')
    .is('deleted_at', null)
    .order('ativo', { ascending: false })
    .order('nome');

  const lista = autorizados ?? [];
  const nenhumAtivo = lista.every((a) => !a.ativo);

  return (
    <>
      <TopBar
        title="Números autorizados"
        subtitle="Quem pode lançar pagamentos pelo WhatsApp"
        actions={
          <Link href="/config/autorizados/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Autorizar número
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        {successMsg ? (
          <div className="categorias-banner categorias-banner--success" role="status">
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        {/*
          Aviso deliberado: com a lista vazia o sistema descarta TODA mensagem
          que chega. É o comportamento seguro, mas por fora parece "o WhatsApp
          parou de funcionar" — então a tela diz isso em vez de deixar o
          usuário descobrir depois.
        */}
        {lista.length === 0 || nenhumAtivo ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" style={{ verticalAlign: 'middle' }} />{' '}
            Nenhum número ativo. Enquanto esta lista estiver vazia, todas as mensagens recebidas no
            WhatsApp serão ignoradas.
          </div>
        ) : null}

        {lista.length === 0 ? (
          <div className="categorias-empty">
            <ShieldCheck size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              Cadastre os números da equipe que pode enviar pagamentos por WhatsApp.
            </p>
          </div>
        ) : (
          <div className="categorias-table-wrap">
            <table className="categorias-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>WhatsApp</th>
                  <th>Função na obra</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="categorias-nome">{a.nome}</span>
                    </td>
                    <td>{formatarTelefone(a.telefone_whats)}</td>
                    <td>
                      {a.papel_obra ? (
                        a.papel_obra
                      ) : (
                        <span style={{ color: 'var(--text-muted, #666)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      {a.ativo ? (
                        <span className="categorias-contagem categorias-contagem--active">
                          Ativo
                        </span>
                      ) : (
                        <span className="categorias-archived-badge">Desativado</span>
                      )}
                    </td>
                    <td>
                      <div className="categorias-actions">
                        <Link
                          href={`/config/autorizados/${a.id}/editar`}
                          className="categorias-action-btn"
                        >
                          <Pencil size={12} aria-hidden="true" />
                          Editar
                        </Link>

                        <form action={alternarAtivoAutorizado} style={{ display: 'contents' }}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="ativar" value={a.ativo ? 'false' : 'true'} />
                          <button
                            type="submit"
                            className={
                              a.ativo
                                ? 'categorias-action-btn categorias-action-btn--danger'
                                : 'categorias-action-btn'
                            }
                          >
                            {a.ativo ? (
                              <>
                                <Ban size={12} aria-hidden="true" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <RotateCcw size={12} aria-hidden="true" />
                                Reativar
                              </>
                            )}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
