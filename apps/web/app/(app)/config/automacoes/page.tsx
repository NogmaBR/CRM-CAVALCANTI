import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { listarAutomacoes } from '@/lib/automations/registry';
import { createClient } from '@/lib/supabase/server';
import { Ban, FlaskConical, Play, TriangleAlert, Zap } from 'lucide-react';
import { notFound } from 'next/navigation';
import { alternarAutomacao, salvarConfigAutomacao, simularAutomacoes } from './actions';
// Mesma anatomia de tela das outras de configuração (banner + tabela +
// ações em linha), então reaproveita o CSS em vez de manter uma segunda cópia.
import '../categorias/categorias.css';
// `config-hub__section-title`, usado no título do histórico, mora aqui.
import '../config.css';

/**
 * Painel de automações.
 *
 * É a parte do n8n que valia a pena manter: ver o que existe, ligar e
 * desligar, ajustar um prazo, e **olhar o que aconteceu**. O resto — desenhar
 * o fluxo arrastando caixinha — virou código versionado em
 * `lib/automations/definitions`.
 *
 * A tela cruza duas fontes que podem discordar, e mostrar essa discordância é
 * metade da utilidade dela:
 *
 *   - o **código** (`listarAutomacoes()`), que diz quais regras existem;
 *   - o **banco** (`automation_rules`), que diz quais estão ligadas.
 *
 * Regra em código sem linha no banco = nunca configurada, nasce desligada.
 * Linha no banco sem regra em código = órfã (regra removida num deploy), e o
 * motor a ignora — mas ela fica visível aqui, senão vira um fantasma que
 * ninguém entende.
 */

const STATUS_ROTULO: Record<string, string> = {
  sucesso: 'Executada',
  pulada: 'Não se aplicava',
  falha: 'Falhou',
  simulada: 'Ensaio',
};

export default async function AutomacoesPage({
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

  // Mesmo recorte da policy `automation_rules_write`: ligar automação mexe no
  // que o cliente recebe.
  if (profile?.papel !== 'admin' && profile?.papel !== 'gestor') notFound();

  const params = await searchParams;
  const successMsg = params.success ?? null;
  const errorMsg = params.error ?? null;

  const doCodigo = listarAutomacoes();

  const { data: regrasDb } = await supabase
    .from('automation_rules')
    .select('chave, ativo, config, updated_at');

  const { data: execucoes } = await supabase
    .from('automation_executions')
    .select('regra_chave, evento, status, motivo, duracao_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(25);

  const porChave = new Map((regrasDb ?? []).map((r) => [r.chave, r]));

  const linhas = doCodigo.map((a) => {
    const db = porChave.get(a.chave);
    return {
      ...a,
      ativo: db?.ativo ?? false,
      config: (db?.config as Record<string, unknown> | null) ?? a.configPadrao,
      configurada: db != null,
    };
  });

  const orfas = (regrasDb ?? []).filter((r) => !doCodigo.some((a) => a.chave === r.chave));

  const ligadasComEfeitoExterno = linhas.filter((l) => l.ativo && l.efeitoExterno);
  const log = execucoes ?? [];

  return (
    <>
      <TopBar
        title="Automações"
        subtitle="O que o sistema faz sozinho — e o registro de cada decisão"
        actions={
          <form action={simularAutomacoes}>
            <Button type="submit" variant="secondary" leadingIcon={<FlaskConical size={16} />}>
              Ensaiar sem agir
            </Button>
          </form>
        }
      />

      <div className="nos-page-body">
        {/*
          `<output>` e não `<div role="status">`, que é o que as telas irmãs
          usam: o elemento já carrega a semântica de região viva, e o Biome
          recusa o role redundante. As outras telas são anteriores à regra e
          estão no baseline de lint pendente — não é divergência por acaso.
        */}
        {successMsg ? (
          <output className="categorias-banner categorias-banner--success">{successMsg}</output>
        ) : null}

        {errorMsg ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            {errorMsg}
          </div>
        ) : null}

        {/*
          Aviso permanente enquanto houver regra ligada que fala com gente de
          fora. Não é alarmismo: a diferença entre "escreve no log" e "manda
          WhatsApp para um fornecedor" é a diferença entre um erro que se
          conserta e um que já chegou no celular de alguém.
        */}
        {ligadasComEfeitoExterno.length > 0 ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" style={{ verticalAlign: 'middle' }} />{' '}
            {ligadasComEfeitoExterno.length === 1
              ? 'Há 1 automação ligada que envia mensagem para fora do sistema.'
              : `Há ${ligadasComEfeitoExterno.length} automações ligadas que enviam mensagem para fora do sistema.`}{' '}
            Confira os telefones cadastrados antes de deixar rodar.
          </div>
        ) : null}

        <div className="categorias-table-wrap">
          <table className="categorias-table">
            <thead>
              <tr>
                <th>Automação</th>
                <th>Quando roda</th>
                <th>Situação</th>
                <th>Parâmetros</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((a) => (
                <tr key={a.chave}>
                  <td>
                    <span className="categorias-nome">{a.descricao}</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #666)', marginTop: 2 }}>
                      <code>{a.chave}</code>
                      {a.efeitoExterno ? (
                        <>
                          {' · '}
                          <span style={{ color: '#b45309' }}>
                            <Zap size={10} aria-hidden="true" style={{ verticalAlign: 'middle' }} />{' '}
                            envia mensagem para fora
                          </span>
                        </>
                      ) : (
                        ' · só registra no sistema'
                      )}
                    </div>
                  </td>

                  <td style={{ fontSize: 12 }}>
                    {a.agendada ? 'Todo dia, 9h' : 'Ao acontecer o evento'}
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #666)', marginTop: 2 }}>
                      {a.gatilhos.length > 0 ? a.gatilhos.join(', ') : 'só agendada'}
                    </div>
                  </td>

                  <td>
                    {a.ativo ? (
                      <span className="categorias-contagem categorias-contagem--active">
                        Ligada
                      </span>
                    ) : (
                      <span className="categorias-archived-badge">
                        {a.configurada ? 'Desligada' : 'Nunca ligada'}
                      </span>
                    )}
                  </td>

                  <td>
                    <form action={salvarConfigAutomacao}>
                      <input type="hidden" name="chave" value={a.chave} />
                      <textarea
                        name="config"
                        defaultValue={JSON.stringify(a.config)}
                        rows={2}
                        spellCheck={false}
                        aria-label={`Parâmetros de ${a.descricao}`}
                        style={{
                          width: '100%',
                          minWidth: 200,
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: 11,
                          padding: 4,
                        }}
                      />
                      <button
                        type="submit"
                        className="categorias-action-btn"
                        style={{ marginTop: 4 }}
                        disabled={!a.configurada}
                      >
                        Salvar
                      </button>
                    </form>
                  </td>

                  <td>
                    <div className="categorias-actions">
                      <form action={alternarAutomacao} style={{ display: 'contents' }}>
                        <input type="hidden" name="chave" value={a.chave} />
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
                              Desligar
                            </>
                          ) : (
                            <>
                              <Play size={12} aria-hidden="true" />
                              Ligar
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {orfas.map((o) => (
                <tr key={o.chave} style={{ opacity: 0.6 }}>
                  <td>
                    <span className="categorias-nome">
                      <code>{o.chave}</code>
                    </span>
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                      Existe no banco, mas não no código — o motor ignora. Sobra de uma regra
                      removida.
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>—</td>
                  <td>
                    <span className="categorias-archived-badge">Órfã</span>
                  </td>
                  <td style={{ fontSize: 11 }}>
                    <code>{JSON.stringify(o.config)}</code>
                  </td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="config-hub__section-title" style={{ marginTop: 32 }}>
          Histórico
        </h2>

        {/*
          O log inclui as execuções `pulada`, e isso é o ponto. "Por que não
          cobraram esse fornecedor?" quase sempre se responde na coluna
          Motivo — sem ela, a pergunta não tem resposta em lugar nenhum.
        */}
        {log.length === 0 ? (
          <div className="categorias-empty">
            <p style={{ margin: 0 }}>
              Nada registrado ainda. Use <strong>Ensaiar sem agir</strong> para ver o que as regras
              ligadas fariam, sem que nada saia do sistema.
            </p>
          </div>
        ) : (
          <div className="categorias-table-wrap">
            <table className="categorias-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Automação</th>
                  <th>Resultado</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e, i) => (
                  <tr key={`${e.regra_chave}-${e.created_at}-${i}`}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {e.created_at
                        ? new Date(e.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <code>{e.regra_chave}</code>
                      <div style={{ fontSize: 11, color: 'var(--text-muted, #666)' }}>
                        {e.evento}
                      </div>
                    </td>
                    <td>
                      {e.status === 'falha' ? (
                        <span className="categorias-banner categorias-banner--error">
                          {STATUS_ROTULO[e.status] ?? e.status}
                        </span>
                      ) : e.status === 'sucesso' ? (
                        <span className="categorias-contagem categorias-contagem--active">
                          {STATUS_ROTULO[e.status]}
                        </span>
                      ) : (
                        <span className="categorias-archived-badge">
                          {STATUS_ROTULO[e.status] ?? e.status}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {e.motivo ?? <span style={{ color: 'var(--text-muted, #666)' }}>—</span>}
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
