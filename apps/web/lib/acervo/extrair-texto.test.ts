import { describe, expect, it, vi } from 'vitest';
import { type DepsExtracao, extrairTextoDe, extrairTextoPendentes } from './extrair-texto';

/**
 * A orquestração é o que dá para testar sem rede: qual leitor é chamado para
 * qual tipo, o que acontece quando o PDF é escaneado, e que a fila anda mesmo
 * quando um arquivo falha (senão um PDF corrompido travaria a extração de
 * todos os outros para sempre).
 */

const bytes = new Uint8Array([1, 2, 3]);

function deps(over: Partial<DepsExtracao> = {}): DepsExtracao {
  return {
    lerPdf: vi.fn(async () => 'texto do pdf com camada de texto de verdade'),
    lerComVisao: vi.fn(async () => 'texto pela visão'),
    baixar: vi.fn(async () => bytes),
    ...over,
  };
}

describe('extrairTextoDe', () => {
  it('PDF com texto usa o leitor de PDF e não gasta visão', async () => {
    const d = deps();
    expect(await extrairTextoDe(bytes, 'application/pdf', d)).toBe(
      'texto do pdf com camada de texto de verdade',
    );
    expect(d.lerComVisao).not.toHaveBeenCalled();
  });

  it('PDF escaneado (texto vazio) cai na visão', async () => {
    const d = deps({ lerPdf: vi.fn(async () => '   \n ') });
    expect(await extrairTextoDe(bytes, 'application/pdf', d)).toBe('texto pela visão');
    expect(d.lerComVisao).toHaveBeenCalledWith(bytes, 'application/pdf');
  });

  it('imagem vai direto para a visão', async () => {
    const d = deps();
    expect(await extrairTextoDe(bytes, 'image/jpeg', d)).toBe('texto pela visão');
    expect(d.lerPdf).not.toHaveBeenCalled();
  });

  it('sem visão configurada, imagem e PDF escaneado devolvem null (o mock não finge que leu)', async () => {
    const d = deps({ lerComVisao: null, lerPdf: vi.fn(async () => '') });
    expect(await extrairTextoDe(bytes, 'image/png', d)).toBeNull();
    expect(await extrairTextoDe(bytes, 'application/pdf', d)).toBeNull();
  });

  it('planilha e word não são lidos nesta rodada', async () => {
    const d = deps();
    expect(
      await extrairTextoDe(
        bytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        d,
      ),
    ).toBeNull();
    expect(d.lerPdf).not.toHaveBeenCalled();
    expect(d.lerComVisao).not.toHaveBeenCalled();
  });

  it('leitor de PDF que explode não derruba: tenta a visão', async () => {
    const d = deps({
      lerPdf: vi.fn(async () => {
        throw new Error('pdf corrompido');
      }),
    });
    expect(await extrairTextoDe(bytes, 'application/pdf', d)).toBe('texto pela visão');
  });
});

/** Cliente Supabase mínimo: só o que `extrairTextoPendentes` usa. */
function supabaseFake(pendentes: Array<Record<string, unknown>>) {
  const updates: Array<{ id: string; valores: Record<string, unknown> }> = [];
  const chain = {
    select: () => chain,
    is: () => chain,
    order: () => chain,
    limit: async () => ({ data: pendentes, error: null }),
    update: (valores: Record<string, unknown>) => ({
      eq: async (_col: string, id: string) => {
        updates.push({ id, valores });
        return { error: null };
      },
    }),
  };
  return { client: { from: () => chain } as never, updates };
}

describe('extrairTextoPendentes', () => {
  it('marca texto_extraido_em em todos, com texto quando houve', async () => {
    const { client, updates } = supabaseFake([
      { id: 'a', mime_type: 'application/pdf', storage_path: 'x/a.pdf', tamanho_bytes: 10 },
      { id: 'b', mime_type: 'image/jpeg', storage_path: 'x/b.jpg', tamanho_bytes: 10 },
      { id: 'c', mime_type: 'application/msword', storage_path: 'x/c.doc', tamanho_bytes: 10 },
    ]);
    const r = await extrairTextoPendentes(client, { deps: deps({ lerComVisao: null }) });
    expect(r).toEqual({ processados: 3, comTexto: 1, semTexto: 2, erros: 0 });
    expect(updates.map((u) => u.id)).toEqual(['a', 'b', 'c']);
    expect(updates[0]?.valores.texto_extraido).toBe('texto do pdf com camada de texto de verdade');
    expect(updates[1]?.valores.texto_extraido).toBeNull();
    for (const u of updates) expect(u.valores.texto_extraido_em).toEqual(expect.any(String));
  });

  it('arquivo que não baixa conta como erro e é marcado para não travar a fila', async () => {
    const { client, updates } = supabaseFake([
      { id: 'a', mime_type: 'application/pdf', storage_path: 'x/a.pdf', tamanho_bytes: 10 },
    ]);
    const r = await extrairTextoPendentes(client, {
      deps: deps({ baixar: vi.fn(async () => null) }),
    });
    expect(r.erros).toBe(1);
    expect(updates[0]?.valores.texto_extraido_em).toEqual(expect.any(String));
  });

  it('arquivo acima do teto não é baixado', async () => {
    const d = deps();
    const { client } = supabaseFake([
      {
        id: 'a',
        mime_type: 'application/pdf',
        storage_path: 'x/a.pdf',
        tamanho_bytes: 9 * 1024 * 1024,
      },
    ]);
    const r = await extrairTextoPendentes(client, { deps: d });
    expect(d.baixar).not.toHaveBeenCalled();
    expect(r.semTexto).toBe(1);
  });
});
