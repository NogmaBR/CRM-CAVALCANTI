import { TopBar } from '@/components/layout/topbar';
import { Button } from '@/components/nogma/Button';
import { createClient } from '@/lib/supabase/server';
import {
  BellRing,
  Building2,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { AbaAlertas } from './abas/alertas';
import { AbaCaixa } from './abas/caixa';
import { AbaDocumentos } from './abas/documentos';
import { AbaFornecedores } from './abas/fornecedores';
import { AbaPorObra } from './abas/por-obra';
import { AbaVisaoGeral } from './abas/visao-geral';
import './empresario.css';
import './painel.css';

export const metadata = { title: 'Painel' };

/**
 * O painel do empresário: seis abas grandes, com nome por extenso. As abas
 * são links (`?aba=`), não estado de cliente — cada uma carrega só o que
 * mostra, e a URL diz onde a pessoa estava.
 */
const ABAS: Array<{ chave: string; rotulo: string; icone: LucideIcon; descricao: string }> = [
  {
    chave: 'visao-geral',
    rotulo: 'Visão geral',
    icone: LayoutDashboard,
    descricao: 'Os números do mês e o que precisa de atenção',
  },
  {
    chave: 'por-obra',
    rotulo: 'Por obra',
    icone: Building2,
    descricao: 'Quanto cada obra custou, mês a mês e por etapa',
  },
  {
    chave: 'fornecedores',
    rotulo: 'Fornecedores',
    icone: Users,
    descricao: 'Quem mais recebeu e o que falta no cadastro',
  },
  {
    chave: 'caixa',
    rotulo: 'Caixa',
    icone: Wallet,
    descricao: 'O que entrou dos clientes e o que saiu',
  },
  {
    chave: 'documentos',
    rotulo: 'Documentos',
    icone: FolderOpen,
    descricao: 'Pastas, fotos e notas que faltam',
  },
  {
    chave: 'alertas',
    rotulo: 'Alertas',
    icone: BellRing,
    descricao: 'O que precisa de ação, em frases',
  },
];

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const sp = await searchParams;
  const ativa = ABAS.find((a) => a.chave === sp.aba)?.chave ?? 'visao-geral';
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const email = userData.user?.email ?? 'voce';
  const primeiroNomeRaw = email.split('@')[0]?.split('.')[0] ?? 'voce';
  const primeiroNome = (primeiroNomeRaw[0] ?? '').toUpperCase() + primeiroNomeRaw.slice(1);

  // Data e saudação em hora de Brasília: o runtime da Vercel é UTC, e às
  // 22h o painel dizia "Bom dia" com a data de amanhã.
  const agora = new Date();
  const hoje = agora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });
  const hora = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(agora),
  );
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const abaAtiva = ABAS.find((a) => a.chave === ativa) ?? ABAS[0];

  return (
    <>
      <TopBar
        title="Painel"
        subtitle={abaAtiva?.descricao ?? ''}
        actions={
          <Link href="/obras/novo" style={{ textDecoration: 'none' }}>
            <Button variant="primary" leadingIcon={<Plus size={16} />}>
              Nova obra
            </Button>
          </Link>
        }
      />

      <div className="nos-page-body">
        <div className="painel-saudacao">
          <p className="eyebrow nos-eyebrow-date">{hoje}</p>
          <h2 className="nos-greeting">
            {saudacao}, {primeiroNome}
          </h2>
        </div>

        <nav className="painel-abas" aria-label="Seções do painel">
          {ABAS.map((a) => {
            const Icone = a.icone;
            const atual = a.chave === ativa;
            return (
              <Link
                key={a.chave}
                href={a.chave === 'visao-geral' ? '/painel' : `/painel?aba=${a.chave}`}
                className={`painel-abas__aba${atual ? ' painel-abas__aba--ativa' : ''}`}
                aria-current={atual ? 'page' : undefined}
              >
                <Icone size={20} aria-hidden="true" />
                <span>{a.rotulo}</span>
              </Link>
            );
          })}
        </nav>

        {ativa === 'visao-geral' ? <AbaVisaoGeral /> : null}
        {ativa === 'por-obra' ? <AbaPorObra /> : null}
        {ativa === 'fornecedores' ? <AbaFornecedores /> : null}
        {ativa === 'caixa' ? <AbaCaixa /> : null}
        {ativa === 'documentos' ? <AbaDocumentos /> : null}
        {ativa === 'alertas' ? <AbaAlertas /> : null}
      </div>
    </>
  );
}
