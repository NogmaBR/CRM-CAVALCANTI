import { Badge, type BadgeVariant } from '@/components/nogma/Badge';
import { type Completude, type Nivel, fraseDoNivel, rotuloCurto } from '@/lib/completude/regras';
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import './completude.css';

/**
 * O semáforo de completude na tela: badge para listas, painel para a tela
 * de detalhe, anel e barra para o painel do empresário. Sem hooks — serve a
 * server e client components; o `Completude` chega pronto de
 * `lib/data/completude.ts`.
 *
 * Cor nunca é o único sinal: o rótulo diz o que falta e o ícone muda.
 */

const VARIANTE: Record<Nivel, BadgeVariant> = {
  completo: 'success',
  parcial: 'warning',
  critico: 'danger',
};

export const NIVEL_ROTULO: Record<Nivel, string> = {
  completo: 'Completo',
  parcial: 'Falta pouco',
  critico: 'Falta muito',
};

/** Badge compacto: bolinha + o que falta. `title` lista tudo. */
export function Semaforo({
  completude,
  className,
}: { completude: Completude; className?: string }) {
  const titulo =
    completude.faltas.length === 0
      ? `Tudo completo (${completude.itensTotal} de ${completude.itensTotal})`
      : completude.faltas.map((f) => `• ${f.texto}`).join('\n');
  return (
    <Badge
      variant={VARIANTE[completude.nivel]}
      dot
      title={titulo}
      className={`semaforo semaforo--${completude.nivel}${className ? ` ${className}` : ''}`}
    >
      {rotuloCurto(completude)}
    </Badge>
  );
}

/** Anel SVG com "N de M" no meio. Puro, sem Recharts. */
export function AnelDeCompletude({
  completude,
  tamanho = 64,
}: {
  completude: Completude;
  tamanho?: number;
}) {
  const fracao = completude.itensTotal === 0 ? 1 : completude.itensOk / completude.itensTotal;
  const raio = (tamanho - 8) / 2;
  const circ = 2 * Math.PI * raio;
  return (
    <svg
      className={`anel anel--${completude.nivel}`}
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      role="img"
      aria-label={`${completude.itensOk} de ${completude.itensTotal} itens preenchidos`}
    >
      <circle className="anel__trilho" cx={tamanho / 2} cy={tamanho / 2} r={raio} />
      <circle
        className="anel__valor"
        cx={tamanho / 2}
        cy={tamanho / 2}
        r={raio}
        strokeDasharray={`${circ * fracao} ${circ}`}
        transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}
      />
      <text className="anel__texto" x="50%" y="50%" dy="0.35em" textAnchor="middle">
        {completude.itensOk}/{completude.itensTotal}
      </text>
    </svg>
  );
}

/**
 * O bloco da tela de detalhe: frase grande, anel, e a lista do que falta
 * com o botão para resolver cada item. Verde vira uma linha só.
 */
export function PainelDeCompletude({
  completude,
  titulo = 'Situação do cadastro',
}: {
  completude: Completude;
  titulo?: string;
}) {
  const Icone =
    completude.nivel === 'completo'
      ? CircleCheck
      : completude.nivel === 'parcial'
        ? CircleAlert
        : TriangleAlert;
  return (
    <section
      className={`painel-completude painel-completude--${completude.nivel}`}
      aria-labelledby="painel-completude-titulo"
    >
      <div className="painel-completude__cabeca">
        <AnelDeCompletude completude={completude} />
        <div className="painel-completude__texto">
          <span className="painel-completude__eyebrow" id="painel-completude-titulo">
            {titulo}
          </span>
          <p className="painel-completude__frase">
            <Icone size={20} aria-hidden="true" />
            {fraseDoNivel(completude)}
          </p>
          <span className="painel-completude__contagem">
            {completude.itensOk} de {completude.itensTotal} itens preenchidos
          </span>
        </div>
      </div>
      {completude.faltas.length > 0 ? (
        <ul className="painel-completude__lista">
          {completude.faltas.map((f) => (
            <li key={f.chave} className={`falta falta--${f.gravidade}`}>
              <span className="falta__marca" aria-hidden="true" />
              <span className="falta__texto">{f.texto}</span>
              {f.acao ? (
                <Link href={f.acao.href} className="falta__acao">
                  {f.acao.rotulo}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Aviso inline, para o lugar onde a coisa falta (ex.: seção Documentos do
 * pagamento sem documento). Vermelho ou amarelo conforme a gravidade.
 */
export function AvisoDeFalta({
  gravidade,
  children,
  acao,
}: {
  gravidade: 'critica' | 'importante' | 'leve';
  children: React.ReactNode;
  acao?: { rotulo: string; href: string };
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: aviso de status (padrão do projeto)
    <div className={`aviso-falta aviso-falta--${gravidade}`} role="status">
      {gravidade === 'critica' ? (
        <TriangleAlert size={18} aria-hidden="true" />
      ) : (
        <CircleAlert size={18} aria-hidden="true" />
      )}
      <span className="aviso-falta__texto">{children}</span>
      {acao ? (
        <Link href={acao.href} className="aviso-falta__acao">
          {acao.rotulo}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Barra empilhada verde/amarelo/vermelho com a contagem — a "saúde" de um
 * tipo de cadastro no painel. Cada trecho é um link para a lista filtrada.
 */
export function BarraDeSaude({
  rotulo,
  resumo,
  hrefBase,
}: {
  rotulo: string;
  resumo: { completo: number; parcial: number; critico: number; total: number };
  /** Ex.: `/pagamentos` — recebe `?situacao=` no fim. */
  hrefBase: string;
}) {
  const t = resumo.total || 1;
  const trechos: Array<{ nivel: Nivel; n: number; filtro: string }> = [
    { nivel: 'completo', n: resumo.completo, filtro: 'completo' },
    { nivel: 'parcial', n: resumo.parcial, filtro: 'pendente' },
    { nivel: 'critico', n: resumo.critico, filtro: 'critico' },
  ];
  const comPendencia = resumo.parcial + resumo.critico;
  return (
    <div className="barra-saude">
      <div className="barra-saude__topo">
        <span className="barra-saude__rotulo">{rotulo}</span>
        <span className="barra-saude__leitura">
          {resumo.total === 0
            ? 'nada cadastrado'
            : comPendencia === 0
              ? `${resumo.total} completos`
              : `${comPendencia} de ${resumo.total} com pendência`}
        </span>
      </div>
      <div
        className="barra-saude__trilho"
        role="img"
        aria-label={`${rotulo}: ${resumo.completo} completos, ${resumo.parcial} com falta leve, ${resumo.critico} com falta grave`}
      >
        {trechos
          .filter((tr) => tr.n > 0)
          .map((tr) => (
            <Link
              key={tr.nivel}
              href={`${hrefBase}?situacao=${tr.filtro}`}
              className={`barra-saude__trecho barra-saude__trecho--${tr.nivel}`}
              style={{ flexBasis: `${(tr.n / t) * 100}%` }}
              title={`${tr.n} ${NIVEL_ROTULO[tr.nivel].toLowerCase()}`}
            >
              <span>{tr.n}</span>
            </Link>
          ))}
      </div>
    </div>
  );
}
