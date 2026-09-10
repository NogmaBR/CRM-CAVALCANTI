'use server';

import { executarAgendadas } from '@/lib/automations/engine';
import { buscarAutomacao } from '@/lib/automations/registry';
import { mapDbErrorWithContext } from '@/lib/schemas/errors';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@nogma/db';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const BASE_PATH = '/config/automacoes';

/**
 * Ações do painel de automações.
 *
 * A divisão de responsabilidade aqui espelha a do motor: a **lógica** da regra
 * vive em `lib/automations/definitions` e só muda por deploy; o que estas
 * ações mexem é o **estado** — ligada/desligada e parâmetros — que é o que o
 * gestor precisa ajustar sem esperar por nós.
 */

/**
 * Ligar automação é decidir que o sistema vai agir sozinho — no caso da
 * cobrança, mandando mensagem para gente de verdade. Fica no mesmo nível de
 * `automation_rules_write` na RLS: admin e gestor.
 *
 * A RLS é a trava real (estas ações usam a sessão do usuário, não
 * service-role). Esta checagem existe para dar uma mensagem legível em vez de
 * um erro de permissão cru.
 */
async function assertPodeConfigurar(): Promise<void> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Sessão expirada. Faça login novamente.')}`);
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('papel')
    .eq('user_id', user.id)
    .single();
  if (profile?.papel !== 'admin' && profile?.papel !== 'gestor') {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Acesso restrito a admin e gestor.')}`);
  }
}

/**
 * Liga ou desliga uma regra.
 *
 * Usa upsert porque a regra pode existir só em código: `automation_rules`
 * ganha linha no seed da migration, mas uma automação adicionada depois não
 * tem linha nenhuma até alguém ligá-la aqui. Nesse caso a linha nasce com o
 * `configPadrao` da definition.
 */
export async function alternarAutomacao(formData: FormData) {
  await assertPodeConfigurar();

  const chave = String(formData.get('chave') ?? '').trim();
  const ativar = String(formData.get('ativar') ?? '') === 'true';

  const automacao = buscarAutomacao(chave);
  if (!automacao) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(
        `"${chave}" não existe no código. Regra órfã não pode ser ligada.`,
      )}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from('automation_rules').upsert(
    {
      chave,
      ativo: ativar,
      config: (automacao.configPadrao ?? {}) as never,
    },
    { onConflict: 'chave', ignoreDuplicates: false },
  );

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(mapDbErrorWithContext(error, {}))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(
    `${BASE_PATH}?success=${encodeURIComponent(
      ativar
        ? `"${automacao.descricao}" ligada. A partir de agora ela age sozinha.`
        : `"${automacao.descricao}" desligada. Não age mais, e para de gerar log.`,
    )}`,
  );
}

/**
 * Atualiza os parâmetros da regra.
 *
 * O `config` é JSON livre de propósito: cada automação tem o seu formato, e
 * quem valida o conteúdo é a própria definition, na hora de rodar. O que se
 * valida aqui é só que seja um objeto JSON — o resto seria adivinhação.
 */
export async function salvarConfigAutomacao(formData: FormData) {
  await assertPodeConfigurar();

  const chave = String(formData.get('chave') ?? '').trim();
  const bruto = String(formData.get('config') ?? '').trim();

  if (!buscarAutomacao(chave)) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(`"${chave}" não existe no código.`)}`);
  }

  let config: unknown;
  try {
    config = JSON.parse(bruto || '{}');
  } catch {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(
        'JSON inválido. Exemplo do formato esperado: {"dias_sem_documento": 7}',
      )}`,
    );
  }

  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('A configuração precisa ser um objeto JSON.')}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('automation_rules')
    .update({ config: config as never })
    .eq('chave', chave);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent(mapDbErrorWithContext(error, {}))}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Configuração salva')}`);
}

/**
 * Ensaio: roda as regras agendadas em modo simulação.
 *
 * É o "Test workflow" do n8n. Avalia condição, decide o que faria, registra
 * como `simulada` — e não executa ação nenhuma. É o jeito de olhar para quem
 * uma cobrança seria enviada **antes** de ligar a regra de verdade.
 *
 * Precisa de service-role: o motor escreve em `automation_executions`, e essa
 * tabela não tem policy de INSERT para sessão de usuário — quem escreve o log
 * é sempre o motor, nunca o browser.
 */
export async function simularAutomacoes() {
  await assertPodeConfigurar();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('Ambiente sem credencial de serviço configurada.')}`,
    );
  }

  const service = createSbClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let relatorio: Array<{ regra: string; avaliadas: number }> = [];
  try {
    relatorio = await executarAgendadas(service, { simular: true });
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    redirect(`${BASE_PATH}?error=${encodeURIComponent(`Simulação falhou: ${detalhe}`)}`);
  }

  revalidatePath(BASE_PATH);

  if (relatorio.length === 0) {
    redirect(
      `${BASE_PATH}?success=${encodeURIComponent(
        'Simulação rodou, mas nenhuma regra agendada está ligada — nada foi avaliado.',
      )}`,
    );
  }

  const resumo = relatorio.map((r) => `${r.regra}: ${r.avaliadas}`).join(' · ');
  redirect(
    `${BASE_PATH}?success=${encodeURIComponent(
      `Simulação concluída (${resumo}). Veja o resultado no histórico abaixo.`,
    )}`,
  );
}
