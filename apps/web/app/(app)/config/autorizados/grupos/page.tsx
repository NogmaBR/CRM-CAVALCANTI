import { estadoDoFormulario } from '@/app/(app)/_shared/form-erros';
import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { EmptyState } from '@/components/nogma/EmptyState';
import { Input } from '@/components/nogma/Input';
import { createClient } from '@/lib/supabase/server';
import { ArrowLeft, Ban, Plus, RotateCcw, TriangleAlert, Users } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { alternarAtivoGrupo, atualizarObraDoGrupo, criarGrupo } from './actions';
import '../../categorias/categorias.css';
import '@/app/(app)/_shared/form-layout.css';

export const metadata = { title: 'Grupos de WhatsApp' };

/**
 * Grupos em que o agente age. Mesma postura dos números: lista fechada,
 * grupo desconhecido é ignorado em silêncio. O id do grupo aparece no log
 * como `ignorada_grupo_nao_autorizado` na primeira mensagem — é de lá que se
 * copia.
 */
export default async function GruposPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; campo?: string; v?: string }>;
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
  const successMsg = params.success ?? null;
  const errorMsg = estado.error ?? params.error ?? null;

  const [{ data: grupos }, { data: obras }] = await Promise.all([
    supabase
      .from('whatsapp_grupos')
      .select('id, chat_id, nome, ativo, obra_id, obras ( nome )')
      .is('deleted_at', null)
      .order('ativo', { ascending: false })
      .order('nome'),
    supabase
      .from('obras')
      .select('id, nome')
      .is('deleted_at', null)
      .eq('status', 'ativa')
      .order('nome'),
  ]);

  const lista = grupos ?? [];
  const obrasAtivas = obras ?? [];
  const nenhumAtivo = lista.every((g) => !g.ativo);

  return (
    <>
      <TopBar
        title="Grupos de WhatsApp"
        subtitle="Em quais grupos o agente lê e responde"
        actions={
          <Link href="/config/autorizados" className="detail-layout__back">
            <ArrowLeft size={15} aria-hidden="true" />
            Números
          </Link>
        }
      />

      <div className="nos-page-body">
        {successMsg ? (
          <div
            className="categorias-banner categorias-banner--success"
            // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
            role="status"
          >
            {successMsg}
          </div>
        ) : null}

        {errorMsg ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        {lista.length === 0 || nenhumAtivo ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" style={{ verticalAlign: 'middle' }} />{' '}
            Nenhum grupo ativo. Mensagem vinda de grupo é ignorada até o grupo estar aqui — o id
            aparece no log como <code>ignorada_grupo_nao_autorizado</code> na primeira mensagem. No
            privado, os números autorizados continuam funcionando.
          </div>
        ) : null}

        <form action={criarGrupo} className="form-layout" style={{ marginBottom: 24 }}>
          <fieldset className="form-layout__section">
            <legend className="form-layout__legend">Cadastrar grupo</legend>
            <div className="form-layout__grid">
              <div className="form-layout__field">
                <Input
                  label="Id do grupo"
                  name="chat_id"
                  required
                  defaultValue={v.chat_id ?? ''}
                  placeholder="120363012345678901@g.us"
                  autoComplete="off"
                  error={erroDe('chat_id')}
                  autoFocus={campo === 'chat_id'}
                />
              </div>
              <div className="form-layout__field">
                <Input
                  label="Nome"
                  name="nome"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={v.nome ?? ''}
                  placeholder="Ex: Obras Cavalcanti"
                  autoComplete="off"
                  error={erroDe('nome')}
                  autoFocus={campo === 'nome'}
                />
              </div>
              <div className="form-layout__field">
                <label className="form-layout__label" htmlFor="grupo-obra">
                  Obra dedicada (opcional)
                </label>
                <select
                  id="grupo-obra"
                  name="obra_id"
                  className="form-layout__select"
                  defaultValue={v.obra_id ?? ''}
                >
                  <option value="">Nenhuma — o agente pergunta a obra quando precisar</option>
                  {obrasAtivas.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
          <div className="form-layout__actions">
            <Button type="submit" variant="primary" leadingIcon={<Plus size={16} />}>
              Cadastrar grupo
            </Button>
          </div>
        </form>

        {lista.length === 0 ? (
          <EmptyState icon={<Users size={28} aria-hidden="true" />} title="Nenhum grupo cadastrado">
            Crie o grupo no WhatsApp com a equipe e o número do agente, mande uma mensagem, copie o
            id do log e cadastre aqui.
          </EmptyState>
        ) : (
          <div className="categorias-table-wrap">
            <table className="categorias-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Id do grupo</th>
                  <th>Obra dedicada</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span className="categorias-nome">{g.nome}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: 12 }}>{g.chat_id}</code>
                    </td>
                    <td>
                      <form
                        action={atualizarObraDoGrupo}
                        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                      >
                        <input type="hidden" name="id" value={g.id} />
                        <label className="sr-only" htmlFor={`obra-${g.id}`}>
                          Obra dedicada
                        </label>
                        <select
                          id={`obra-${g.id}`}
                          name="obra_id"
                          className="form-layout__select"
                          defaultValue={g.obra_id ?? ''}
                          style={{ minHeight: 36 }}
                        >
                          <option value="">Nenhuma</option>
                          {obrasAtivas.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nome}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="categorias-action-btn">
                          Salvar
                        </button>
                      </form>
                    </td>
                    <td>
                      {g.ativo ? (
                        <span className="categorias-contagem categorias-contagem--active">
                          Ativo
                        </span>
                      ) : (
                        <span className="categorias-archived-badge">Desativado</span>
                      )}
                    </td>
                    <td>
                      <div className="categorias-actions">
                        <form action={alternarAtivoGrupo} style={{ display: 'contents' }}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="ativar" value={g.ativo ? 'false' : 'true'} />
                          <button
                            type="submit"
                            className={
                              g.ativo
                                ? 'categorias-action-btn categorias-action-btn--danger'
                                : 'categorias-action-btn'
                            }
                          >
                            {g.ativo ? (
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
