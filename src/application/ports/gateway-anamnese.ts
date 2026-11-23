import type { SalvarAnamneseInput } from '../../domain/entities/anamnese.js';
import type { LinkAnamneseProps, StatusEfetivoLinkAnamnese } from '../../domain/entities/link-anamnese.js';
import type { MotivoRecusaAnamnesePublica } from '../use-cases/link-anamnese.js';

/**
 * Port do slice de anamnese COMPARTILHADA (Etapa 18). É a única parte
 * do app que fala com o servidor (`server/`) — o domínio e as telas não
 * conhecem `fetch`. Os endpoints estão em `server/index.mjs` e no
 * `docs/backend.spec.md`.
 *
 * Duas famílias de operação:
 *  - **profissional** (autenticada por token de clínica): gerar/obter/
 *    revogar link e ler as respostas recebidas;
 *  - **pública** (sem auth, só o token do link na URL): abrir a página e
 *    enviar as respostas.
 */
export interface LinkAnamneseRemoto {
  props: LinkAnamneseProps;
  statusEfetivo: StatusEfetivoLinkAnamnese;
}

export interface AnamneseSubmetida {
  /** As respostas enviadas pelo paciente (mesma forma de `SalvarAnamneseInput`). */
  dados: SalvarAnamneseInput;
  atualizadoEm: string;
}

/**
 * Resultado da abertura da página pública pelo servidor — SÓ o
 * necessário para o paciente preencher: primeiro nome e se dá para
 * responder. Nunca traz id do paciente, nome completo, CPF nem
 * respostas anteriores. A página monta o formulário em branco.
 */
export type ResultadoAberturaRemota =
  | {
      ok: true;
      primeiroNomePaciente: string;
      podeResponder: boolean;
      statusEfetivo: StatusEfetivoLinkAnamnese;
    }
  | { ok: false; motivo: MotivoRecusaAnamnesePublica };

export interface GatewayAnamnese {
  /** `true` quando o servidor de sincronização responde. Usado para o app decidir modo remoto x local. */
  disponivel(): Promise<boolean>;

  // --- profissional ---
  gerarLink(pacienteId: string, primeiroNome: string): Promise<LinkAnamneseProps>;
  obterLinkDoPaciente(pacienteId: string): Promise<LinkAnamneseRemoto | null>;
  revogarLink(linkId: string): Promise<void>;
  obterAnamneseSubmetida(pacienteId: string): Promise<AnamneseSubmetida | null>;

  // --- pública ---
  abrirPublica(token: string): Promise<ResultadoAberturaRemota>;
  submeterPublica(token: string, valores: SalvarAnamneseInput): Promise<void>;
}
