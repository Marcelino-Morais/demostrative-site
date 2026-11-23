import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { SalvarAnamneseInput, SinalBucal } from '../../../domain/entities/anamnese.js';
import { MEDICAMENTO_ESPECIFICO_LABEL, resumoAnamnese, SINAL_BUCAL_LABEL } from '../../../domain/entities/anamnese.js';
import { Alert } from '../../components/ui/alert.js';
import { Button } from '../../components/ui/button.js';
import { CampoSimNao } from '../../components/ui/campo-sim-nao.js';
import { Card } from '../../components/ui/card.js';
import { Checkbox } from '../../components/ui/checkbox.js';
import { Field } from '../../components/ui/field.js';
import { Input, Textarea } from '../../components/ui/input.js';
import { cn } from '../../lib/cn.js';
import { SecaoAnamnese } from './secao.js';

export interface FormularioAnamneseProps {
  valoresIniciais: SalvarAnamneseInput;
  nomePaciente: string;
  carregando?: boolean;
  erro?: string | null;
  /** Rótulo do botão de envio — "Salvar anamnese" no app; "Enviar minhas respostas" na página do paciente. */
  rotuloSalvar?: string;
  /**
   * `false` esconde o quadro "Pontos de atenção clínica" (Etapa 46 —
   * auditoria de usabilidade do link público). Esse quadro é redigido
   * para quem VAI TRATAR o paciente ("Paciente gestante.", "risco de
   * sangramento ou osteonecrose") — faz sentido pra Dra. Fernanda
   * revisando a ficha, mas soa estranho/alarmante pro próprio paciente
   * ler sobre si mesmo em terceira pessoa, com jargão clínico, antes
   * de sequer terminar de responder. A barra de progresso continua
   * (é útil pros dois lados). Padrão `true` — preserva o
   * comportamento de sempre na tela profissional.
   */
  mostrarPontosDeAtencao?: boolean;
  onSalvar: (valores: SalvarAnamneseInput) => void;
  /**
   * Achado de revisão (persistência segura — Etapa 2, hardening
   * adicional): antes, o único jeito de "sair" os valores deste
   * formulário era clicar em Salvar — navegar pra outra aba ou
   * atualizar a página antes disso perdia tudo silenciosamente. Este
   * componente continua dono do próprio estado (`valores`), mas agora
   * também avisa a tela-mãe (`aba-anamnese.tsx`) a cada mudança, pra
   * ela decidir autosave de rascunho / indicador de "não salvo" — a
   * regra de QUANDO/COMO persistir o rascunho fica lá, não aqui.
   */
  onAlterar?: (valores: SalvarAnamneseInput) => void;
}

const MEDICAMENTOS_ESPECIFICOS_LABEL = MEDICAMENTO_ESPECIFICO_LABEL;

const SINAIS_BUCAIS: SinalBucal[] = [
  'SANGRAMENTO_GENGIVAL',
  'GENGIVA_INCHADA',
  'DENTES_ABALADOS',
  'DOR_AO_ABRIR_OU_FECHAR_BOCA',
  'GOSTO_RUIM_OU_MAU_HALITO',
];

/**
 * Anamnese digital (docx "Anamnese com ficha clinica" convertido em
 * formulário estruturado) — mesmas seções e perguntas do documento
 * original, com controles de formulário de verdade (grupos sim/não,
 * checkboxes, textos, datas) em vez do texto livre "(  ) sim (  )
 * não" da versão impressa.
 */
export function FormularioAnamnese({
  valoresIniciais,
  nomePaciente,
  carregando = false,
  erro,
  rotuloSalvar = 'Salvar anamnese',
  mostrarPontosDeAtencao = true,
  onSalvar,
  onAlterar,
}: FormularioAnamneseProps) {
  const [valores, setValores] = useState<SalvarAnamneseInput>(valoresIniciais);

  // A tela-mãe só passa um `valoresIniciais` com NOVA referência quando
  // recarrega de verdade (troca de paciente, ou importar as respostas
  // recebidas pelo link) — nesse caso o formulário adota o novo conteúdo.
  // Durante a digitação a referência é estável, então isto não atrapalha.
  useEffect(() => {
    setValores(valoresIniciais);
  }, [valoresIniciais]);

  useEffect(() => {
    onAlterar?.(valores);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onAlterar` só precisa disparar quando `valores` muda, não a cada nova referência de função vinda da tela-mãe.
  }, [valores]);

  const resumo = useMemo(() => resumoAnamnese(valores), [valores]);
  const percentual = Math.round(resumo.percentual * 100);

  function atualizar<K extends keyof SalvarAnamneseInput>(campo: K, valor: SalvarAnamneseInput[K]): void {
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  function alternarSinalBucal(sinal: SinalBucal): void {
    setValores((atual) => {
      const jaTem = atual.historicoSaudeBucal.sinaisNotados.includes(sinal);
      return {
        ...atual,
        historicoSaudeBucal: {
          ...atual.historicoSaudeBucal,
          sinaisNotados: jaTem
            ? atual.historicoSaudeBucal.sinaisNotados.filter((s) => s !== sinal)
            : [...atual.historicoSaudeBucal.sinaisNotados, sinal],
        },
      };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <Alert tone="danger">{erro}</Alert>}

      {/* Ajuda de preenchimento — não faz parte do registro clínico impresso. */}
      <Card className="no-print flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">Histórico de saúde do paciente</h2>
          <Button onClick={() => onSalvar(valores)} loading={carregando}>{rotuloSalvar}</Button>
          <span className="text-sm font-medium text-neutral-600">
            {percentual}% · {resumo.respondidas}/{resumo.totalPerguntas} respostas
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
          role="progressbar"
          aria-valuenow={percentual}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso do preenchimento da anamnese"
        >
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percentual}%` }} />
        </div>

        {mostrarPontosDeAtencao && resumo.pontosDeAtencao.length > 0 && (
          <div className="rounded-md border border-warning-200 bg-warning-50 p-2.5 text-xs text-warning-800 dark:border-warning-800 dark:bg-warning-900/30 dark:text-warning-200">
            <p className="font-semibold">Pontos de atenção clínica</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {resumo.pontosDeAtencao.map((ponto) => (
                <li key={ponto}>{ponto}</li>
              ))}
            </ul>
          </div>
        )}

        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none font-medium">Ver por seção</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {resumo.secoes.map((secao) => (
              <li
                key={secao.id}
                className={cn(
                  'flex items-center gap-1.5',
                  secao.completa ? 'text-success-700 dark:text-success-500' : 'text-neutral-500',
                )}
              >
                {secao.completa ? (
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
                )}
                <span>{secao.titulo}</span>
                <span className="tabular-nums text-neutral-400">
                  ({secao.respondidas}/{secao.totalPerguntas})
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <SecaoAnamnese titulo="Identificação">
        <p className="text-sm text-neutral-600">
          Paciente: <span className="font-medium text-neutral-900">{nomePaciente}</span>. Dados
          cadastrais (nascimento, CPF, endereço...) ficam na aba{' '}
          <span className="font-medium">Dados</span> — a anamnese cobre só o histórico de saúde.
        </p>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Queixa principal">
        <Field label="Qual sua principal queixa (motivo da consulta)?">
          <Textarea
            value={valores.queixaPrincipal}
            onChange={(e) => atualizar('queixaPrincipal', e.target.value)}
            rows={4}
          />
        </Field>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Alergias e medicação em uso">
        <CampoSimNao
          label="Alergia a alguma medicação?"
          rotuloNao="Não / nenhuma"
          value={valores.alergiaMedicacao}
          onChange={(v) => atualizar('alergiaMedicacao', v)}
        />
        {valores.alergiaMedicacao === 'SIM' && (
          <Field label="Quais?">
            <Input value={valores.alergiaMedicacaoQuais} onChange={(e) => atualizar('alergiaMedicacaoQuais', e.target.value)} />
          </Field>
        )}
        <CampoSimNao
          label="Está tomando algum medicamento?"
          value={valores.usaMedicamento}
          onChange={(v) => atualizar('usaMedicamento', v)}
        />
        {valores.usaMedicamento === 'SIM' && (
          <Field label="Qual ou quais?">
            <Textarea value={valores.usaMedicamentoQuais} onChange={(e) => atualizar('usaMedicamentoQuais', e.target.value)} />
          </Field>
        )}
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Saúde geral">
        <Field label="Pressão sanguínea">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-md border border-neutral-300 p-0.5">
              {(['ALTA', 'NORMAL'] as const).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => atualizar('pressaoArterial', valores.pressaoArterial === opcao ? null : opcao)}
                  className={`min-h-9 rounded px-3 text-sm font-medium ${
                    valores.pressaoArterial === opcao ? 'bg-brand-700 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {opcao === 'ALTA' ? 'Alta' : 'Normal'}
                </button>
              ))}
            </div>
            <Input
              value={valores.pressaoArterialValor}
              onChange={(e) => atualizar('pressaoArterialValor', e.target.value)}
              placeholder="Valor (opcional)"
              className="max-w-40"
            />
          </div>
        </Field>
        <CampoSimNao
          label="Tem algum problema de saúde?"
          value={valores.temProblemaDeSaude}
          onChange={(v) => atualizar('temProblemaDeSaude', v)}
        />
        {valores.temProblemaDeSaude === 'SIM' && (
          <Field label="Qual ou quais?">
            <Textarea value={valores.problemaDeSaudeQual} onChange={(e) => atualizar('problemaDeSaudeQual', e.target.value)} />
          </Field>
        )}
        <CampoSimNao
          label="Esteve ou está sob tratamento médico?"
          value={valores.estaSobTratamentoMedico}
          onChange={(v) => atualizar('estaSobTratamentoMedico', v)}
        />
        {valores.estaSobTratamentoMedico === 'SIM' && (
          <Field label="Qual o motivo?">
            <Input value={valores.tratamentoMedicoMotivo} onChange={(e) => atualizar('tratamentoMedicoMotivo', e.target.value)} />
          </Field>
        )}
        <Field label="Nome do(a) médico(a) que acompanha com frequência">
          <Input value={valores.nomeMedicoQueAcompanha} onChange={(e) => atualizar('nomeMedicoQueAcompanha', e.target.value)} />
        </Field>
        <CampoSimNao
          label="Possui alguma síndrome?"
          value={valores.possuiSindrome}
          onChange={(v) => atualizar('possuiSindrome', v)}
        />
        {valores.possuiSindrome === 'SIM' && (
          <Field label="Qual?">
            <Input value={valores.possuiSindromeQual} onChange={(e) => atualizar('possuiSindromeQual', e.target.value)} />
          </Field>
        )}
        <CampoSimNao
          label="Faz uso de antidepressivos?"
          value={valores.usaAntidepressivo}
          onChange={(v) => atualizar('usaAntidepressivo', v)}
        />
        {valores.usaAntidepressivo === 'SIM' && (
          <Field label="Nome">
            <Input value={valores.usaAntidepressivoNome} onChange={(e) => atualizar('usaAntidepressivoNome', e.target.value)} />
          </Field>
        )}
        <CampoSimNao
          label="Apresenta algum processo alérgico?"
          value={valores.apresentaProcessoAlergico}
          onChange={(v) => atualizar('apresentaProcessoAlergico', v)}
        />
        {valores.apresentaProcessoAlergico === 'SIM' && (
          <Field label="Qual?">
            <Input value={valores.processoAlergicoQual} onChange={(e) => atualizar('processoAlergicoQual', e.target.value)} />
          </Field>
        )}
        <Field label="Peso (kg)">
          <Input
            type="number"
            min={0}
            value={valores.pesoKg ?? ''}
            onChange={(e) => atualizar('pesoKg', e.target.value ? Number(e.target.value) : null)}
            className="max-w-32"
          />
        </Field>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Medicamentos de atenção especial — já fez uso ou ainda faz?">
        <Checkbox id="medicamentos-especiais-nenhum" label="Nenhum — nunca fiz uso dos medicamentos abaixo"
          checked={valores.medicamentosEspeciaisNenhum === true}
          disabled={Object.values(valores.medicamentosEspecificos).some(Boolean)}
          onChange={e => atualizar('medicamentosEspeciaisNenhum', e.target.checked)} />
        <p className="text-xs text-neutral-500">Se algum medicamento já estiver marcado, desmarque-o antes de escolher “Nenhum”. Deixar tudo em branco significa não informado.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(MEDICAMENTOS_ESPECIFICOS_LABEL) as (keyof SalvarAnamneseInput['medicamentosEspecificos'])[]).map(
            (chave) => (
              <Checkbox
                key={chave}
                id={`medicamento-${chave}`}
                label={MEDICAMENTOS_ESPECIFICOS_LABEL[chave]}
                checked={valores.medicamentosEspecificos[chave]}
                onChange={(e) =>
                  { if (e.target.checked) atualizar('medicamentosEspeciaisNenhum', false); atualizar('medicamentosEspecificos', {
                    ...valores.medicamentosEspecificos,
                    [chave]: e.target.checked,
                  }); }
                }
              />
            ),
          )}
        </div>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Radioterapia / quimioterapia">
        <CampoSimNao
          label="Já realizou tratamento de radioterapia ou quimioterapia?"
          value={valores.jaFezRadioterapiaOuQuimioterapia}
          onChange={(v) => atualizar('jaFezRadioterapiaOuQuimioterapia', v)}
        />
        {valores.jaFezRadioterapiaOuQuimioterapia === 'SIM' && (
          <Field label="Há quanto tempo?">
            <Input
              value={valores.radioterapiaOuQuimioterapiaHaQuantoTempo}
              onChange={(e) => atualizar('radioterapiaOuQuimioterapiaHaQuantoTempo', e.target.value)}
            />
          </Field>
        )}
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Cirurgias, hemorragia e exames de rotina">
        <CampoSimNao label="Já foi operado(a)?" value={valores.jaFoiOperado} onChange={(v) => atualizar('jaFoiOperado', v)} />
        {valores.jaFoiOperado === 'SIM' && (
          <Field label="Qual a operação?">
            <Input value={valores.jaFoiOperadoQualOperacao} onChange={(e) => atualizar('jaFoiOperadoQualOperacao', e.target.value)} />
          </Field>
        )}
        <CampoSimNao label="Já teve hemorragia?" value={valores.jaTeveHemorragia} onChange={(v) => atualizar('jaTeveHemorragia', v)} />
        <CampoSimNao
          label="Fez exames de rotina nos últimos 5 anos?"
          value={valores.fezExamesDeRotinaUltimos5Anos}
          onChange={(v) => atualizar('fezExamesDeRotinaUltimos5Anos', v)}
        />
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Gestação (quando aplicável)">
        <CampoSimNao label="Está grávida?" value={valores.estaGravida} onChange={(v) => atualizar('estaGravida', v)} />
        {valores.estaGravida === 'SIM' && (
          <Field label="Idade gestacional">
            <Input value={valores.idadeGestacional} onChange={(e) => atualizar('idadeGestacional', e.target.value)} />
          </Field>
        )}
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Histórico de saúde bucal">
        <CampoSimNao
          label="Já recebeu anestesia odontológica?"
          value={valores.historicoSaudeBucal.jaRecebeuAnestesiaOdontologica}
          onChange={(v) => atualizar('historicoSaudeBucal', { ...valores.historicoSaudeBucal, jaRecebeuAnestesiaOdontologica: v })}
        />
        {valores.historicoSaudeBucal.jaRecebeuAnestesiaOdontologica === 'SIM' && (
          <Field label="Teve alguma reação?">
            <Input
              value={valores.historicoSaudeBucal.reacaoAnestesia}
              onChange={(e) => atualizar('historicoSaudeBucal', { ...valores.historicoSaudeBucal, reacaoAnestesia: e.target.value })}
            />
          </Field>
        )}
        <CampoSimNao
          label="Já extraiu algum dente?"
          value={valores.historicoSaudeBucal.jaExtraiuDente}
          onChange={(v) => atualizar('historicoSaudeBucal', { ...valores.historicoSaudeBucal, jaExtraiuDente: v })}
        />
        <CampoSimNao
          label="Costuma sangrar muito quando extrai dente ou se machuca?"
          value={valores.historicoSaudeBucal.sangraMuitoAoExtrairOuMachucar}
          onChange={(v) => atualizar('historicoSaudeBucal', { ...valores.historicoSaudeBucal, sangraMuitoAoExtrairOuMachucar: v })}
        />
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-800">Já notou:</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SINAIS_BUCAIS.map((sinal) => (
              <Checkbox
                key={sinal}
                id={`sinal-${sinal}`}
                label={SINAL_BUCAL_LABEL[sinal]}
                checked={valores.historicoSaudeBucal.sinaisNotados.includes(sinal)}
                onChange={() => alternarSinalBucal(sinal)}
              />
            ))}
          </div>
        </div>
        <CampoSimNao
          label="Já sofreu trauma/fratura nos dentes ou ossos da face?"
          value={valores.historicoSaudeBucal.jaSofreuTraumaOuFratura}
          onChange={(v) => atualizar('historicoSaudeBucal', { ...valores.historicoSaudeBucal, jaSofreuTraumaOuFratura: v })}
        />
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Hábitos nocivos">
        <CampoSimNao
          label="Foi ou é fumante?"
          value={valores.habitosNocivos.fumante}
          onChange={(v) => atualizar('habitosNocivos', { ...valores.habitosNocivos, fumante: v })}
        />
        {valores.habitosNocivos.fumante === 'SIM' && (
          <Field label="Por quanto tempo?">
            <Input
              value={valores.habitosNocivos.fumantePorQuantoTempo}
              onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, fumantePorQuantoTempo: e.target.value })}
            />
          </Field>
        )}
        <CampoSimNao
          label="Faz uso de bebida alcoólica?"
          value={valores.habitosNocivos.usaBebidaAlcoolica}
          onChange={(v) => atualizar('habitosNocivos', { ...valores.habitosNocivos, usaBebidaAlcoolica: v })}
        />
        {valores.habitosNocivos.usaBebidaAlcoolica === 'SIM' && (
          <Field label="Frequência de uso">
            <Input
              value={valores.habitosNocivos.bebidaAlcoolicaFrequencia}
              onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, bebidaAlcoolicaFrequencia: e.target.value })}
            />
          </Field>
        )}
        <CampoSimNao
          label="Faz uso de drogas ilícitas?"
          value={valores.habitosNocivos.usaDrogasIlicitas}
          onChange={(v) => atualizar('habitosNocivos', { ...valores.habitosNocivos, usaDrogasIlicitas: v })}
        />
        {valores.habitosNocivos.usaDrogasIlicitas === 'SIM' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Qual o tipo?">
              <Input
                value={valores.habitosNocivos.drogasIlicitasTipo}
                onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, drogasIlicitasTipo: e.target.value })}
              />
            </Field>
            <Field label="Frequência de uso">
              <Input
                value={valores.habitosNocivos.drogasIlicitasFrequencia}
                onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, drogasIlicitasFrequencia: e.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="flex flex-wrap gap-4">
          <Checkbox
            id="aperta-dentes"
            label="Aperta dentes"
            checked={valores.habitosNocivos.apertaDentes}
            onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, apertaDentes: e.target.checked })}
          />
          <Checkbox
            id="range-dentes"
            label="Range dentes"
            checked={valores.habitosNocivos.rangeDentes}
            onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, rangeDentes: e.target.checked })}
          />
          <Checkbox
            id="morde-objetos"
            label="Morde objetos com os dentes"
            checked={valores.habitosNocivos.mordeObjetosComOsDentes}
            onChange={(e) => atualizar('habitosNocivos', { ...valores.habitosNocivos, mordeObjetosComOsDentes: e.target.checked })}
          />
        </div>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Hábitos de higiene bucal">
        <Field label="Quantas vezes escova os dentes por dia?">
          <Input
            type="number"
            min={0}
            value={valores.higieneBucal.escovacoesPorDia ?? ''}
            onChange={(e) =>
              atualizar('higieneBucal', {
                ...valores.higieneBucal,
                escovacoesPorDia: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="max-w-32"
          />
        </Field>
        <CampoSimNao
          label="Faz uso do fio dental?"
          value={valores.higieneBucal.usaFioDental}
          onChange={(v) => atualizar('higieneBucal', { ...valores.higieneBucal, usaFioDental: v })}
        />
        <Field label="Utiliza outro recurso para limpar os dentes?">
          <Input
            value={valores.higieneBucal.outroRecursoDeLimpeza}
            onChange={(e) => atualizar('higieneBucal', { ...valores.higieneBucal, outroRecursoDeLimpeza: e.target.value })}
          />
        </Field>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Observações adicionais">
        <Field label="Mais alguma informação sobre seu histórico com dentistas?">
          <Textarea
            value={valores.observacoesAdicionais}
            onChange={(e) => atualizar('observacoesAdicionais', e.target.value)}
            rows={4}
          />
        </Field>
      </SecaoAnamnese>

      <SecaoAnamnese titulo="Consentimento">
        <Field label="Local e data" hint='Ex.: "Uberlândia, 12 de março de 2025".'>
          <Input value={valores.localEDataAssinatura} onChange={(e) => atualizar('localEDataAssinatura', e.target.value)} />
        </Field>
        <Checkbox
          id="confirmacao-paciente"
          label="O paciente confirma que as informações acima são verdadeiras (substitui a assinatura física)."
          checked={valores.pacienteConfirmouDados}
          onChange={(e) => atualizar('pacienteConfirmouDados', e.target.checked)}
        />
      </SecaoAnamnese>

      <Button onClick={() => onSalvar(valores)} loading={carregando} className="no-print self-start">
        {rotuloSalvar}
      </Button>
    </div>
  );
}
