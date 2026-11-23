/**
 * Port da fila automática de mensagens de WhatsApp (Etapa 26) — só o
 * necessário para uma tela de OPERAÇÃO ler o estado da fila e disparar
 * o processamento manual. Toda a regra de agendamento, bloqueio e envio
 * já acontece no servidor (`server/whatsapp-automatico.mjs`, Etapa 25);
 * aqui é só o contrato de leitura/ação, nunca lógica de negócio.
 */
export type TipoMensagemWhatsappAutomatica = 'CONFIRMACAO' | 'LEMBRETE_24H' | 'LEMBRETE_1H' | 'BOAS_VINDAS' | 'AVISO_FALTA' | 'AVISO_RECUSA' | 'REAGENDAMENTO' | 'ANIVERSARIO';

export type StatusMensagemWhatsappAutomatica =
  | 'PENDENTE'
  | 'AGUARDANDO_PROVEDOR'
  | 'ENVIADA'
  | 'FALHA'
  | 'BLOQUEADA';

export interface MensagemWhatsappAutomatica {
  id: string;
  pacienteId: string;
  /** `null` quando o paciente não foi encontrado (ex.: removido depois de a mensagem ser criada). */
  pacienteNome: string | null;
  tipo: TipoMensagemWhatsappAutomatica;
  status: StatusMensagemWhatsappAutomatica;
  /** Só os últimos dígitos — o servidor nunca devolve o número completo nem o texto da mensagem. */
  numeroMascarado: string;
  agendadaPara: string;
  /** Código curto do último erro/bloqueio (ex.: `sem-provedor`, `sem-consentimento`); `null` quando não há. */
  ultimoErro: string | null;
  /**
   * Quando `status` é `FALHA` por uma falha classificada como
   * transitória, a hora (ISO) em que a próxima tentativa automática
   * acontece (backoff) — `null` quando não se aplica (não é `FALHA`,
   * ou é um bloqueio permanente/`BLOQUEADA`).
   */
  proximaTentativaEm?: string | null;
  /** Status técnico vindo do webhook da Meta (`sent`, `delivered`, `read`, `failed`); não substitui o status operacional da fila. */
  statusEntregaProvedor?: string | null;
  statusEntregaAtualizadoEm?: string | null;
  codigoErroEntregaProvedor?: string | null;
}

/**
 * Só diz QUAIS categorias têm um nome de template configurado por
 * variável de ambiente — nunca o nome em si, nunca se está de fato
 * aprovado na Meta (isso só a Graph API sabe, com credencial).
 */
export interface DiagnosticoTemplatesMeta {
  confirmacao: boolean;
  lembrete24h: boolean;
  lembrete1h: boolean;
  confirmacaoEmergencia: boolean;
  lembrete24hEmergencia: boolean;
  lembrete1hEmergencia: boolean;
}

export interface StatusFilaWhatsappAutomatica {
  provedorConfigurado: boolean;
  /** Nome do adaptador configurado (ex.: `webhook-generico`); `null` quando não configurado. */
  nomeProvedor: string | null;
  /** Motivo curto de não estar configurado (`sem-provedor`, `url-invalida`, `url-insegura`); `null` quando configurado. */
  motivo: string | null;
  porStatus: Partial<Record<StatusMensagemWhatsappAutomatica, number>>;
  mensagens: MensagemWhatsappAutomatica[];
  webhookMetaConfigurado?: boolean;
  /** `null` quando o provedor ativo não é a Meta. */
  templatesMeta?: DiagnosticoTemplatesMeta | null;
}

export interface ResultadoProcessamentoWhatsappAutomatico {
  enviadas: number;
  aguardandoProvedor: number;
  bloqueadas: number;
  falhas: number;
}

export interface PortaWhatsappAutomatico {
  /** `GET /api/whatsapp-automatico/status`. Falha de rede é responsabilidade de quem chama tratar (nunca finge sucesso). */
  obterStatus(): Promise<StatusFilaWhatsappAutomatica>;
  /** `POST /api/whatsapp-automatico/processar` — dispara na hora a mesma rotina que o servidor roda a cada minuto. */
  processarAgora(): Promise<ResultadoProcessamentoWhatsappAutomatico>;
}
