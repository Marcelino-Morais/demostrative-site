import { dataCalendarioValida } from '../value-objects/data-cadastral.js';
import { agoraIso, ErroDominio, gerarId } from '../types.js';

/**
 * Bloqueio de um dia inteiro na Agenda (pedido do usuário: "coloque a
 * opção de bloquear dia/dias como feriado, finais de semana ou dias
 * avulso... e que esses dias não possam ser registrados pra
 * consulta"). Um registro por DIA (nunca um intervalo guardado como
 * uma linha só) — mais simples de listar, desbloquear individualmente
 * e checar ("este dia está bloqueado?" vira uma busca por data, sem
 * precisar varrer intervalos). Quem cria vários de uma vez (feriado
 * de vários dias, um recesso, todo fim de semana de um período) é o
 * caso de uso `BloquearDias`, que gera um `BloqueioAgenda` para cada
 * dia do intervalo pedido.
 */

export type TipoBloqueioAgenda = 'FERIADO' | 'FIM_DE_SEMANA' | 'AVULSO';

export const TIPO_BLOQUEIO_AGENDA_LABEL: Record<TipoBloqueioAgenda, string> = {
  FERIADO: 'Feriado',
  FIM_DE_SEMANA: 'Final de semana',
  AVULSO: 'Dia avulso',
};

export interface BloqueioAgendaProps {
  id: string;
  /** `YYYY-MM-DD`, mesmo formato do resto da Agenda. */
  data: string;
  tipo: TipoBloqueioAgenda;
  /**
   * OBSERVAÇÃO INTERNA — só a equipe vê (tela da Agenda). Nunca
   * publicado automaticamente em lugar nenhum (achado desta rodada:
   * registros antigos deste campo podem conter informação privada —
   * ver `motivoPublico` abaixo, que é o único campo que o aviso do
   * WhatsApp lê). Nunca `undefined` — opcional pro usuário, mas o campo
   * sempre existe (string vazia quando não informado).
   */
  motivo: string;
  /**
   * Texto que aparece no aviso de funcionamento do WhatsApp — campo
   * SEPARADO de `motivo` de propósito, pra nunca publicar automaticamente
   * um motivo antigo/privado. Vazio por padrão (inclusive em registros
   * restaurados de antes deste campo existir). Só é mostrado pra
   * bloqueios de PERÍODO (`FERIADO`/`FIM_DE_SEMANA`) — um `AVULSO`
   * nunca divulga motivo nenhum no WhatsApp, mesmo que este campo esteja
   * preenchido (ver `whatsapp-funcionamento.mjs`).
   */
  motivoPublico: string;
  /**
   * Identifica quais dias vieram do MESMO pedido de bloqueio (uma
   * chamada de `BloquearDias` gera um `grupoId` só, compartilhado por
   * todos os dias daquele pedido). É o que permite ao aviso do WhatsApp
   * juntar um período de verdade (ex.: "24/12 a 26/12") sem NUNCA
   * inferir um período só porque duas datas calham de ser consecutivas
   * (achado explícito desta rodada: dois dias AVULSO consecutivos
   * continuam dois avisos separados). Registros de antes deste campo
   * existir caem no próprio `id` como `grupoId` (cada um vira seu
   * próprio grupo de um dia só — nunca assume uma ligação que não foi
   * registrada).
   */
  grupoId: string;
  criadoEm: string;
}

export interface CriarBloqueioAgendaInput {
  data: string;
  tipo: TipoBloqueioAgenda;
  motivo?: string;
  motivoPublico?: string;
  /** Repassado por `BloquearDias` — o mesmo valor pra todo dia de um único pedido. Gera um novo quando ausente (bloqueio avulso isolado). */
  grupoId?: string;
}


export class BloqueioAgenda {
  private constructor(private props: BloqueioAgendaProps) {}

  static criar(input: CriarBloqueioAgendaInput): BloqueioAgenda {
    if (!dataCalendarioValida(input.data)) {
      throw new ErroDominio('Data inválida — use o formato AAAA-MM-DD.');
    }
    if (!TIPO_BLOQUEIO_AGENDA_LABEL[input.tipo]) {
      throw new ErroDominio('Tipo de bloqueio inválido.');
    }
    return new BloqueioAgenda({
      id: gerarId(),
      data: input.data,
      tipo: input.tipo,
      motivo: (input.motivo ?? '').trim().slice(0, 500),
      motivoPublico: (input.motivoPublico ?? '').trim().slice(0, 500),
      grupoId: input.grupoId ?? gerarId(),
      criadoEm: agoraIso(),
    });
  }

  static restaurar(props: BloqueioAgendaProps): BloqueioAgenda {
    // `motivo`/`motivoPublico`/`grupoId` normalizados do mesmo jeito que
    // `Consulta.restaurar` normaliza campos opcionais — nunca deixa
    // `undefined` vazar pra UI/backup. Um registro de antes de
    // `motivoPublico`/`grupoId` existirem nunca ganha um motivo público
    // nem uma ligação de grupo que não foi de fato registrada — cai no
    // próprio `id` como grupo de um dia só (ver doc de `grupoId` acima).
    return new BloqueioAgenda({
      ...props,
      motivo: props.motivo ?? '',
      motivoPublico: props.motivoPublico ?? '',
      grupoId: props.grupoId || props.id,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get data(): string {
    return this.props.data;
  }

  get tipo(): TipoBloqueioAgenda {
    return this.props.tipo;
  }

  get motivo(): string {
    return this.props.motivo;
  }

  get motivoPublico(): string {
    return this.props.motivoPublico;
  }

  get grupoId(): string {
    return this.props.grupoId;
  }

  toSnapshot(): Readonly<BloqueioAgendaProps> {
    return { ...this.props };
  }
}

// ---- datas em UTC, duplicado de propósito ----
// Mesmo raciocínio de `presentation/lib/datas-agenda.ts` (comentário de
// lá): cálculo de data sempre em UTC sobre a string `YYYY-MM-DD`, nunca
// com `new Date('YYYY-MM-DD')` lido por getters locais (fuso horário
// muda o dia). O domínio não importa nada de `presentation/`, então
// duplica aqui o mínimo necessário — mesma ideia de `horarioParaMinutos`
// em `consulta.ts`.

function partesUtc(dataIso: string): [number, number, number] {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  return [ano!, mes!, dia!];
}

function adicionarDiasUtc(dataIso: string, n: number): string {
  const [ano, mes, dia] = partesUtc(dataIso);
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}

/** `0` domingo … `6` sábado, em UTC. */
function diaDaSemanaUtc(dataIso: string): number {
  const [ano, mes, dia] = partesUtc(dataIso);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Limite alto o bastante pra qualquer uso real (um ano inteiro de recesso) e baixo o bastante pra nunca travar a tela por engano. */
export const MAXIMO_DIAS_POR_BLOQUEIO = 366;

/**
 * Quais dias `YYYY-MM-DD` (inclusive nas duas pontas) um pedido de
 * bloqueio efetivamente cobre. Pra `FERIADO`/`AVULSO`, é o intervalo
 * inteiro; pra `FIM_DE_SEMANA`, só os sábados e domingos dentro dele —
 * assim "bloquear final de semana" de um período longo (ex.: o ano
 * inteiro) não bloqueia os dias úteis do meio sem querer.
 */
export function diasDoBloqueio(dataInicio: string, dataFim: string, tipo: TipoBloqueioAgenda): string[] {
  if (!dataCalendarioValida(dataInicio) || !dataCalendarioValida(dataFim)) {
    throw new ErroDominio('Data inválida — use o formato AAAA-MM-DD.');
  }
  if (dataFim < dataInicio) {
    throw new ErroDominio('A data final não pode ser antes da data inicial.');
  }
  const dias: string[] = [];
  let atual = dataInicio;
  let seguranca = 0;
  while (atual <= dataFim) {
    if (seguranca > MAXIMO_DIAS_POR_BLOQUEIO) {
      throw new ErroDominio(`Intervalo grande demais — o máximo é ${MAXIMO_DIAS_POR_BLOQUEIO} dias de uma vez.`);
    }
    if (tipo !== 'FIM_DE_SEMANA' || diaDaSemanaUtc(atual) === 0 || diaDaSemanaUtc(atual) === 6) {
      dias.push(atual);
    }
    atual = adicionarDiasUtc(atual, 1);
    seguranca += 1;
  }
  return dias;
}

/**
 * Sábado e domingo do fim de semana mais próximo de `dataIso` — o
 * mesmo fim de semana se `dataIso` já cai num sábado/domingo, ou o
 * PRÓXIMO se cair num dia de semana. Existe pra corrigir uma pegadinha
 * real (achado do usuário): o diálogo "Bloquear dia(s)" abre com
 * `dataInicio === dataFim` igual ao dia que a Agenda está mostrando —
 * se a usuária deixar esse intervalo de UM dia só e escolher o tipo
 * `FIM_DE_SEMANA`, `diasDoBloqueio` (acima) filtra corretamente só
 * sábado/domingo, mas como o intervalo tem um dia só, só aquele UM dia
 * (sábado OU domingo, o que a Agenda estava mostrando) é bloqueado —
 * parecendo, de fora, que "só bloqueia domingo" (ou só sábado,
 * dependendo do dia). A tela usa esta função pra expandir o intervalo
 * pro fim de semana inteiro assim que a usuária escolhe esse tipo.
 */
export function fimDeSemanaMaisProximo(dataIso: string): { dataInicio: string; dataFim: string } {
  const dia = diaDaSemanaUtc(dataIso);
  if (dia === 6) return { dataInicio: dataIso, dataFim: adicionarDiasUtc(dataIso, 1) };
  if (dia === 0) return { dataInicio: adicionarDiasUtc(dataIso, -1), dataFim: dataIso };
  const sabado = adicionarDiasUtc(dataIso, 6 - dia);
  return { dataInicio: sabado, dataFim: adicionarDiasUtc(sabado, 1) };
}
