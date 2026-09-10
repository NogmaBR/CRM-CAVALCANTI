import { TopBar } from '@/components/layout/topbar';
import { createClient } from '@/lib/supabase/server';
import {
  MessageCircle,
  ScrollText,
  ShieldCheck,
  Tag,
  Upload,
  User,
  Users,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import './config.css';

/**
 * Hub de configurações.
 *
 * Antes esta rota era um placeholder "Em construção" — enquanto categorias,
 * usuários, webhooks e importação já existiam e funcionavam. Como a sidebar
 * aponta pra cá e não pras sub-rotas, essas telas estavam efetivamente
 * inacessíveis pela interface: só chegava nelas quem digitasse a URL.
 */

interface Atalho {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Restrito a admin — escondido dos demais papéis. */
  admin?: boolean;
}

const OPERACAO: Atalho[] = [
  {
    href: '/config/autorizados',
    label: 'Números autorizados',
    hint: 'Quem pode lançar pagamentos pelo WhatsApp. Números fora desta lista são ignorados.',
    icon: ShieldCheck,
    admin: true,
  },
  {
    href: '/config/usuarios',
    label: 'Usuários e papéis',
    hint: 'Convites e permissões: admin, gestor, financeiro e leitura.',
    icon: Users,
    admin: true,
  },
  {
    href: '/config/categorias',
    label: 'Categorias',
    hint: 'Contas contábeis usadas para classificar os pagamentos.',
    icon: Tag,
    admin: true,
  },
];

const INTEGRACOES: Atalho[] = [
  {
    href: '/whatsapp',
    label: 'Mensagens do WhatsApp',
    hint: 'Histórico do que chegou, com status de processamento de cada mensagem.',
    icon: MessageCircle,
  },
  {
    href: '/config/webhooks',
    label: 'Webhooks',
    hint: 'Notificações de eventos para sistemas externos, assinadas com HMAC.',
    icon: Webhook,
    admin: true,
  },
  {
    href: '/config/importar',
    label: 'Importar pagamentos',
    hint: 'Carga em massa a partir de planilha CSV.',
    icon: Upload,
    admin: true,
  },
];

const CONTA: Atalho[] = [
  {
    href: '/config/perfil',
    label: 'Meu perfil',
    hint: 'Seus dados, tema e preferências de notificação.',
    icon: User,
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    hint: 'Registro de quem alterou o quê e quando.',
    icon: ScrollText,
    admin: true,
  },
];

function Grupo({ titulo, atalhos }: { titulo: string; atalhos: Atalho[] }) {
  if (atalhos.length === 0) return null;
  return (
    <>
      <h2 className="config-hub__section-title">{titulo}</h2>
      <div className="config-hub">
        {atalhos.map(({ href, label, hint, icon: Icon }) => (
          <Link key={href} href={href} className="config-hub__card">
            <span className="config-hub__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span>
              <span className="config-hub__title">{label}</span>
              <p className="config-hub__hint">{hint}</p>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default async function ConfigPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  let ehAdmin = false;
  if (userData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('papel')
      .eq('user_id', userData.user.id)
      .single();
    ehAdmin = profile?.papel === 'admin';
  }

  // Esconder o que o papel não pode abrir evita mandar o usuário pra um 404.
  const visiveis = (lista: Atalho[]) => lista.filter((a) => !a.admin || ehAdmin);

  return (
    <>
      <TopBar title="Configurações" subtitle="Equipe, integrações e preferências" />
      <div className="nos-page-body">
        <Grupo titulo="Operação" atalhos={visiveis(OPERACAO)} />
        <Grupo titulo="Integrações e dados" atalhos={visiveis(INTEGRACOES)} />
        <Grupo titulo="Conta" atalhos={visiveis(CONTA)} />
      </div>
    </>
  );
}
