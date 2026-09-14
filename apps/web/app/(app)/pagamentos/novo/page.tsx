import { TopBar } from '@/components/layout/topbar';
import { listCategorias } from '@/lib/data/categorias';
import { listFornecedores } from '@/lib/data/fornecedores';
import { listObras } from '@/lib/data/obras';
import { estadoDoFormulario } from '../../_shared/form-erros';
import { createPagamento } from '../actions';
import { PagamentoForm } from '../pagamento-form';

export const metadata = { title: 'Novo Pagamento' };

/**
 * Pré-preenchimento vindo de /pendentes (o link "Lançar manualmente" de uma
 * confirmação do WhatsApp). Só vale quando não há `v` — o que a pessoa
 * digitou e o servidor recusou vence o que veio da pendência.
 */
const CAMPOS_PREENCHIVEIS = [
  'valor',
  'obra_id',
  'fornecedor_id',
  'data_pagamento',
  'descricao',
] as const;

function valoresDaPendencia(params: Record<string, string | undefined>): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const campo of CAMPOS_PREENCHIVEIS) {
    const v = params[campo];
    if (typeof v === 'string' && v.trim() !== '') valores[campo] = v;
  }
  // `msg` é o texto da mensagem original: vai para as observações, para o
  // gestor ver de onde o número saiu.
  if (typeof params.msg === 'string' && params.msg.trim() !== '') {
    valores.observacoes = `Mensagem do WhatsApp: ${params.msg.trim()}`;
  }
  return valores;
}

export default async function NovoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    campo?: string;
    v?: string;
    obra_id?: string;
    valor?: string;
    fornecedor_id?: string;
    data_pagamento?: string;
    descricao?: string;
    msg?: string;
  }>;
}) {
  const [params, obras, fornecedores, categorias] = await Promise.all([
    searchParams,
    listObras({ includeArchived: false }),
    listFornecedores({ includeArchived: false }),
    listCategorias(),
  ]);

  const estado = estadoDoFormulario(params);
  const valores = params.v ? estado.valores : valoresDaPendencia(params);

  return (
    <>
      <TopBar title="Novo Pagamento" subtitle="Registrar pagamento manual" />
      <div className="nos-page-body">
        <PagamentoForm
          mode="create"
          defaultObraId={params.obra_id}
          obras={obras}
          fornecedores={fornecedores}
          categorias={categorias}
          action={createPagamento}
          error={estado.error}
          campo={estado.campo}
          valores={valores}
        />
      </div>
    </>
  );
}
