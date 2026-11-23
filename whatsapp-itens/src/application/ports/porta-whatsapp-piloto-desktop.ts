/**
 * Port do piloto de WhatsApp Desktop, Etapa A — dry-run (Etapa 62). Só o
 * necessário para a tela de operação mostrar o estado do piloto e
 * disparar o autoteste no próprio número do operador. Nenhuma mensagem é
 * enviada nesta etapa: o worker sempre para antes de apertar Enter.
 */
export interface EtapasVerificacaoPilotoDesktop {
  desktopDesbloqueado: boolean;
  whatsappLogado: boolean;
  cabecalho: boolean;
  telefone: boolean;
  editor: boolean;
}

export interface ResultadoTestePilotoDesktop {
  ok: boolean;
  /** Código curto e seguro (nunca telefone, nome ou texto de mensagem). */
  codigo: string;
  etapas: EtapasVerificacaoPilotoDesktop | null;
  em: string;
}

export interface StatusPilotoDesktop {
  habilitado: boolean;
  /** Motivo curto de não estar habilitado (`piloto-desabilitado`, `allowlist-vazia`, etc.); `null` quando habilitado. */
  motivo: string | null;
  modo: string | null;
  ultimoResultadoTeste: ResultadoTestePilotoDesktop | null;
}

/**
 * Status possíveis de uma tentativa da Etapa B (ver
 * server/whatsapp-piloto-desktop-store.mjs para a máquina de estados
 * completa). `INCERTO` é o resultado normal de um envio bem-sucedido —
 * a verificação por UI Automation do balão de mensagem já foi
 * investigada e achada pouco confiável, então o sistema nunca afirma
 * "confirmado" sozinho.
 */
export type StatusTentativaSupervisionada =
  | 'PRONTA'
  | 'EM_ANDAMENTO'
  | 'ENTER_PRESSIONADO'
  | 'INCERTO'
  | 'CANCELADA'
  | 'FALHA_RECUPERAVEL'
  | 'CONFIRMADO_MANUALMENTE'
  | 'NAO_CONFIRMADO';

export interface TentativaSupervisionada {
  idTentativa: string;
  status: StatusTentativaSupervisionada;
  fase: string;
  enterPressionado: boolean;
  criadoEm: string;
  atualizadoEm: string;
  ultimoErro: string | null;
}

export interface EstadoSupervisionado {
  habilitado: boolean;
  motivo: string | null;
  /** Só os 4 últimos dígitos (ex.: "••••••4310") — nunca o número completo. */
  numeroMascarado: string | null;
  tentativaAtual: TentativaSupervisionada | null;
  killSwitchAtivo: boolean;
}

export interface RespostaAcaoPiloto {
  ok: boolean;
  codigo: string;
  idTentativa?: string;
}

export interface PortaWhatsappPilotoDesktop {
  /** `GET /api/whatsapp-piloto-desktop/status`. */
  obterStatus(): Promise<StatusPilotoDesktop>;
  /** `POST /api/whatsapp-piloto-desktop/testar` — dry-run no próprio número do operador; nunca envia nada. */
  testarComMeuNumero(): Promise<ResultadoTestePilotoDesktop>;

  // ---- Etapa B — autoteste supervisionado (um envio real, só para o
  // dono, sob confirmação explícita) ----

  /** `GET /api/whatsapp-piloto-desktop/supervisionado/status`. */
  obterEstadoSupervisionado(): Promise<EstadoSupervisionado>;
  /**
   * `POST /api/whatsapp-piloto-desktop/supervisionado/iniciar` —
   * `confirmado` precisa ser `true` (a caixinha marcada na UI); o texto
   * é sempre montado no servidor, nunca aceito daqui. Responde rápido
   * (202) mesmo com o worker ainda rodando em segundo plano.
   */
  iniciarTesteSupervisionado(confirmado: boolean): Promise<RespostaAcaoPiloto>;
  /** `POST /api/whatsapp-piloto-desktop/supervisionado/cancelar` — só funciona antes do Enter ser apertado. */
  cancelarTesteSupervisionado(): Promise<RespostaAcaoPiloto>;
  /**
   * `POST /api/whatsapp-piloto-desktop/supervisionado/confirmar` — ação
   * humana de auditoria; nunca reenvia nada nem consulta confirmação
   * oficial de entrega/leitura do WhatsApp.
   */
  confirmarResultadoSupervisionado(resultado: 'confirmado' | 'nao-confirmado'): Promise<RespostaAcaoPiloto>;
  /** `POST /api/whatsapp-piloto-desktop/kill-switch/ativar` — nunca para o servidor da clínica em si. */
  ativarKillSwitch(): Promise<RespostaAcaoPiloto>;
  /** `POST /api/whatsapp-piloto-desktop/kill-switch/desarmar`. */
  desarmarKillSwitch(): Promise<RespostaAcaoPiloto>;
}
