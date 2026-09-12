import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Busca rápida para a paleta ⌘K.
 *
 * Usa a sessão do usuário (cookies) — a RLS decide o que ele vê. Sem sessão,
 * o middleware já redirecionou para /login antes de chegar aqui. O termo é
 * limitado a 60 caracteres e os caracteres especiais do `ilike` (`%`, `_`)
 * são escapados para que "50%" procure o texto "50%" e não vire curinga.
 */

export const dynamic = 'force-dynamic';

const LIMITE = 5;

function escaparIlike(s: string): string {
  return s.replace(/[\\%_]/gu, (c) => `\\${c}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const termo = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (termo.length < 2) {
    return NextResponse.json({ obras: [], fornecedores: [], pagamentos: [] });
  }
  const padrao = `%${escaparIlike(termo)}%`;
  const supabase = await createClient();

  const [obrasR, fornR, pagR] = await Promise.all([
    supabase
      .from('obras')
      .select('id, nome, cliente')
      .is('deleted_at', null)
      .or(`nome.ilike.${padrao},cliente.ilike.${padrao}`)
      .order('nome')
      .limit(LIMITE),
    supabase
      .from('fornecedores')
      .select('id, nome, categorias(nome)')
      .is('deleted_at', null)
      .or(`nome.ilike.${padrao},razao_social.ilike.${padrao}`)
      .order('nome')
      .limit(LIMITE),
    supabase
      .from('pagamentos')
      .select('id, descricao, valor, data_pagamento, obras(nome)')
      .is('deleted_at', null)
      .or(`descricao.ilike.${padrao},observacoes.ilike.${padrao}`)
      .order('data_pagamento', { ascending: false })
      .limit(LIMITE),
  ]);

  type Cat = { nome: string } | { nome: string }[] | null;
  const nomeDe = (c: Cat): string | null =>
    c == null ? null : Array.isArray(c) ? (c[0]?.nome ?? null) : c.nome;

  return NextResponse.json(
    {
      obras: (obrasR.data ?? []).map((o) => ({ id: o.id, nome: o.nome, cliente: o.cliente })),
      fornecedores: (fornR.data ?? []).map((f) => ({
        id: f.id,
        nome: f.nome,
        categoria: nomeDe(f.categorias as Cat),
      })),
      pagamentos: (pagR.data ?? []).map((p) => ({
        id: p.id,
        descricao: p.descricao,
        valor: Number(p.valor),
        data: p.data_pagamento,
        obra: nomeDe(p.obras as Cat),
      })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
