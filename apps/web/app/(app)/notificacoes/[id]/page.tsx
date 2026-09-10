import { redirect } from 'next/navigation';

/**
 * Rota de notificações por email removida do escopo do projeto
 * (automação de email não faz parte do contratado — alinhamento 16/09).
 * Mantido como stub porque a exclusão física deste arquivo específico
 * não foi possível no ambiente local; qualquer acesso direto redireciona.
 */
export default function NotificacaoDetailPage() {
  redirect('/painel');
}
