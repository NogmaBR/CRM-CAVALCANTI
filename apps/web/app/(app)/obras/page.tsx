import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function ObrasPage() {
  return (
    <>
      <TopBar title="Obras" subtitle="Cadastro, orçamento e acompanhamento" />
      <div className="nos-page-body">
        <ComingSoon
          eyebrow="PRÓXIMA FASE · CRUD BASE"
          title="Obras"
          lead="A gestão das obras da Cavalcanti — nome, endereço, orçamento inicial, responsável, categorias autorizadas e histórico de execução — chega na Fase 4."
          items={[
            { label: 'CRUD de obras', hint: ' — criar, editar, arquivar, restaurar' },
            { label: 'Orçamento vs. realizado', hint: ' — gráfico por categoria' },
            { label: 'Autorizados por obra', hint: ' — quem pode enviar comprovantes no WhatsApp' },
            { label: 'Cronograma físico', hint: ' — fases da construção com % concluído' },
          ]}
        />
      </div>
    </>
  );
}
