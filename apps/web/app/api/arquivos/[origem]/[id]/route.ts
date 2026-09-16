/**
 * GET /api/arquivos/<origem>/<id>[?baixar=1|?miniatura=1]
 *
 * A porta única pela qual o CRM mostra um arquivo: a foto da nota na tela de
 * pendentes, o PDF na página do documento, o áudio do diário, a miniatura na
 * grade de fotos. Antes disto o único caminho era um redirect de 60 s para o
 * Supabase, fora do app.
 *
 * Como funciona, e por que assim:
 *  - A linha (documento, mensagem ou registro) é lida com a SESSÃO do usuário:
 *    a RLS decide quem vê. Linha invisível e linha inexistente respondem o
 *    mesmo 404 — não vazar existência.
 *  - A URL assinada é gerada pelo service role (o bucket é privado) e vale
 *    5 minutos; a resposta é 302 com `no-store`, então `<img>` e `<iframe>`
 *    apontam para esta rota e o navegador segue sozinho.
 *  - **Nunca faz streaming pelo nosso domínio**: `X-Frame-Options: DENY` vale
 *    para toda rota do app e mataria o `<iframe>` do PDF. Com o 302 o documento
 *    final é do Supabase.
 *  - `?miniatura=1` (só imagem): gera com `sharp` na primeira vez, guarda em
 *    `miniaturas/<origem>/<id>.jpg` e daí em diante só redireciona. Sem
 *    migration nem cron — o cache é o próprio bucket.
 *  - Não está na lista pública do middleware de propósito: sem sessão, o
 *    middleware manda para /login.
 */
import { gerarMiniatura } from '@/lib/arquivos/miniatura';
import { COLUNAS, caminhoDaMiniatura, ehOrigem, resolverArquivo } from '@/lib/arquivos/resolver';
import { logger } from '@/lib/log';
import {
  downloadDocumentBytes,
  existeObjeto,
  getSignedUrl,
  uploadDocumentBuffer,
} from '@/lib/storage/documents';
import { createClient } from '@/lib/supabase/server';
import { pareceUuid } from '@/lib/util/uuid';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const log = logger('api.arquivos');

/** Vale para o navegador seguir o redirect e renderizar; curto para não circular. */
const TTL_SEGUNDOS = 300;

const TABELA = {
  documento: 'documentos',
  mensagem: 'mensagens_whats',
  registro: 'registros_obra',
} as const;

function naoEncontrado() {
  return NextResponse.json({ erro: 'Arquivo não encontrado' }, { status: 404 });
}

function redirecionar(url: string) {
  return NextResponse.redirect(url, {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ origem: string; id: string }> },
) {
  const { origem, id } = await ctx.params;
  if (!ehOrigem(origem) || !pareceUuid(id)) return naoEncontrado();

  const supabase = await createClient();
  const { data: linha, error } = await supabase
    .from(TABELA[origem])
    .select(COLUNAS[origem])
    .eq('id', id)
    .maybeSingle();
  if (error) {
    log.erro('linha_nao_lida', { origem, id, erro: error.message });
    return naoEncontrado();
  }

  const arquivo = resolverArquivo(origem, linha);
  if (!arquivo) return naoEncontrado();

  const q = request.nextUrl.searchParams;
  try {
    if (q.get('baixar') === '1') {
      return redirecionar(
        await getSignedUrl(arquivo.path, TTL_SEGUNDOS, { download: arquivo.nome }),
      );
    }
    if (q.get('miniatura') === '1' && arquivo.mime.startsWith('image/')) {
      const alvo = caminhoDaMiniatura(origem, id);
      if (!(await existeObjeto(alvo))) {
        const bytes = await downloadDocumentBytes(arquivo.path);
        const mini = bytes ? await gerarMiniatura(bytes, arquivo.mime) : null;
        if (!mini) return redirecionar(await getSignedUrl(arquivo.path, TTL_SEGUNDOS));
        const buffer = mini.buffer.slice(
          mini.byteOffset,
          mini.byteOffset + mini.byteLength,
        ) as ArrayBuffer;
        try {
          await uploadDocumentBuffer(alvo, buffer, 'image/jpeg');
        } catch (err) {
          // Dois pedidos da mesma grade ao mesmo tempo: o segundo upload
          // perde (`upsert: false`) e o objeto do primeiro serve igual.
          if (!(await existeObjeto(alvo))) {
            log.aviso('miniatura_nao_guardada', { origem, id, err });
            return redirecionar(await getSignedUrl(arquivo.path, TTL_SEGUNDOS));
          }
        }
      }
      return redirecionar(await getSignedUrl(alvo, TTL_SEGUNDOS));
    }
    return redirecionar(await getSignedUrl(arquivo.path, TTL_SEGUNDOS));
  } catch (err) {
    log.erro('url_nao_gerada', { origem, id, err });
    return NextResponse.json({ erro: 'Arquivo indisponível no momento' }, { status: 503 });
  }
}
