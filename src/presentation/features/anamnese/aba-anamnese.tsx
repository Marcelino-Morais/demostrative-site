import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useBlocker, useOutletContext, type BlockerFunction } from 'react-router-dom';
import { Check, History, Save } from 'lucide-react';
import { anamneseFoiAlterada, criarAnamneseEmBranco, type SalvarAnamneseInput } from '../../../domain/entities/anamnese.js';
import { ErroDominio } from '../../../domain/types.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button, buttonClassName } from '../../components/ui/button.js';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog.js';
import { Spinner } from '../../components/ui/spinner.js';
import type { FichaClinicaContexto } from '../../pages/ficha-clinica-page.js';
import { useContainer } from '../../providers/container-provider.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { FormularioAnamnese } from './formulario-anamnese.js';
import { PainelLinkAnamnese } from './painel-link-anamnese.js';

type StatusAnamnese = 'salvo' | 'restaurado' | 'salvando-rascunho' | 'nao-salvo';

/** Tempo de pausa na digitação antes de gravar o rascunho — nem a cada tecla, nem só ao sair. */
const ATRASO_AUTOSAVE_MS = 1000;

function IndicadorStatus({ status, horario }: { status: StatusAnamnese; horario: string | null }) {
  if (status === 'restaurado') {
    return (
      <Alert tone="warning" title="Rascunho restaurado">
        Encontramos alterações não salvas de uma visita anterior a esta aba e as trouxemos de volta.
        Revise os dados e clique em <span className="font-medium">Salvar anamnese</span> quando terminar.
      </Alert>
    );
  }
  if (status === 'salvo') {
    return (
      <Badge tone="success" className="self-start">
        <Check className="mr-1 h-3 w-3" aria-hidden="true" /> Salvo
      </Badge>
    );
  }
  if (status === 'salvando-rascunho') {
    return (
      <Badge tone="neutral" className="self-start">
        <Save className="mr-1 h-3 w-3" aria-hidden="true" /> Salvando rascunho…
      </Badge>
    );
  }
  return (
    <Badge tone="warning" className="self-start">
      <Save className="mr-1 h-3 w-3" aria-hidden="true" />
      Alterações não salvas{horario ? ` — rascunho salvo automaticamente às ${horario}` : ''}
    </Badge>
  );
}

/**
 * Achado real de revisão (persistência segura — Etapa 2, hardening
 * adicional): um formulário deste tamanho (~40 perguntas) só perdia
 * tudo se a página fosse atualizada ou a usuária navegasse pra outra
 * aba antes de clicar "Salvar anamnese" — nada avisava, nada
 * recuperava. Agora: autosave de rascunho (debounced) a cada mudança
 * real, indicador visível de salvo/não salvo/restaurado, aviso do
 * navegador ao fechar/atualizar a aba com mudanças pendentes, e
 * confirmação ao tentar navegar pra outro lugar do próprio app.
 */
export function AbaAnamnese() {
  const { paciente } = useOutletContext<FichaClinicaContexto>();
  const container = useContainer();
  const [valoresIniciais, setValoresIniciais] = useState<SalvarAnamneseInput | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusAnamnese>('salvo');
  const [horarioUltimoRascunho, setHorarioUltimoRascunho] = useState<string | null>(null);
  const [sujo, setSujo] = useState(false);
  const [erroCarregar, setErroCarregar] = useState(false);
  /** Bump para recarregar a anamnese salva (ex.: depois de importar as respostas recebidas pelo link). */
  const [chaveRecarregar, setChaveRecarregar] = useState(0);

  // Guardam estado "de trabalho" fora do ciclo de re-render — não precisam disparar re-render sozinhos.
  const valoresSalvosRef = useRef<SalvarAnamneseInput | null>(null);
  const valoresEntreguesAoFormularioRef = useRef<SalvarAnamneseInput | null>(null);
  const timeoutAutosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelado = false;
    setErroCarregar(false);
    Promise.all([
      container.anamnese.obter.executar(paciente.id),
      container.anamnese.obterRascunho.executar(paciente.id),
    ])
      .then(([existente, rascunho]) => {
        if (cancelado) return;
        const salvos = existente ? existente.toSnapshot() : criarAnamneseEmBranco(paciente.id);
        valoresSalvosRef.current = salvos;

        const restaurarRascunho = Boolean(rascunho) && anamneseFoiAlterada(salvos, rascunho!);
        const iniciais = restaurarRascunho ? rascunho! : salvos;
        valoresEntreguesAoFormularioRef.current = iniciais;
        setValoresIniciais(iniciais);
        setSujo(restaurarRascunho);
        setStatus(restaurarRascunho ? 'restaurado' : 'salvo');
      })
      .catch(() => {
        // Não abrir o formulário em branco: editar+salvar sobre um erro
        // de carga sobrescreveria a anamnese de verdade no servidor.
        if (!cancelado) setErroCarregar(true);
      });
    return () => {
      cancelado = true;
      if (timeoutAutosaveRef.current) clearTimeout(timeoutAutosaveRef.current);
    };
  }, [container, paciente.id, chaveRecarregar]);

  const handleAlterar = useCallback(
    (valores: SalvarAnamneseInput) => {
      // A própria montagem do formulário dispara este callback uma vez com os
      // valores iniciais (mesma referência) — não é uma edição de verdade,
      // então não mexe no status "restaurado" que acabou de ser definido.
      if (valores === valoresEntreguesAoFormularioRef.current) return;

      const salvos = valoresSalvosRef.current;
      if (!salvos) return;
      const alterado = anamneseFoiAlterada(salvos, valores);
      setSujo(alterado);

      if (timeoutAutosaveRef.current) clearTimeout(timeoutAutosaveRef.current);

      if (!alterado) {
        // A usuária desfez manualmente as mudanças (ex.: Ctrl+Z ou apagou o
        // que tinha digitado) — um rascunho obsoleto não deve continuar por aí.
        void container.anamnese.descartarRascunho.executar(paciente.id);
        setStatus('salvo');
        return;
      }

      setStatus('salvando-rascunho');
      timeoutAutosaveRef.current = setTimeout(() => {
        void container.anamnese.salvarRascunho.executar(paciente.id, valores).then(() => {
          setStatus('nao-salvo');
          setHorarioUltimoRascunho(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        });
      }, ATRASO_AUTOSAVE_MS);
    },
    [container, paciente.id],
  );

  async function handleSalvar(valores: SalvarAnamneseInput): Promise<void> {
    setSalvando(true);
    setErro(null);
    try {
      const anamnese = await container.anamnese.salvar.executar(valores);
      valoresSalvosRef.current = anamnese.toSnapshot();
      setSujo(false);
      setStatus('salvo');
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroDominio ? erroCapturado.message : 'Não foi possível salvar a anamnese.');
    } finally {
      setSalvando(false);
    }
  }

  // Fechar a aba/atualizar a página com alterações não salvas — aviso nativo do navegador.
  useEffect(() => {
    function aoTentarSair(evento: BeforeUnloadEvent): void {
      if (!sujo) return;
      evento.preventDefault();
      evento.returnValue = '';
    }
    window.addEventListener('beforeunload', aoTentarSair);
    return () => window.removeEventListener('beforeunload', aoTentarSair);
  }, [sujo]);

  // Mesmo "sujo", registrado no compartilhado — pra janela automática de
  // solicitações saber que não é seguro interromper agora.
  useRegistrarEdicaoPendente(useId(), sujo);

  // Navegar pra outra aba/paciente dentro do próprio app com alterações não salvas.
  const bloquear: BlockerFunction = useCallback(
    ({ currentLocation, nextLocation }) => sujo && currentLocation.pathname !== nextLocation.pathname,
    [sujo],
  );
  const blocker = useBlocker(bloquear);

  if (erroCarregar) {
    return (
      <Alert tone="warning" title="Não foi possível carregar a anamnese do servidor da clínica">
        <div className="flex flex-col items-start gap-2">
          <span>O servidor pode estar fora do ar. Não abrimos o formulário para não arriscar sobrescrever a
          anamnese salva. Veja o aviso no topo da tela e tente de novo.</span>
          <Button variant="secondary" onClick={() => setChaveRecarregar((k) => k + 1)} className="text-xs">
            Tentar de novo
          </Button>
        </div>
      </Alert>
    );
  }

  if (!valoresIniciais) {
    return (
      <div className="flex justify-center py-10">
        <Spinner label="Carregando anamnese…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PainelLinkAnamnese
        paciente={paciente}
        aoImportar={async () => {
          // As respostas importadas viram o registro salvo — qualquer rascunho
          // pendente (inclusive um em branco) não deve mais sobrepô-las.
          if (timeoutAutosaveRef.current) clearTimeout(timeoutAutosaveRef.current);
          await container.anamnese.descartarRascunho.executar(paciente.id);
          setSujo(false);
          setStatus('salvo');
          setChaveRecarregar((k) => k + 1);
        }}
      />

      {/* Status de rascunho/salvo é um detalhe de uso da tela, não parte do registro clínico — não faz sentido no papel. */}
      <div className="no-print">
        <IndicadorStatus status={status} horario={horarioUltimoRascunho} />
      </div>
      {erro && <Alert tone="danger" className="no-print">{erro}</Alert>}
      <FormularioAnamnese
        key={paciente.id}
        valoresIniciais={valoresIniciais}
        nomePaciente={paciente.nomeCompleto}
        carregando={salvando}
        onSalvar={(valores) => void handleSalvar(valores)}
        onAlterar={handleAlterar}
      />

      <Dialog open={blocker.state === 'blocked'} onOpenChange={(aberto) => !aberto && blocker.reset?.()}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
            <History className="h-5 w-5 text-warning-600" aria-hidden="true" />
            Sair sem salvar oficialmente?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-2 flex flex-col gap-2 text-sm text-neutral-600">
              <p>
                Suas alterações foram salvas automaticamente como rascunho neste dispositivo, mas a
                anamnese ainda não foi salva oficialmente no registro do paciente.
              </p>
              <p>Você pode continuar editando e clicar em "Salvar anamnese", ou sair mesmo assim — o rascunho continua aqui para quando você voltar.</p>
            </div>
          </DialogDescription>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => blocker.reset?.()} className={buttonClassName('secondary')}>
              Continuar editando
            </button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              Sair mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
