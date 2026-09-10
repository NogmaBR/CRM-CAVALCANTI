import { TopBar } from '@/components/layout/topbar';
import { arquivadas, metricas } from '@/lib/queue/fila';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { Inbox, TriangleAlert } from 'lucide-react';
import { notFound } from 'next/navigation';
import '../categorias/categorias.css';
import '../config.css';

/**
 * Observação das filas.
 *
 * É o que o painel do BullMQ dá pronto e aqui é uma tela: quanto tem em cada
 * fila, o que está esperando há tempo demais, e **o que desistiu**.
 *
 * A terceira é a que importa quando algo não aconteceu. Uma mensagem que falha
 * três vezes vai para a dead-letter e sai do caminho — sem esta tela, sair do
 * caminho seria o mesmo que sumir.
 */

export const dynamic = 'force-dynamic';

function idade(segundos: number | null): string {
  if (segundos == null) return '—';
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3600) return `${Math.floor(segundos / 60)}min`;
  if (segundos < 86_400) return `${Math.floor(segundos / 3600)}h`;
  return `${Math.floor(segundos / 86_400)}d`;
}

export default async function FilasPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();

  if (profile?.papel !== 'admin' && profile?.papel !== 'gestor') notFound();

  // As funções `fila_*` só têm GRANT para service_role: fila não é coisa que
  // sessão de usuário mexe. A checagem de papel acima é o que autoriza esta
  // leitura; o cliente de serviço é só o meio de fazê-la.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notFound();

  const service = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [filas, mortas] = await Promise.all([
    metricas(service).catch(() => []),
    arquivadas(service, 30).catch(() => []),
  ]);

  const totalNaFila = filas.reduce((a, f) => a + f.naFila, 0);

  // Uma fila com mensagem parada há muito tempo é o sintoma de consumidor que
  // não está rodando — e é diferente de fila cheia, que é só volume.
  const paradaHaMuito = filas.filter((f) => (f.maisAntigaSeg ?? 0) > 900);

  return (
    <>
      <TopBar title="Filas" subtitle="O que está esperando para ser processado, e o que desistiu" />

      <div className="nos-page-body">
        {paradaHaMuito.length > 0 ? (
          <div className="categorias-banner categorias-banner--error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" style={{ verticalAlign: 'middle' }} />{' '}
            {paradaHaMuito.length === 1
              ? `A fila "${paradaHaMuito[0]?.fila}" tem mensagem parada há mais de 15 minutos.`
              : `${paradaHaMuito.length} filas com mensagem parada há mais de 15 minutos.`}{' '}
            Isso costuma significar que o consumidor não está sendo chamado — confira o agendamento
            (<code>cron.job</code>) e os segredos do Vault.
          </div>
        ) : null}

        <div className="categorias-table-wrap">
          <table className="categorias-table">
            <thead>
              <tr>
                <th>Fila</th>
                <th>Esperando</th>
                <th>Visíveis agora</th>
                <th>Mais antiga</th>
                <th>Total histórico</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-muted, #666)' }}>
                    Nenhuma fila encontrada.
                  </td>
                </tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.fila}>
                    <td>
                      <span className="categorias-nome">
                        <code>{f.fila}</code>
                      </span>
                    </td>
                    <td>
                      {f.naFila > 0 ? (
                        <span className="categorias-contagem categorias-contagem--active">
                          {f.naFila}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted, #666)' }}>vazia</span>
                      )}
                    </td>
                    {/*
                      "Visíveis" difere de "esperando" quando há mensagem sendo
                      processada neste instante: ela sai da visibilidade por
                      alguns segundos e volta se ninguém concluir.
                    */}
                    <td>{f.visiveis}</td>
                    <td>{idade(f.maisAntigaSeg)}</td>
                    <td style={{ color: 'var(--text-muted, #666)' }}>{f.totalJaEnfileirado}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalNaFila === 0 && mortas.length === 0 ? (
          <div className="categorias-empty" style={{ marginTop: 24 }}>
            <Inbox size={32} aria-hidden="true" style={{ opacity: 0.5, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              Nada na fila e nada arquivado. É o estado normal quando tudo está sendo processado na
              hora.
            </p>
          </div>
        ) : null}

        <h2 className="config-hub__section-title" style={{ marginTop: 32 }}>
          Desistiram
        </h2>

        {mortas.length === 0 ? (
          <div className="categorias-empty">
            <p style={{ margin: 0 }}>
              Nenhuma mensagem foi arquivada. Uma mensagem só chega aqui depois de falhar três vezes
              seguidas.
            </p>
          </div>
        ) : (
          <div className="categorias-table-wrap">
            <table className="categorias-table">
              <thead>
                <tr>
                  <th>Quando desistiu</th>
                  <th>Fila</th>
                  <th>Tentativas</th>
                  <th>Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                {mortas.map((m) => (
                  <tr key={`${m.fila}-${m.msgId}`}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(m.arquivadoEm).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <code>{m.fila}</code>
                    </td>
                    <td>{m.tentativas}</td>
                    <td
                      style={{
                        fontSize: 11,
                        fontFamily: 'var(--font-mono, monospace)',
                        maxWidth: 420,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {JSON.stringify(m.payload).slice(0, 200)}
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
