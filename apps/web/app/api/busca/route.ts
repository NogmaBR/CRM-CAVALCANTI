import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Busca rápida para a paleta ⌘K.
 *
 * Usa a sessão do usuário (cookies) — a RLS decide o que ele vê. Sem sessão,
 * o middleware já redirecionou para /login antes de chegar aqui.
 *
 * Uma viagem só: a RPC `busca_global` (SECURITY INVOKER, migration
 * 20260914100000) consulta obras, fornecedores e pagamentos de uma vez. Antes
 * eram três consultas em paralelo e, com a função em iad1 e o banco em
 * sa-east-1, a paleta ficava mais de um segundo em "Buscando…" (design review
 * gstack, M12). O escape dos curingas do ILIKE mora na função.
 */

export const dynamic = 'force-dynamic';

const LIMITE = 5;
const VAZIO = { obras: [], fornecedores: [], pagamentos: [], documentos: [] };

interface Resultado {
  obras: Array<{ id: string; nome: string; cliente: string | null }>;
  fornecedores: Array<{ id: string; nome: string; categoria: string | null }>;
  pagamentos: Array<{
    id: string;
    descricao: string | null;
    valor: number;
    data: string;
    obra: string | null;
  }>;
  documentos: Array<{ id: string; nome: string; categoria: string; obra: string | null }>;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const termo = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (termo.length < 2) return NextResponse.json(VAZIO);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('busca_global', { p_termo: termo, p_limite: LIMITE });
  if (error || !data || typeof data !== 'object') {
    return NextResponse.json(VAZIO, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  const r = data as unknown as Partial<Resultado>;
  return NextResponse.json(
    {
      obras: r.obras ?? [],
      fornecedores: r.fornecedores ?? [],
      pagamentos: (r.pagamentos ?? []).map((p) => ({ ...p, valor: Number(p.valor) })),
      documentos: r.documentos ?? [],
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
