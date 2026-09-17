import { Button } from '@/components/nogma/Button';
import { Input } from '@/components/nogma/Input';
import type { Recebimento } from '@/lib/data/recebimentos';
import type { ResumoFinanceiroDaObra } from '@/lib/financeiro/resumo-obra';
import { hojeBR } from '@/lib/util/datas';
import { Archive } from 'lucide-react';
import type { EstadoDoFormulario } from '../../_shared/form-erros';
import { arquivarRecebimento, criarRecebimento } from './recebimentos/actions';
import './recebimentos.css';

/**
 * O lado "entra" da obra: resultado (contrato · gasto · recebido · resultado)
 * e as parcelas recebidas. Server components; os formulários vão direto para
 * as server actions, com o padrão de erro do projeto (`voltarComErro`).
 */

function brl(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function ResultadoDaObra({ resumo }: { resumo: ResumoFinanceiroDaObra }) {
  const semContrato = resumo.contrato == null;
  const positivo = resumo.resultado >= 0;
  return (
    <div className="resultado-obra">
      <div className="resultado-obra__grid">
        <div className="resultado-obra__item">
          <span className="resultado-obra__rotulo">Contrato</span>
          <strong className="resultado-obra__valor">{brl(resumo.contrato)}</strong>
          <span className="resultado-obra__nota">
            {semContrato ? 'Ainda não informado' : 'O que o cliente paga pela obra'}
          </span>
        </div>
        <div className="resultado-obra__item">
          <span className="resultado-obra__rotulo">Gasto até agora</span>
          <strong className="resultado-obra__valor">{brl(resumo.gasto)}</strong>
          <span className="resultado-obra__nota">
            {resumo.percentualGastoDoContrato == null
              ? 'Pagamentos aprovados e pendentes'
              : `${resumo.percentualGastoDoContrato.toLocaleString('pt-BR')}% do contrato`}
          </span>
        </div>
        <div className="resultado-obra__item">
          <span className="resultado-obra__rotulo">Recebido do cliente</span>
          <strong className="resultado-obra__valor">{brl(resumo.recebido)}</strong>
          <span className="resultado-obra__nota">Parcelas registradas abaixo</span>
        </div>
        <div
          className={`resultado-obra__item resultado-obra__item--${positivo ? 'positivo' : 'negativo'}`}
        >
          <span className="resultado-obra__rotulo">Resultado</span>
          <strong className="resultado-obra__valor">{brl(resumo.resultado)}</strong>
          <span className="resultado-obra__nota">
            {positivo ? 'Recebido menos gasto: no azul' : 'Gasto maior que o recebido'}
          </span>
        </div>
      </div>
      <p className="resultado-obra__frase">
        {semContrato
          ? 'Informe o valor do contrato (em Editar, ou pelo WhatsApp: "o contrato desta obra é 850 mil") para ver a margem prevista.'
          : `Margem prevista: ${brl(resumo.margemPrevista)} — é o que sobra do contrato se nada mais for gasto.`}
      </p>
    </div>
  );
}

export function RecebimentosDaObra({
  obraId,
  recebimentos,
  estado,
  podeEscrever,
}: {
  obraId: string;
  recebimentos: Recebimento[];
  estado: EstadoDoFormulario;
  podeEscrever: boolean;
}) {
  const v = estado.valores ?? {};
  const erroDe = (campo: string) => (estado.campo === campo ? estado.error : undefined);
  return (
    <div className="recebimentos">
      {recebimentos.length === 0 ? (
        <p className="recebimentos__vazio">Nenhuma parcela registrada ainda.</p>
      ) : (
        <table className="recebimentos__tabela">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Descrição</th>
              <th scope="col" className="recebimentos__num">
                Valor
              </th>
              {podeEscrever ? <th scope="col" aria-label="Ações" /> : null}
            </tr>
          </thead>
          <tbody>
            {recebimentos.map((r) => (
              <tr key={r.id}>
                <td>{dataBR(r.data_recebimento)}</td>
                <td>
                  {r.descricao ?? '—'}
                  {r.origem === 'whatsapp' ? (
                    <span className="recebimentos__origem">via WhatsApp</span>
                  ) : null}
                </td>
                <td className="recebimentos__num">{brl(Number(r.valor))}</td>
                {podeEscrever ? (
                  <td className="recebimentos__acoes">
                    <form action={arquivarRecebimento}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="obra_id" value={obraId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Archive size={14} />}
                      >
                        Arquivar
                      </Button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {podeEscrever ? (
        <form action={criarRecebimento} className="recebimentos__form">
          <input type="hidden" name="obra_id" value={obraId} />
          <Input
            label="Valor recebido (R$)"
            name="valor"
            inputMode="decimal"
            placeholder="ex.: 25.000,00"
            defaultValue={v.valor ?? ''}
            error={erroDe('valor')}
            autoFocus={estado.campo === 'valor'}
            required
          />
          <Input
            label="Data"
            name="data_recebimento"
            type="date"
            defaultValue={v.data_recebimento ?? hojeBR()}
            error={erroDe('data_recebimento')}
            required
          />
          <Input
            label="Descrição"
            name="descricao"
            placeholder="ex.: 2ª parcela"
            defaultValue={v.descricao ?? ''}
            error={erroDe('descricao')}
          />
          <div className="recebimentos__form-acao">
            <Button type="submit">Registrar recebimento</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
