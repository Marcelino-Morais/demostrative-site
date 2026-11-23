import { useId, useState } from 'react';
import { Gift, ShieldAlert } from 'lucide-react';
import type { Paciente } from '../../../domain/entities/paciente.js';
import {
  CONSENTIMENTO_CORTESIA_TEXTO,
  MOTIVO_REVISAO_CONSENTIMENTO_CORTESIA_TEXTO,
  STATUS_CONSENTIMENTO_CORTESIA_LABEL,
  type StatusConsentimentoCortesia,
} from '../../../domain/value-objects/consentimento-cortesia.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { Field } from '../../components/ui/field.js';
import { Input, Select } from '../../components/ui/input.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useContainer } from '../../providers/container-provider.js';

/**
 * Pendência de revisão (resposta do Google Forms em conflito com a
 * decisão atual) — nunca aplicada/descartada sem esta ação explícita.
 * Ver `server/index.mjs`, `processarGoogleFormsFichaInicial`.
 */
function AvisoRevisaoConsentimentoCortesia({ paciente, aoAtualizar }: { paciente: Paciente; aoAtualizar: () => void }) {
  const container = useContainer();
  const revisao = paciente.toSnapshot().consentimentoCortesiaRevisao;
  const [processando, setProcessando] = useState(false);

  if (!revisao || revisao.status !== 'PENDENTE') return null;

  async function aplicar(): Promise<void> {
    setProcessando(true);
    try {
      await container.pacientes.aplicarRevisaoConsentimentoCortesia.executar(paciente.id);
      aoAtualizar();
    } finally {
      setProcessando(false);
    }
  }

  async function manterAtual(): Promise<void> {
    setProcessando(true);
    try {
      await container.pacientes.manterConsentimentoCortesiaAtual.executar(paciente.id);
      aoAtualizar();
    } finally {
      setProcessando(false);
    }
  }

  const explicacaoMotivo =
    MOTIVO_REVISAO_CONSENTIMENTO_CORTESIA_TEXTO[revisao.motivo] ?? 'Esta resposta precisa de revisão antes de ser aplicada.';
  const respostaLabel = revisao.respostaExplicita ? 'SIM, autorizar' : 'NÃO autorizar';

  return (
    <Alert tone="warning" title="Resposta do Google Forms aguardando revisão">
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Uma resposta recebida diz <strong>&ldquo;{respostaLabel}&rdquo;</strong>
          {revisao.manifestadoEm && <> em {formatarDataIso(revisao.manifestadoEm)}</>}, mas não foi aplicada
          automaticamente. {explicacaoMotivo}
        </p>
        <p className="text-xs text-neutral-500">
          O consentimento atual continua <strong>{STATUS_CONSENTIMENTO_CORTESIA_LABEL[paciente.toSnapshot().consentimentoCortesia.status]}</strong>{' '}
          até que a equipe decida.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void aplicar()} loading={processando} className="text-xs">
            Aplicar esta resposta
          </Button>
          <Button variant="secondary" onClick={() => void manterAtual()} loading={processando} className="text-xs">
            Manter atual e descartar aviso
          </Button>
        </div>
      </div>
    </Alert>
  );
}

const TOM_STATUS: Record<StatusConsentimentoCortesia, 'success' | 'danger' | 'neutral'> = {
  AUTORIZADO: 'success',
  NAO_AUTORIZADO: 'danger',
  NAO_INFORMADO: 'neutral',
};

const STATUS_OPCOES: StatusConsentimentoCortesia[] = ['AUTORIZADO', 'NAO_AUTORIZADO', 'NAO_INFORMADO'];

/**
 * Consentimento para mensagem de cortesia (aniversário/comemorativa) —
 * SEPARADO do consentimento de WhatsApp acima (`ContatoWhatsapp`).
 * Autorizar um nunca autoriza o outro.
 */
export function ConsentimentoCortesia({ paciente, aoAtualizar }: { paciente: Paciente; aoAtualizar: () => void }) {
  const container = useContainer();
  const consent = paciente.toSnapshot().consentimentoCortesia;

  const [status, setStatus] = useState<StatusConsentimentoCortesia>(consent.status);
  const [observacao, setObservacao] = useState(consent.observacao);
  const [salvando, setSalvando] = useState(false);
  const alterado = status !== consent.status || observacao !== consent.observacao;
  useRegistrarEdicaoPendente(useId(), alterado);

  async function salvar(): Promise<void> {
    setSalvando(true);
    try {
      await container.pacientes.definirConsentimentoCortesia.executar(paciente.id, status, observacao);
      aoAtualizar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card className="no-print flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <Gift className="h-4 w-4" aria-hidden="true" /> Receber felicitações de aniversário pelo WhatsApp
        </h2>
        <Badge tone={TOM_STATUS[consent.status]}>{STATUS_CONSENTIMENTO_CORTESIA_LABEL[consent.status]}</Badge>
        {consent.status === 'AUTORIZADO' && consent.concedidoEm && (
          <span className="text-xs text-neutral-500">desde {formatarDataIso(consent.concedidoEm)}</span>
        )}
      </div>

      <AvisoRevisaoConsentimentoCortesia paciente={paciente} aoAtualizar={aoAtualizar} />

      <p className="text-xs text-neutral-500">{CONSENTIMENTO_CORTESIA_TEXTO}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_1fr]">
        <Field label="Consentimento">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusConsentimentoCortesia)}>
            {STATUS_OPCOES.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONSENTIMENTO_CORTESIA_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observação (opcional)">
          <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: autorizou na consulta" />
        </Field>
      </div>
      <Button variant="secondary" onClick={() => void salvar()} loading={salvando} disabled={!alterado} className="self-start">
        Salvar consentimento
      </Button>
    </Card>
  );
}
