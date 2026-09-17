import { EmptyState } from '@/components/nogma/EmptyState';
import { dadosFornecedores } from '@/lib/data/painel-empresario';
import { porExtensoCurto } from '@/lib/financeiro/agregacoes';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { Cartao, Tabela, brl, pct } from '../cartao';
import { BarrasHorizontais } from '../charts/barras-horizontais';

function dataBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export async function AbaFornecedores() {
  const d = await dadosFornecedores();
  if (d.ranking.length === 0) {
    return (
      <EmptyState
        icon={<Users size={24} aria-hidden="true" />}
        title={`Nenhum pagamento em ${d.ano}`}
      >
        Quando houver pagamentos neste ano, o ranking aparece aqui.
      </EmptyState>
    );
  }
  const primeiro = d.ranking[0];

  return (
    <div className="painel-abas__grade">
      <Cartao
        titulo={`Quem mais recebeu em ${d.ano}`}
        largo
        leitura={
          primeiro ? (
            <>
              <strong>{primeiro.fornecedor}</strong> recebeu {brl(primeiro.total)} (
              {porExtensoCurto(primeiro.total)}), {pct(primeiro.pct)} de tudo que foi pago no ano.
              Os 3 maiores juntos ficaram com <strong>{pct(d.concentracaoTop3)}</strong>
              {d.concentracaoTop3 >= 70
                ? ' — o dinheiro está concentrado em poucos fornecedores.'
                : ' — o gasto está bem distribuído.'}
            </>
          ) : null
        }
        tabela={
          <Tabela
            cabecalho={[
              'Fornecedor',
              'Total pago',
              'Parte do total',
              'Pagamentos',
              'Último pagamento',
            ]}
            linhas={d.ranking.map((l) => [
              <Link key={l.fornecedor_id} href={`/fornecedores/${l.fornecedor_id}`}>
                {l.fornecedor}
              </Link>,
              brl(l.total),
              pct(l.pct),
              l.pagamentos,
              dataBR(l.ultimo),
            ])}
            rodape={['Tudo que foi pago no ano', brl(d.total), '100%', '', '']}
          />
        }
      >
        <BarrasHorizontais
          data={d.ranking.map((l) => ({
            nome: l.fornecedor,
            valor: l.total,
            detalhe: `${l.pagamentos} pagamento(s) · ${pct(l.pct)} do total`,
          }))}
        />
      </Cartao>

      <Cartao
        titulo="Cadastro incompleto"
        largo
        leitura={
          d.incompletos.length === 0 ? (
            'Todos os fornecedores têm CNPJ/CPF e telefone. Nada a completar.'
          ) : (
            <>
              <strong>{d.incompletos.length}</strong>{' '}
              {d.incompletos.length === 1 ? 'fornecedor está' : 'fornecedores estão'} sem telefone
              ou sem documento. Sem telefone, a cobrança automática de nota não funciona.
            </>
          )
        }
        acao={
          <Link href="/fornecedores" className="cartao__link">
            Abrir fornecedores
          </Link>
        }
      >
        {d.incompletos.length === 0 ? null : (
          <Tabela
            cabecalho={['Fornecedor', 'Falta']}
            linhas={d.incompletos.slice(0, 20).map((f) => [
              <Link key={f.id} href={`/fornecedores/${f.id}`}>
                {f.nome}
              </Link>,
              [f.semTelefone ? 'telefone' : null, f.semDocumento ? 'CNPJ/CPF' : null]
                .filter(Boolean)
                .join(' e '),
            ])}
          />
        )}
      </Cartao>
    </div>
  );
}
