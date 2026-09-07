'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getNotificacao } from '@/lib/data/notificacoes';
import { resendNotificacao } from '@/lib/services/send-email';

export async function reenviarNotificacao(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect(`/notificacoes?error=${encodeURIComponent('ID da notificação ausente.')}`);
  }

  const notif = await getNotificacao(id);
  if (!notif) {
    redirect(`/notificacoes?error=${encodeURIComponent('Notificação não encontrada.')}`);
  }

  const contexto = (notif.contexto as Record<string, unknown> | null) ?? null;

  const ok = await resendNotificacao(notif.destinatario, notif.assunto, notif.corpo, contexto);

  revalidatePath('/notificacoes');

  if (ok) {
    redirect(`/notificacoes?success=${encodeURIComponent('Reenvio disparado com sucesso.')}`);
  } else {
    redirect(`/notificacoes?error=${encodeURIComponent('Falha no reenvio. Verifique os logs.')}`);
  }
}
