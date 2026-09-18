import { PainelDeCompletude } from '@/components/completude/semaforo';
import { TopBar } from '@/components/layout/topbar';
import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { Button } from '@/components/nogma/Button';
import { avaliarObra, faltaDoCampo } from '@/lib/completude/regras';
import { getPastasDaObra, getRegistrosDaObra, getUltimasFotosDaObra } from '@/lib/data/acervo';
import { listLinksDaObra, urlDaPlanilha } from '@/lib/data/compartilhamentos';
import { contextoDaObra } from '@/lib/data/completude';
import { resumoDoCronograma } from '@/lib/data/cronograma';
import { type Obra, getObra } from '@/lib/data/obras';
import { listRecebimentosDaObra, resumoFinanceiroDaObra } from '@/lib/data/recebimentos';
import { ritmoDaObra } from '@/lib/financeiro/agregacoes';
import { hojeBR } from '@/lib/util/datas';
import { createClient } from '@/lib/supabase/server';
import { Archive, ArrowLeft, Pencil, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { archiveObra, restoreObra } from '../actions';
import { DiarioDaObra, PastasDaObra, UltimasFotos } from './acervo';
import { CompartilharPlanilha } from './compartilhar-planilha';
import { CronogramaFisico, OrcadoVsRealizado } from './cronograma';
import { GraficosDaObra } from './graficos';
import { RecebimentosDaObra, ResultadoDaObra } from './recebimentos';
import '../../_shared/detail-layout.css';
import { Row, Section } from '../../_shared/detail-primitives';
import { estadoDoFormulario } from '../../_shared/form-erros';
import './compartilhar.css';

export const metadata = { title: 'Obra' };

type Endereco = {
  cep?: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

const STATUS_VARIANT: Record<NonNullable<Obra['status']>, BadgeVariant> = {
  ativa: 'success',
  pausada: 'warning',
  concluida: 'neutral',
  arquivada: 'neutral',
};

const STATUS_LABEL: Record<NonNullable<Obra['status']>, string> = {
  ativa: 'Ativa',
  pausada: 'Pausada',
  concluida: 'Concluída',
  arquivada: 'Arquivada',
};

const TIPO_LABEL: Record<NonNullable<Obra['tipo']>, string> = {
  nova: 'Nova',
  reforma: 'Reforma',
};

function formatBRL(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEndereco(end: Endereco | null | undefined): string {
  if (!end) return '—';
  const parts = [
    end.rua && end.numero ? `${end.rua}, ${end.numero}` : (end.rua ?? end.numero),
    end.bairro,
    end.cidade && end.uf ? `${end.cidade}/${end.uf}` : (end.cidade ?? end.uf),
    end.cep,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export default async function ObraDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; campo?: string; v?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const obra = await getObra(id);
  if (!obra) notFound();

  const supabase = await createClient();
  const [
    { data: userData },
    links,
    pastas,
    registros,
    fotos,
    resumo,
    recebimentos,
    contexto,
    cronograma,
  ] = await Promise.all([
    supabase.auth.getUser(),
    listLinksDaObra(id),
    getPastasDaObra(id),
    getRegistrosDaObra(id),
    getUltimasFotosDaObra(id),
    resumoFinanceiroDaObra(id),
    listRecebimentosDaObra(id),
    contextoDaObra(id),
    resumoDoCronograma(id),
  ]);

  // O semáforo da obra: contrato, prazo, comprovantes, pastas, cadastro,
  // etapas acima do orçado.
  const completude = avaliarObra(obra, {
    ...contexto,
    etapasEstouradas: cronograma.orcado.totais.estouradas,
  });
  const ritmo = ritmoDaObra({
    hoje: hojeBR(),
    data_inicio: obra.data_inicio,
    data_prevista_fim: obra.data_prevista_fim,
    gasto: resumo.gasto,
    contrato: resumo.contrato,
  });
  const falta = (chave: string) => faltaDoCampo(completude, chave);

  let papel: string | null = null;
  if (userData.user) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('papel')
      .eq('user_id', userData.user.id)
      .single();
    papel = perfil?.papel ?? null;
  }
  const podeGerenciarLinks = papel === 'admin' || papel === 'gestor';
  const podeEscreverFinanceiro = papel === 'admin' || papel === 'gestor' || papel === 'financeiro';
  const estadoForm = estadoDoFormulario(sp);

  // A URL completa é montada no servidor: `NEXT_PUBLIC_APP_URL` é a fonte da
  // verdade e o client não deve inferir domínio a partir do `window`.
  const urls = Object.fromEntries(links.map((l) => [l.token, urlDaPlanilha(l.token)]));

  const totalGasto = resumo.gasto;
  // Barra: orçamento planejado; sem ele, o contrato serve de teto.
  const orcamento = obra.orcamento != null ? Number(obra.orcamento) : (resumo.contrato ?? null);
  const percentual = orcamento && orcamento > 0 ? Math.round((totalGasto / orcamento) * 100) : null;

  const status = obra.status ?? 'ativa';
  const isArquivada = status === 'arquivada' || obra.deleted_at != null;
  const endereco = (obra.endereco as Endereco | null) ?? null;
  const apelidos = Array.isArray(obra.apelidos) ? obra.apelidos : [];

  return (
    <>
      <TopBar
        title={obra.nome}
        subtitle={obra.cliente ?? 'Sem cliente definido'}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/obras" className="detail-layout__back">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar
            </Link>
            <Link href={`/obras/${obra.id}/editar`} style={{ textDecoration: 'none' }}>
              <Button variant="secondary" leadingIcon={<Pencil size={14} />}>
                Editar
              </Button>
            </Link>
            {isArquivada ? (
              <form action={restoreObra} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={obra.id} />
                <Button type="submit" variant="secondary" leadingIcon={<RotateCcw size={14} />}>
                  Restaurar
                </Button>
              </form>
            ) : (
              <form action={archiveObra} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={obra.id} />
                <Button type="submit" variant="secondary" leadingIcon={<Archive size={14} />}>
                  Arquivar
                </Button>
              </form>
            )}
          </div>
        }
      />

      <div className="nos-page-body">
        {sp.error ? (
          <div className="detail-layout__error" role="alert">
            {sp.error}
          </div>
        ) : null}

        {sp.success ? (
          <div
            className="detail-layout__success"
            // biome-ignore lint/a11y/useSemanticElements: banner de status (padrão do projeto)
            role="status"
          >
            {sp.success}
          </div>
        ) : null}

        <div className="detail-layout__header">
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
          {obra.tipo ? <span className="detail-layout__tipo">{TIPO_LABEL[obra.tipo]}</span> : null}
        </div>

        <PainelDeCompletude completude={completude} titulo="Situação da obra" />

        <div className="detail-layout__grid">
          <Section title="Identificação">
            <Row label="Nome" value={obra.nome} />
            <Row label="Cliente" value={obra.cliente ?? '—'} falta={falta('cliente')} />
            <Row
              label="Tipo"
              value={obra.tipo ? TIPO_LABEL[obra.tipo] : '—'}
              falta={falta('tipo')}
            />
            <Row label="Status" value={STATUS_LABEL[status]} />
          </Section>

          <Section title="Financeiro & prazos">
            <Row label="Orçamento" value={formatBRL(obra.orcamento)} falta={falta('orcamento')} />
            <Row
              label="Valor do contrato"
              value={formatBRL(obra.valor_contrato)}
              falta={falta('contrato')}
            />
            <Row
              label="Total gasto"
              value={formatBRL(totalGasto)}
              falta={falta('acima_do_contrato')}
            />
            {percentual != null ? (
              <div className="obra-orcamento">
                <div className="obra-orcamento__topo">
                  <span>{percentual}% do orçamento consumido</span>
                  <span>
                    {percentual > 100
                      ? `${formatBRL(totalGasto - (orcamento ?? 0))} acima`
                      : `${formatBRL((orcamento ?? 0) - totalGasto)} disponível`}
                  </span>
                </div>
                {/* Avisa em 80%, antes de estourar — que é quando ainda dá
                    pra fazer alguma coisa a respeito. */}
                <div
                  className="obra-orcamento__barra"
                  role="meter"
                  aria-valuenow={percentual}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Consumo do orçamento"
                >
                  <div
                    className={
                      percentual > 100
                        ? 'obra-orcamento__preenchida obra-orcamento__preenchida--estouro'
                        : percentual > 80
                          ? 'obra-orcamento__preenchida obra-orcamento__preenchida--alerta'
                          : 'obra-orcamento__preenchida'
                    }
                    style={{ width: `${Math.min(100, percentual)}%` }}
                  />
                </div>
              </div>
            ) : null}
            <Row
              label="Data início"
              value={formatDate(obra.data_inicio)}
              falta={falta('data_inicio')}
            />
            <Row
              label="Data prevista fim"
              value={formatDate(obra.data_prevista_fim)}
              falta={falta('data_prevista_fim') ?? falta('prazo_vencido')}
            />
          </Section>

          <Section title="Resultado da obra" span={2}>
            <ResultadoDaObra resumo={resumo} />
          </Section>

          <section className="detail-layout__section detail-layout__section--wide">
            <h3 className="detail-layout__legend">Cronograma físico — em que pé está a obra</h3>
            <CronogramaFisico
              obraId={obra.id}
              resumo={cronograma}
              financeiroPct={resumo.percentualGastoDoContrato}
              prazoPct={ritmo.prazoPct}
              estado={estadoForm}
              podeEscrever={podeEscreverFinanceiro && !isArquivada}
            />
          </section>

          <section className="detail-layout__section detail-layout__section--wide">
            <h3 className="detail-layout__legend">Orçado × realizado por etapa</h3>
            <OrcadoVsRealizado
              obraId={obra.id}
              resumo={cronograma}
              orcamentoDaObra={obra.orcamento == null ? null : Number(obra.orcamento)}
              estado={estadoForm}
              podeEscrever={podeEscreverFinanceiro && !isArquivada}
            />
          </section>

          <section className="detail-layout__section detail-layout__section--wide">
            <h3 className="detail-layout__legend">Como está a obra, em gráficos</h3>
            <GraficosDaObra obra={obra} resumo={resumo} />
          </section>

          <Section title="Recebimentos do cliente" span={2}>
            <RecebimentosDaObra
              obraId={obra.id}
              recebimentos={recebimentos}
              estado={estadoForm}
              podeEscrever={podeEscreverFinanceiro && !isArquivada}
            />
          </Section>

          {fotos.length > 0 ? (
            <Section title="Últimas fotos" span={2}>
              <UltimasFotos obraId={obra.id} fotos={fotos} />
            </Section>
          ) : null}

          <Section title="Pastas" span={2}>
            <PastasDaObra obraId={obra.id} pastas={pastas} />
          </Section>

          <Section title="Diário da obra" span={2}>
            <DiarioDaObra registros={registros} />
          </Section>

          <Section title="Endereço" span={2}>
            <Row
              label="Endereço completo"
              value={formatEndereco(endereco)}
              falta={falta('endereco')}
            />
          </Section>

          <Section title="Extras" span={2}>
            <Row label="Apelidos" value={apelidos.length > 0 ? apelidos.join(', ') : '—'} />
            <Row label="Observações" value={obra.observacoes ?? '—'} multiline />
          </Section>

          <Section title="Planilha para o cliente" span={2}>
            <CompartilharPlanilha
              obraId={obra.id}
              links={links}
              urls={urls}
              podeGerenciar={podeGerenciarLinks}
            />
          </Section>

          <Section title="Metadados" span={2}>
            <Row label="Criada em" value={formatDateTime(obra.created_at)} />
            <Row label="Última atualização" value={formatDateTime(obra.updated_at)} />
            {obra.deleted_at ? (
              <Row label="Arquivada em" value={formatDateTime(obra.deleted_at)} />
            ) : null}
          </Section>
        </div>
      </div>
    </>
  );
}
