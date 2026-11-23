import { useEffect, useState } from 'react';
import { AlertTriangle, Camera, Check, RotateCcw, Save, X } from 'lucide-react';
import type { TrabalhoCaptura } from '../../../application/ports/gateway-captura-wim.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card } from '../../components/ui/card.js';
import { useContainer } from '../../providers/container-provider.js';

const RETRATO_ESTADO: Record<string, string> = {
  PREPARANDO: 'Preparando…',
  AGUARDANDO_DISPOSITIVO: 'Aguardando o dispositivo…',
  CAPTURANDO: 'Capturando…',
  REVISAO: 'Revisão — confira antes de salvar',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
  FALHA: 'Falha',
};

/**
 * Aquisição via agente de captura desacoplado (continuação da
 * reconstrução do WIM VITOR — pedido explícito: "demonstre o fluxo
 * completo de selecionar paciente, iniciar aquisição sintética, revisar
 * e salvar o exame"). O paciente já está selecionado (é a própria ficha
 * aberta, de onde este painel vive — `aba-exames.tsx`); este componente
 * cuida só de iniciar/avançar/repetir/cancelar/concluir.
 *
 * NUNCA mostra isto como uma captura real — `trabalho.modo` vem sempre
 * do próprio agente, e o aviso "MODO SINTÉTICO" é permanente e
 * destacado enquanto há um trabalho em andamento.
 *
 * Trocar de paciente nunca redireciona uma aquisição em andamento: este
 * componente é desmontado quando a ficha muda de paciente (a aba inteira
 * é por rota de paciente), então o `trabalhoId` em memória aqui some
 * junto — não há como a tela de outro paciente "continuar" um trabalho
 * que nem conhece. `concluir()` no servidor também nunca aceita um
 * `pacienteId` da requisição — só o que está gravado no próprio
 * trabalho (ver `captura-wim.mjs`).
 */
export function PainelCapturaWim({ pacienteId, aoConcluir }: { pacienteId: string; aoConcluir: () => void }) {
  const container = useContainer();
  const [status, setStatus] = useState<{ habilitado: boolean; agenteOnline: boolean; modo?: string } | null>(null);
  const [trabalho, setTrabalho] = useState<TrabalhoCaptura | null>(null);
  const [emAcao, setEmAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluidoArquivoId, setConcluidoArquivoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    container.capturaWim.status
      .executar()
      .then((s) => {
        if (!cancelado) setStatus(s);
      })
      .catch(() => {
        if (!cancelado) setStatus({ habilitado: false, agenteOnline: false });
      });
    return () => {
      cancelado = true;
    };
  }, [container]);

  useEffect(() => {
    if (trabalho?.modo !== 'real-twain' || trabalho.estado !== 'CAPTURANDO') return;
    let ativo = true;
    const timer = setInterval(() => {
      void container.capturaWim.obterTrabalho.executar(trabalho.trabalhoId).then(r => {
        if (ativo && r.ok) setTrabalho(r.trabalho);
      }).catch(() => { if (ativo) setErro('Não foi possível acompanhar a captura. Confira o agente.'); });
    }, 1000);
    return () => { ativo = false; clearInterval(timer); };
  }, [container, trabalho?.trabalhoId, trabalho?.modo, trabalho?.estado]);

  async function iniciar(): Promise<void> {
    setEmAcao(true);
    setErro(null);
    setConcluidoArquivoId(null);
    const r = await container.capturaWim.iniciar.executar(pacienteId);
    if (r.ok) setTrabalho(r.trabalho);
    else setErro(traduzirMotivo(r.motivo));
    setEmAcao(false);
  }

  async function avancar(): Promise<void> {
    if (!trabalho) return;
    setEmAcao(true);
    setErro(null);
    const r = await container.capturaWim.avancar.executar(trabalho.trabalhoId);
    if (r.ok) setTrabalho(r.trabalho);
    else {
      setErro(traduzirMotivo(r.motivo));
      if (r.motivo === 'TRABALHO_NAO_ENCONTRADO') setTrabalho(null); // agente reiniciado — nunca finge que o trabalho continua
    }
    setEmAcao(false);
  }

  async function repetir(): Promise<void> {
    if (!trabalho) return;
    setEmAcao(true);
    setErro(null);
    const r = await container.capturaWim.repetir.executar(trabalho.trabalhoId);
    if (r.ok) setTrabalho(r.trabalho);
    else setErro(traduzirMotivo(r.motivo));
    setEmAcao(false);
  }

  async function cancelar(): Promise<void> {
    if (!trabalho) return;
    setEmAcao(true);
    setErro(null);
    const r = await container.capturaWim.cancelar.executar(trabalho.trabalhoId);
    if (r.ok) setTrabalho(r.trabalho);
    else setErro(traduzirMotivo(r.motivo));
    setEmAcao(false);
  }

  async function concluir(): Promise<void> {
    if (!trabalho) return;
    setEmAcao(true);
    setErro(null);
    const r = await container.capturaWim.concluir.executar(trabalho.trabalhoId);
    if (r.ok) {
      setConcluidoArquivoId(r.arquivoId);
      setTrabalho(null);
      aoConcluir();
    } else {
      setErro(traduzirMotivo(r.motivo));
    }
    setEmAcao(false);
  }

  if (!status?.habilitado) return null; // feature desligada (padrão) — nunca aparece

  return (
    <Card className="flex flex-col gap-2 border-brand-300">
      <div className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-brand-700" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-neutral-700">Captura via agente</h3>
        <Badge tone="warning">{status.modo === 'real-twain' ? 'SENSOR REAL — em validação' : 'MODO SINTÉTICO — nunca uma radiografia real'}</Badge>
      </div>

      {!status.agenteOnline && (
        <Alert tone="warning" title="Agente de captura fora do ar">
          Inicie o agente separadamente (processo próprio, desacoplado do servidor da clínica — ver{' '}
          <code>wim_vitor_project/agente-captura/README.md</code>) e recarregue esta página.
        </Alert>
      )}

      {status.agenteOnline && (
        <>
          {erro && <Alert tone="danger">{erro}</Alert>}
          {concluidoArquivoId && (
            <Alert tone="success">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> {status.modo === 'real-twain' ? 'Imagem real salva no prontuário deste paciente.' : 'Imagem sintética salva no prontuário deste paciente.'}
              </div>
            </Alert>
          )}

          {!trabalho && (
            <Button className="self-start text-xs" loading={emAcao} onClick={() => void iniciar()}>
              {status.modo === 'real-twain' ? 'Preparar captura real' : 'Iniciar aquisição sintética'}
            </Button>
          )}

          {trabalho && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-600">
                Trabalho <code>{trabalho.trabalhoId.slice(0, 8)}</code> — {RETRATO_ESTADO[trabalho.estado] ?? trabalho.estado}
              </p>

              {(trabalho.estado === 'PREPARANDO' || trabalho.estado === 'AGUARDANDO_DISPOSITIVO' || trabalho.estado === 'CAPTURANDO') && (
                <div className="flex gap-2">
                  <Button className="text-xs" loading={emAcao} onClick={() => void avancar()}>
                    Avançar
                  </Button>
                  <Button variant="secondary" className="text-xs" loading={emAcao} onClick={() => void cancelar()}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                  </Button>
                </div>
              )}

              {trabalho.estado === 'REVISAO' && trabalho.imagemCandidata && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-warning-700">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {trabalho.modo === 'real-twain' ? 'Imagem recebida do sensor. Confira o paciente e a qualidade antes de salvar.' : 'Imagem sintética de demonstração — não é uma radiografia real.'}
                  </div>
                  <img
                    src={`data:image/${trabalho.imagemCandidata.formato};base64,${trabalho.imagemCandidata.bytesBase64}`}
                    alt="Prévia da captura"
                    className="h-24 w-24 rounded border border-neutral-300 object-contain"
                  />
                  <div className="flex gap-2">
                    <Button className="text-xs" loading={emAcao} onClick={() => void concluir()}>
                      <Save className="h-3.5 w-3.5" aria-hidden="true" /> Salvar no prontuário
                    </Button>
                    <Button variant="secondary" className="text-xs" loading={emAcao} onClick={() => void repetir()}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Repetir captura
                    </Button>
                    <Button variant="secondary" className="text-xs" loading={emAcao} onClick={() => void cancelar()}>
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function traduzirMotivo(motivo: string): string {
  const mapa: Record<string, string> = {
    AGENTE_INDISPONIVEL: 'O agente de captura não respondeu. Confira se o processo está rodando.',
    TRABALHO_NAO_ENCONTRADO: 'Este trabalho não existe mais (o agente pode ter reiniciado). Inicie uma nova captura.',
    TRABALHO_NAO_ESTA_EM_REVISAO: 'Esta captura ainda não está pronta para salvar.',
    CONCLUSAO_EM_ANDAMENTO: 'Esta captura já está sendo salva (outro clique ou aba) — aguarde.',
    PACIENTE_NAO_ENCONTRADO: 'O paciente desta captura não foi encontrado no cadastro.',
    CAPTURA_DESABILITADA: 'A captura via agente está desligada neste servidor.',
  };
  return mapa[motivo] ?? (motivo.startsWith('IMAGEM_INVALIDA') ? 'A imagem capturada não passou na validação.' : `Erro: ${motivo}`);
}

