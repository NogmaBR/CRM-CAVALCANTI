import 'server-only';
import { executarAutomacoes } from '@/lib/automations/engine';
import { logger } from '@/lib/log';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import type { Evento, NomeEvento, PayloadDe } from './tipos';

const log = logger('eventos');

/**
 * Barramento de eventos de domínio.
 *
 * ## Como funciona hoje, e por quê
 *
 * O despacho é **síncrono e dentro da request**. Isso não é um atalho: no
 * Vercel serverless não existe processo vivo entre requests, então um bus
 * em memória com listeners registrados no boot simplesmente não sobrevive —
 * cada invocação tem o próprio heap. Assinar no boot funcionaria em dev e
 * falharia em produção de forma silenciosa, que é o pior tipo de falha.
 *
 * Então: quem emite chama `emitir`, o engine avalia as regras e age, tudo na
 * mesma invocação.
 *
 * ## O que a Fase 3 muda (e o que não muda)
 *
 * Quando entrarem fila e worker, `emitir` passa a **enfileirar** em vez de
 * executar, e o worker chama o mesmo `executarAutomacoes`. Nenhum chamador
 * muda — é por isso que a emissão está atrás desta função e não espalhada.
 *
 * Até lá vale a limitação: **ação lenta atrasa a request do usuário.** Regra
 * que faz I/O demorado (enviar WhatsApp, chamar LLM) deve ser marcada como
 * `apenasAgendada` na definition e rodar pelo cron, não no evento.
 *
 * ## Emitir nunca pode quebrar quem emitiu
 *
 * Se uma automação falhar, o pagamento tem que ser criado do mesmo jeito.
 * Automação é efeito colateral, não parte da transação. Por isso tudo aqui é
 * best-effort e a falha vai para o log, não para cima.
 */

interface OpcoesEmissao {
  /** Quem causou. `null` em cron e webhook. */
  userId?: string | null;
  /** Quando o fato aconteceu, se diferente de agora. */
  em?: string;
  /**
   * Não executa nada; só registra o que teria acontecido. Usado nos testes e
   * no botão "simular" do painel.
   */
  simular?: boolean;
}

/**
 * Cliente de serviço, montado aqui dentro de propósito.
 *
 * O motor escreve em `automation_executions`, e essa tabela **não tem policy
 * de INSERT para sessão de usuário** — quem escreve o log é o motor, nunca o
 * browser. Se `emitir` aceitasse o cliente do chamador, toda emissão vinda de
 * uma server action avaliaria as regras e perderia o registro em silêncio,
 * violando o invariante de que toda avaliação vira log. E "em silêncio" é o
 * detalhe que condena: ninguém descobriria até precisar do histórico.
 *
 * Deixar isso a cargo de quem chama seria um erro esperando para acontecer,
 * então não há o que errar: o barramento resolve sozinho.
 */
function clienteDeServico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function emitir<E extends NomeEvento>(
  nome: E,
  payload: PayloadDe<E>,
  opcoes: OpcoesEmissao = {},
): Promise<void> {
  const evento: Evento<E> = {
    nome,
    payload,
    em: opcoes.em ?? new Date().toISOString(),
    userId: opcoes.userId ?? null,
  };

  // O try cobre a montagem do cliente também, e não só o despacho: a garantia
  // que os chamadores dependem é "emitir nunca lança". Se ela valesse só da
  // metade da função para baixo, uma URL malformada no ambiente derrubaria a
  // criação do pagamento — exatamente o que este desenho existe para impedir.
  try {
    const supabase = clienteDeServico();
    if (!supabase) {
      // Ambiente sem credencial de serviço (build, preview mal configurado).
      // Degrada com log: melhor não reagir do que reagir sem poder registrar.
      console.error(`[eventos] "${nome}" não despachado: ambiente sem credencial de serviço.`);
      return;
    }

    await executarAutomacoes(supabase, evento as Evento, { simular: opcoes.simular ?? false });
  } catch (err) {
    // Chegou aqui significa que o próprio engine quebrou, não uma regra — as
    // falhas de regra são capturadas lá dentro e viram linha de log. Ainda
    // assim não propagamos: quem emitiu estava criando um pagamento.
    log.erro('engine_falhou', { evento: nome, err });
  }
}
