// Base layout
export { EmailLayout } from './base-layout';
export type { EmailLayoutProps } from './base-layout';

// Pagamento aguardando aprovação
export {
  PagamentoAguardandoEmail,
  buildSubject as buildPagamentoSubject,
  buildText as buildPagamentoText,
} from './pagamento-aguardando';
export type { PagamentoAguardandoProps } from './pagamento-aguardando';

// Pendência nova (WhatsApp)
export {
  PendenciaNovaEmail,
  buildSubject as buildPendenciaSubject,
  buildText as buildPendenciaText,
} from './pendencia-nova';
export type { PendenciaNovaProps } from './pendencia-nova';

// Boas-vindas
export {
  BoasVindasEmail,
  buildSubject as buildBoasVindasSubject,
  buildText as buildBoasVindasText,
} from './boas-vindas';
export type { BoasVindasProps, PapelUsuario } from './boas-vindas';
