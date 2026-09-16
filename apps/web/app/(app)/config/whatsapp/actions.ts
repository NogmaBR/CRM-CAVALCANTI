'use server';

import { enviarTexto, whatsappConfigurado } from '@/lib/services/uazapi';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Ações da tela de diagnóstico do WhatsApp. Só admin, e só uma escrita: um
 * envio de teste pelo provider — prova que a saída funciona (credencial,
 * instância conectada, número certo) antes de ninguém depender dela.
 */

const BASE_PATH = '/config/whatsapp';

async function assertAdmin(): Promise<void> {
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
}

export async function enviarMensagemDeTeste(formData: FormData) {
  await assertAdmin();

  const destino = String(formData.get('destino') ?? '')
    .trim()
    .replace(/\s+/gu, '');
  const texto = String(formData.get('texto') ?? '').trim() || 'Teste do CRM Cavalcanti ✔';

  // Telefone (10–15 dígitos, com DDI) ou id de grupo.
  const ehGrupo = /^\d{6,}@g\.us$/u.test(destino);
  const soDigitos = destino.replace(/\D/gu, '');
  if (!ehGrupo && !/^\d{10,15}$/u.test(soDigitos)) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('Destino inválido: use o telefone com DDI (ex.: 5551999999999) ou o id do grupo (…@g.us).')}`,
    );
  }
  if (!whatsappConfigurado()) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent('UAZAPI não configurado na Vercel (UAZAPI_BASE_URL / UAZAPI_TOKEN).')}`,
    );
  }

  const r = await enviarTexto(ehGrupo ? destino : soDigitos, texto.slice(0, 500));
  revalidatePath(BASE_PATH);
  if (!r.ok) {
    redirect(
      `${BASE_PATH}?error=${encodeURIComponent(`O provider recusou o envio (${r.motivo}). Veja a instância acima.`)}`,
    );
  }
  redirect(`${BASE_PATH}?success=${encodeURIComponent('Mensagem enviada. Confira no WhatsApp.')}`);
}
