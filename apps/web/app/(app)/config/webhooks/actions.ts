'use server';

import { guardarSecretFlash } from '@/lib/security/flash-secret';
import { validarUrlWebhook } from '@/lib/security/ssrf';
import { generateWebhookSecret, testWebhook } from '@/lib/services/dispatch-webhook';
import { erroDeEscrita } from '@/lib/supabase/escrita';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { type Rotulos, voltarComErro } from '../../_shared/form-erros';

const BASE_PATH = '/config/webhooks';

const ROTULOS_WEBHOOK: Rotulos = { nome: 'Nome', url: 'URL do endpoint', eventos: 'Eventos' };

/**
 * O que volta para o formulário quando a action recusa. `eventos` são vários
 * checkboxes com o mesmo `name`; vão juntos por vírgula porque o codificador
 * guarda um valor por chave. O secret nunca passa por aqui.
 */
function valoresDoWebhook(formData: FormData): FormData {
  const fd = new FormData();
  fd.set('nome', String(formData.get('nome') ?? ''));
  fd.set('url', String(formData.get('url') ?? ''));
  fd.set('eventos', formData.getAll('eventos').map(String).join(','));
  if (formData.get('ativo') !== null) fd.set('ativo', 'on');
  return fd;
}

const EVENTOS_VALIDOS = [
  'pagamento_created',
  'pagamento_updated',
  'confirmacao_pendente_created',
  'documento_created',
  'obra_created',
  'obra_archived',
  'confirmacao_resolvida',
  'confirmacao_recusada',
] as const;

async function assertAdmin(): Promise<string> {
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
  if (profile?.papel !== 'admin') {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Acesso restrito a administradores.')}`);
  }
  return user.id;
}

const CriarWebhookSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  url: z
    .string()
    .url('URL inválida')
    .refine((v) => v.startsWith('http'), 'URL deve começar com http:// ou https://'),
  eventos: z.array(z.enum(EVENTOS_VALIDOS)).min(1, 'Selecione ao menos um evento'),
});

const AtualizarWebhookSchema = z.object({
  id: z.string().uuid('ID inválido'),
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres').optional(),
  url: z
    .string()
    .url('URL inválida')
    .refine((v) => v.startsWith('http'), 'URL deve começar com http:// ou https://')
    .optional(),
  eventos: z.array(z.enum(EVENTOS_VALIDOS)).min(1, 'Selecione ao menos um evento').optional(),
  ativo: z.boolean().optional(),
});

export async function criarWebhook(formData: FormData) {
  await assertAdmin();

  const eventosRaw = formData.getAll('eventos').map(String);

  const raw = {
    nome: String(formData.get('nome') ?? '').trim(),
    url: String(formData.get('url') ?? '').trim(),
    eventos: eventosRaw,
  };

  const parsed = CriarWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    voltarComErro(`${BASE_PATH}/novo`, parsed.error, {
      rotulos: ROTULOS_WEBHOOK,
      valores: valoresDoWebhook(formData),
    });
  }

  // Finding A-4: resolve o host e recusa destino em rede interna antes de
  // gravar. Sem isso o botão "Testar" vira um scanner da rede do Vercel.
  const ssrf = await validarUrlWebhook(parsed.data.url);
  if (!ssrf.ok) {
    voltarComErro(`${BASE_PATH}/novo`, ssrf.motivo, {
      valores: valoresDoWebhook(formData),
      campo: 'url',
    });
  }

  const secret = generateWebhookSecret();
  const supabase = await createClient();
  const { data: wh, error } = await supabase
    .from('webhooks_outbound')
    .insert({
      nome: parsed.data.nome,
      url: parsed.data.url,
      eventos: parsed.data.eventos,
      secret,
      ativo: true,
    })
    .select('id')
    .single();

  if (error || !wh) {
    voltarComErro(`${BASE_PATH}/novo`, 'Erro ao criar webhook. Tente novamente.', {
      valores: valoresDoWebhook(formData),
    });
  }

  // Finding A-3: o secret vai por cookie httpOnly de 60s, não pela query
  // string (que ficaria no histórico do browser e nos logs do Vercel).
  await guardarSecretFlash(secret);

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?created=${wh.id}`);
}

export async function atualizarWebhook(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  const eventosRaw = formData.getAll('eventos').map(String);
  const ativoRaw = formData.get('ativo');

  const raw = {
    id,
    nome: String(formData.get('nome') ?? '').trim() || undefined,
    url: String(formData.get('url') ?? '').trim() || undefined,
    eventos: eventosRaw.length > 0 ? eventosRaw : undefined,
    ativo:
      ativoRaw !== null ? ativoRaw === 'true' || ativoRaw === '1' || ativoRaw === 'on' : undefined,
  };

  const parsed = AtualizarWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    voltarComErro(`${BASE_PATH}/${id}/editar`, parsed.error, {
      rotulos: ROTULOS_WEBHOOK,
      valores: valoresDoWebhook(formData),
    });
  }

  if (parsed.data.url !== undefined) {
    const ssrf = await validarUrlWebhook(parsed.data.url);
    if (!ssrf.ok) {
      voltarComErro(`${BASE_PATH}/${parsed.data.id}/editar`, ssrf.motivo, {
        valores: valoresDoWebhook(formData),
        campo: 'url',
      });
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('webhooks_outbound')
    .update({
      ...(parsed.data.nome !== undefined && { nome: parsed.data.nome }),
      ...(parsed.data.url !== undefined && { url: parsed.data.url }),
      ...(parsed.data.eventos !== undefined && { eventos: parsed.data.eventos }),
      ...(parsed.data.ativo !== undefined && { ativo: parsed.data.ativo }),
    })
    .eq('id', parsed.data.id)
    .is('deleted_at', null);

  if (error) {
    voltarComErro(`${BASE_PATH}/${parsed.data.id}/editar`, 'Erro ao atualizar webhook.', {
      valores: valoresDoWebhook(formData),
    });
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Webhook atualizado')}`);
}

export async function arquivarWebhook(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);
  }

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from('webhooks_outbound')
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );

  if (erro) redirect(`${BASE_PATH}?error=${encodeURIComponent(erro)}`);

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Webhook arquivado')}`);
}

export async function testarWebhook(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);
  }

  const result = await testWebhook(id);
  const status = result.ok ? 'OK' : 'ERR';

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?tested=${id}&status=${status}&latency=${result.latency_ms}`);
}

export async function regenerarSecret(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('ID inválido')}`);
  }

  const newSecret = generateWebhookSecret();
  const supabase = await createClient();
  // Sem a checagem de linhas, "Secret regenerado" aparecia e o secret antigo
  // continuava valendo — o pior dos falsos sucessos desta tela.
  const erro = erroDeEscrita(
    await supabase
      .from('webhooks_outbound')
      .update({ secret: newSecret })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id'),
  );

  if (erro) redirect(`${BASE_PATH}/${id}/editar?error=${encodeURIComponent(erro)}`);

  await guardarSecretFlash(newSecret);

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?regenerated=${id}`);
}
