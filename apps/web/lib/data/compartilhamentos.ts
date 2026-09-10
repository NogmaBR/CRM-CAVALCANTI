import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Links de planilha compartilhada de uma obra, do lado do gestor.
 *
 * A leitura do lado do cliente (página pública) mora em `lib/data/planilha.ts`
 * e usa service role, porque lá não existe sessão. Aqui é o contrário: tudo
 * passa pela sessão do usuário e pela RLS de `obra_compartilhamentos`.
 */

export interface LinkCompartilhado {
  id: string;
  token: string;
  descricao: string | null;
  created_at: string | null;
  revogado_em: string | null;
  expira_em: string | null;
  acessos: number;
  ultimo_acesso_em: string | null;
  /** Derivado: um link vencido continua na lista, mas não abre mais. */
  expirado: boolean;
}

export async function listLinksDaObra(obraId: string): Promise<LinkCompartilhado[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('obra_compartilhamentos')
    .select('id, token, descricao, created_at, revogado_em, expira_em, acessos, ultimo_acesso_em')
    .eq('obra_id', obraId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[compartilhamentos] falha ao listar:', error.message);
    return [];
  }

  const agora = Date.now();

  return (data ?? []).map((l) => ({
    ...l,
    expirado: l.expira_em != null && new Date(l.expira_em).getTime() < agora,
  }));
}

/**
 * Monta a URL completa que vai pro cliente.
 *
 * `NEXT_PUBLIC_APP_URL` é a fonte da verdade — montar a partir do header
 * `Host` deixaria o link apontando pro domínio de preview da Vercel quando
 * gerado ali, e o cliente receberia um link que morre no próximo deploy.
 */
export function urlDaPlanilha(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-cavalcanti.vercel.app').replace(
    /\/+$/u,
    '',
  );
  return `${base}/planilha/${token}`;
}
