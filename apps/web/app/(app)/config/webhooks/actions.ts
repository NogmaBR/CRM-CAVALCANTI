'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { testWebhook, generateWebhookSecret } from '@/lib/services/dispatch-webhook';

const BASE_PATH = '/config/webhooks';

const EVENTOS_VALIDOS = [
  'pagamento_created',
  'pagamento_updated',
  'confirmacao_pendente_created',
  'documento_created',
  'obra_created',
  'obra_archived',
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
  eventos: z
    .array(z.enum(EVENTOS_VALIDOS))
    .min(1, 'Selecione ao menos um evento'),
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
    const first = parsed.error.issues[0];
    redirect(`${BASE_PATH}/novo?error=${encodeURIComponent(first?.message ?? 'Dados inválidos')}`);
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
    redirect(`${BASE_PATH}/novo?error=${encodeURIComponent('Erro ao criar webhook. Tente novamente.')}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?created=${wh.id}&secret=${encodeURIComponent(secret)}`);
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
    ativo: ativoRaw !== null ? ativoRaw === 'true' || ativoRaw === '1' || ativoRaw === 'on' : undefined,
  };

  const parsed = AtualizarWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    redirect(`${BASE_PATH}/${id}/editar?error=${encodeURIComponent(first?.message ?? 'Dados inválidos')}`);
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
    redirect(`${BASE_PATH}/${parsed.data.id}/editar?error=${encodeURIComponent('Erro ao atualizar webhook.')}`);
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
  const { error } = await supabase
    .from('webhooks_outbound')
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent('Erro ao arquivar webhook.')}`);
  }

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
  const { error } = await supabase
    .from('webhooks_outbound')
    .update({ secret: newSecret })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    redirect(`${BASE_PATH}/${id}/editar?error=${encodeURIComponent('Erro ao regenerar secret.')}`);
  }

  revalidatePath(BASE_PATH);
  redirect(`${BASE_PATH}?secret=${encodeURIComponent(newSecret)}`);
}
