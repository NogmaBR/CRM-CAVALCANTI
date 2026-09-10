import 'server-only';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Saúde do sistema, funda.
 *
 * Não é um "ping". Um endpoint que devolve `{"ok":true}` porque o processo
 * subiu responde à pergunta errada: **o site estar no ar não é o problema
 * deste sistema.** O problema é o cron que parou, a fila que não é drenada, a
 * automação que falha em silêncio.
 *
 * A checagem tem duas metades:
 *
 *   - **Banco** (`saude_sistema()`): crons vivos, filas fluindo, automações sem
 *     falha, dead-letter vazia. Só o Postgres conhece esse estado — parte dele
 *     nem é exposta pela API.
 *   - **Ambiente**: quais integrações estão configuradas. Só o processo sabe.
 *
 * ## 503 quando doente, e não 200 com um campo
 *
 * Devolver sempre 200 e pôr o veredito no corpo obriga quem monitora a fazer
 * parse. Com 503, qualquer coisa que fale HTTP consegue alertar.
 *
 * ## Protegido, e por quê
 *
 * O corpo diz quais integrações faltam e quantas automações falharam — mapa de
 * fraquezas para quem quiser sondar. Mesma autenticação dos crons.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { ok: false, problemas: ['ambiente sem credencial do Supabase'] },
      { status: 503 },
    );
  }

  const supabase = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const inicio = Date.now();

  // Integrações: presença da variável, nunca o valor.
  //
  // Faltar integração é **aviso, não problema**: hoje é o estado esperado, e
  // transformar o esperado em alarme treina todo mundo a ignorar alarme — que
  // é exatamente como o check vermelho do CI deixou de significar algo.
  const integracoes = {
    whatsapp: Boolean(process.env.UAZAPI_BASE_URL && process.env.UAZAPI_TOKEN),
    classificador:
      (process.env.IA_PROVIDER ?? 'mock') === 'anthropic' && Boolean(process.env.ANTHROPIC_API_KEY),
    transcricao:
      (process.env.IA_TRANSCRICAO_PROVIDER ?? 'none') === 'openai' &&
      Boolean(process.env.OPENAI_API_KEY),
    busca:
      (process.env.IA_EMBEDDINGS_PROVIDER ?? 'none') === 'openai' &&
      Boolean(process.env.OPENAI_API_KEY),
    filaAssincrona: process.env.FILA_WHATSAPP === 'true',
  };

  const avisosAmbiente = Object.entries(integracoes)
    .filter(([, ligada]) => !ligada)
    .map(([nome]) => `integração "${nome}" não configurada`);

  let banco: {
    ok: boolean;
    problemas: string[];
    avisos: string[];
  };

  try {
    const { data, error } = await supabase.rpc('saude_sistema');
    if (error) throw new Error(error.message);

    const bruto = data as { ok: boolean; problemas: string[]; avisos: string[] } | null;
    banco = bruto ?? { ok: false, problemas: ['saude_sistema devolveu vazio'], avisos: [] };
  } catch (err) {
    // Não conseguir perguntar ao banco é, por si só, o pior estado possível.
    banco = {
      ok: false,
      problemas: [`banco inacessível: ${err instanceof Error ? err.message : String(err)}`],
      avisos: [],
    };
  }

  const saudavel = banco.ok;

  return NextResponse.json(
    {
      ok: saudavel,
      problemas: banco.problemas,
      avisos: [...banco.avisos, ...avisosAmbiente],
      integracoes,
      // A própria latência é um sinal: as funções rodam na Virgínia e o banco
      // em São Paulo. Uma leitura muito acima do normal é sintoma antes de
      // virar sintoma.
      latencia_banco_ms: Date.now() - inicio,
    },
    { status: saudavel ? 200 : 503 },
  );
}
