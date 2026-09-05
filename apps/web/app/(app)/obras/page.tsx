import { TopBar } from '@/components/layout/topbar';
import { ComingSoon } from '@/components/layout/coming-soon';

export default function ObrasPage() {
  return (
    <>
      <TopBar title="Obras" subtitle="Cadastro, orçamento e acompanhamento" />
      <div className="nos-page-body">
        <ComingSoon
          title="Em construção"
          phase="Fase 4 · CRUD Base"
          lead="A gestão das obras da Cavalcanti — nome, endereço, orçamento inicial, responsável, categorias autorizadas e histórico de execução."
          items={[
            { label: 'CRUD de obras', hint: 'criar, editar, arquivar, restaurar' },
            { label: 'Orçamento vs. realizado', hint: 'gráfico por categoria' },
            { label: 'Autorizados por obra', hint: 'quem envia comprovantes no WhatsApp' },
            { label: 'Cronograma físico', hint: 'fases da construção com % concluído' },
          ]}
        />
      </div>
    </>
  );
}
