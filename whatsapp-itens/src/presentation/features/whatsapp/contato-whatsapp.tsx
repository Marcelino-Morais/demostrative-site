import { useCallback, useEffect, useState } from 'react';
import { Lock, MessageCircle } from 'lucide-react';
import type { RegistroWhatsappProps } from '../../../domain/entities/registro-whatsapp.js';
import { TIPO_ACAO_WHATSAPP_LABEL } from '../../../domain/entities/registro-whatsapp.js';
import type { Paciente } from '../../../../../src/domain/entities/paciente.js';
import {
  CONSENTIMENTO_WHATSAPP_TEXTO,
  STATUS_CONSENTIMENTO_WHATSAPP_LABEL,
  type StatusConsentimentoWhatsapp,
} from '../../../domain/value-objects/consentimento-whatsapp.js';
import {
  avaliarDisponibilidadeWhatsapp,
  MENSAGEM_INDISPONIBILIDADE_WHATSAPP,
} from '../../../domain/value-objects/whatsapp.js';
import { Badge } from '../../../../../src/presentation/components/ui/badge.js';
import { Button } from '../../../../../src/presentation/components/ui/button.js';
import { Card } from '../../../../../src/presentation/components/ui/card.js';
import { Field } from '../../../../../src/presentation/components/ui/field.js';
import { Input, Select } from '../../../../../src/presentation/components/ui/input.js';
import { formatarDataHoraIso, formatarDataIso } from '../../../../../src/presentation/lib/formatadores.js';
import { useContainer } from '../../../../../src/presentation/providers/container-provider.js';
import { useSincronizacao } from '../../../../../src/presentation/providers/sincronizacao-provider.js';
import { BotaoWhatsapp } from './botao-whatsapp.js';

const TOM_STATUS: Record<StatusConsentimentoWhatsapp, 'success' | 'danger' | 'neutral'> = {
  AUTORIZADO: 'success',
  NAO_AUTORIZADO: 'danger',
  NAO_INFORMADO: 'neutral',
};

const STATUS_OPCOES: StatusConsentimentoWhatsapp[] = ['AUTORIZADO', 'NAO_AUTORIZADO', 'NAO_INFORMADO'];

/**
 * Área de contato/consentimento de WhatsApp da ficha do paciente. Só
 * chama casos de uso (`container.whatsapp.*`) e renderiza estado — a
 * regra de "quando está liberado" e a data de concessão moram no
 * domínio.
 */
export function ContatoWhatsapp({ paciente, aoAtualizar }: { paciente: Paciente; aoAtualizar: () => void }) {
  const container = useContainer();
  const { diagnostico } = useSincronizacao();
  const enderecoLan = diagnostico?.saude?.enderecoLan ?? null;
  const snap = paciente.toSnapshot();
  const consent = snap.consentimentoWhatsapp;

  const [status, setStatus] = useState<StatusConsentimentoWhatsapp>(consent.status);
  const [observacao, setObservacao] = useState(consent.observacao);
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<RegistroWhatsappProps[]>([]);
  const [chaveHistorico, setChaveHistorico] = useState(0);

  useEffect(() => {
    let cancelado = false;
    container.whatsapp.listarHistorico
      .executar(paciente.id)
      .then((lista) => {
        if (!cancelado) setHistorico(lista);
      })
      .catch(() => {
        if (!cancelado) setHistorico([]);
      });
    return () => {
      cancelado = true;
    };
  }, [container, paciente.id, chaveHistorico]);

  const disponibilidade = avaliarDisponibilidadeWhatsapp(snap.celular, consent.status);
  const alterado = status !== consent.status || observacao !== consent.observacao;

  async function salvarConsentimento(): Promise<void> {
    setSalvando(true);
    try {
      await container.whatsapp.definirConsentimento.executar(paciente.id, status, observacao);
      aoAtualizar();
    } finally {
      setSalvando(false);
    }
  }

  const registrarAbertura = useCallback(
    async (numeroNormalizado: string, tipo: Parameters<typeof container.whatsapp.registrarAbertura.executar>[0]['tipo']) => {
      await container.whatsapp.registrarAbertura.executar({ pacienteId: paciente.id, tipo, numeroNormalizado });
      setChaveHistorico((k) => k + 1);
    },
    [container, paciente.id],
  );

  return (
    <Card className="no-print flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Contato por WhatsApp
        </h2>
        <Badge tone={TOM_STATUS[consent.status]}>{STATUS_CONSENTIMENTO_WHATSAPP_LABEL[consent.status]}</Badge>
        {consent.status === 'AUTORIZADO' && consent.concedidoEm && (
          <span className="text-xs text-neutral-500">desde {formatarDataIso(consent.concedidoEm)}</span>
        )}
      </div>

      <p className="text-xs text-neutral-500">{CONSENTIMENTO_WHATSAPP_TEXTO}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label="Consentimento">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusConsentimentoWhatsapp)}>
            {STATUS_OPCOES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONSENTIMENTO_WHATSAPP_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observação / origem (opcional)">
          <Input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: autorizou na consulta; confirmou por telefone"
          />
        </Field>
      </div>
      <Button
        variant="secondary"
        onClick={() => void salvarConsentimento()}
        loading={salvando}
        disabled={!alterado}
        className="self-start"
      >
        Salvar consentimento
      </Button>

      <div className="border-t border-neutral-100 pt-3">
        {disponibilidade.liberado ? (
          <div className="flex flex-col gap-2">
            <BotaoWhatsapp
              variante="secondary"
              rotulo="Falar no WhatsApp"
              preparar={() => container.whatsapp.prepararContato.executar(paciente.id)}
              aoAbrir={registrarAbertura}
            />
            <BotaoWhatsapp
              variante="secondary"
              rotulo="Enviar link de agendamento"
              preparar={() =>
                container.whatsapp.prepararLinkAgendamento.executar(paciente.id, window.location.origin, enderecoLan)
              }
              aoAbrir={registrarAbertura}
            />
            <p className="flex items-start gap-1.5 text-xs text-neutral-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Abre o WhatsApp com a mensagem pronta — você revisa e envia manualmente. O app não envia nada sozinho.
              Nunca inclua dados clínicos (anamnese, diagnóstico, valores) nas mensagens.
            </p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500">{MENSAGEM_INDISPONIBILIDADE_WHATSAPP[disponibilidade.motivo]}</p>
        )}
      </div>

      <div className="border-t border-neutral-100 pt-3">
        <p className="text-xs font-semibold uppercase text-neutral-500">Ações de WhatsApp preparadas</p>
        {historico.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-500">Nenhuma ainda.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-xs text-neutral-600">
            {historico.slice(0, 5).map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-2">
                <span>{formatarDataHoraIso(h.criadoEm)}</span>
                <span>· {TIPO_ACAO_WHATSAPP_LABEL[h.tipo]}</span>
                <span>· {h.numeroMascarado}</span>
                <span className="text-neutral-500">· {h.responsavel}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
