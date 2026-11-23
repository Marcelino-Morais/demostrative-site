/**
 * `PortaWhatsappAutomatico` falsa para os testes dos casos de uso da
 * fila automática. Nunca importada pela apresentação.
 */
import type {
  MensagemWhatsappAutomatica,
  PortaWhatsappAutomatico,
  ResultadoProcessamentoWhatsappAutomatico,
  StatusFilaWhatsappAutomatica,
} from './porta-whatsapp-automatico.js';

export function mensagemWhatsappAutomaticaFake(
  sobrescreve: Partial<MensagemWhatsappAutomatica> = {},
): MensagemWhatsappAutomatica {
  return {
    id: 'msg-1',
    pacienteId: 'paciente-1',
    pacienteNome: 'Paciente Teste',
    tipo: 'CONFIRMACAO',
    status: 'PENDENTE',
    numeroMascarado: '••••••1234',
    agendadaPara: '2026-01-01T10:00:00.000Z',
    ultimoErro: null,
    ...sobrescreve,
  };
}

export class FakePortaWhatsappAutomatico implements PortaWhatsappAutomatico {
  status: StatusFilaWhatsappAutomatica = {
    provedorConfigurado: false,
    nomeProvedor: null,
    motivo: 'sem-provedor',
    porStatus: {},
    mensagens: [],
  };
  resultadoProcessamento: ResultadoProcessamentoWhatsappAutomatico = {
    enviadas: 0,
    aguardandoProvedor: 0,
    bloqueadas: 0,
    falhas: 0,
  };
  /** Quando `true`, os dois métodos rejeitam — simula servidor fora do ar. */
  offline = false;
  chamadasProcessar = 0;

  async obterStatus(): Promise<StatusFilaWhatsappAutomatica> {
    if (this.offline) throw new Error('Sem conexão com o servidor da clínica.');
    return this.status;
  }

  async processarAgora(): Promise<ResultadoProcessamentoWhatsappAutomatico> {
    if (this.offline) throw new Error('Sem conexão com o servidor da clínica.');
    this.chamadasProcessar += 1;
    return this.resultadoProcessamento;
  }
}
