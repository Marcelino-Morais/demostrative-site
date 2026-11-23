import { useEffect, useId, useState } from 'react';
import type { RegistroDental } from '../../../domain/entities/registro-dental.js';
import {
  CONDICAO_DENTAL_LABEL,
  TIPO_REGISTRO_DENTAL_LABEL,
  type CondicaoDental,
  type TipoRegistroDental,
} from '../../../domain/entities/registro-dental.js';
import { ErroDominio } from '../../../domain/types.js';
import { FACES_DENTAIS, FACE_DENTAL_LABEL, nomePopularDoDente, type NumeroDente } from '../../../domain/value-objects/numeracao-dental.js';
import { reaisTextoParaCentavos } from '../../../domain/value-objects/dinheiro.js';
import { CONFIGURACAO_CLINICA } from '../../../infrastructure/bootstrap/configuracao-clinica.js';
import { Alert } from '../../components/ui/alert.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { DesenhoDente } from './desenho-dente.js';
import type { DesenhoDental } from '../../../../server/desenho-dental.mjs';
import { Field } from '../../components/ui/field.js';
import { Input, Select, Textarea } from '../../components/ui/input.js';
import { centavosParaReaisTexto, formatarDataIso, hojeParaInputDate } from '../../lib/formatadores.js';
import { useRegistrarEdicaoPendente } from '../../providers/edicao-pendente-provider.js';
import { useContainer } from '../../providers/container-provider.js';

export interface DenteDetalheDrawerProps {
  pacienteId: string;
  numeroDente: NumeroDente | null;
  historico: RegistroDental[];
  onFechar: () => void;
  onPlanejar?: () => void;
  onRegistroAdicionado: () => void;
  onEstadoEdicao?: (sujo: boolean, salvando: boolean) => void;
}

const CONDICOES: CondicaoDental[] = [
  'SAUDAVEL',
  'CARIADO',
  'RESTAURADO',
  'TRATAMENTO_DE_CANAL',
  'COROA_OU_PROTESE',
  'IMPLANTE',
  'FRATURADO',
  'EM_TRATAMENTO',
  'AUSENTE',
];

const TIPOS: TipoRegistroDental[] = ['PROCEDIMENTO', 'OBSERVACAO', 'CONDICAO_INICIAL'];

/** Formulário e histórico na própria aba. Trocar de dente exige descartar o rascunho explicitamente. */
export function DenteDetalheDrawer({
  pacienteId,
  numeroDente,
  historico,
  onFechar,
  onPlanejar,
  onRegistroAdicionado,
  onEstadoEdicao,
}: DenteDetalheDrawerProps) {
  const container = useContainer();
  const [desenho, setDesenho] = useState<DesenhoDental>({ tracos: [] });
  const [tipo, setTipo] = useState<TipoRegistroDental>('PROCEDIMENTO');
  const [condicao, setCondicao] = useState<CondicaoDental | ''>('');
  const [face, setFace] = useState<(typeof FACES_DENTAIS)[number] | ''>('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(hojeParaInputDate());
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const registrosDoDente = historico.filter((r) => r.toSnapshot().numeroDente === numeroDente);
  // Só conta como pendente com o drawer de fato aberto e algo digitado —
  // nunca reabre o aviso de "sair sem salvar" (Etapa 47 preservada), só
  // adia o popup automático de novas solicitações.
  const sujo = numeroDente !== null && (descricao.trim() !== '' || valor.trim() !== '' || condicao !== '' || face !== '' || desenho.tracos.length > 0);
  useRegistrarEdicaoPendente(useId(), sujo);
  useEffect(() => { onEstadoEdicao?.(sujo, salvando); }, [sujo, salvando, onEstadoEdicao]);

  function limparFormulario(): void {
    setDesenho({ tracos: [] });
    setTipo('PROCEDIMENTO');
    setCondicao('');
    setFace('');
    setDescricao('');
    setData(hojeParaInputDate());
    setValor('');
    setErro(null);
  }

  async function handleSalvar(): Promise<void> {
    if (!numeroDente) return;
    // "Valor" aqui é só uma referência informativa — nunca entra em nenhum
    // total financeiro (isso é responsabilidade exclusiva do Plano de
    // Tratamento). Um texto inválido não trava o registro: vira null.
    const valorCentavos = valor.trim() ? reaisTextoParaCentavos(valor) : null;
    if (valor.trim() && valorCentavos === null) {
      setErro('Valor de referência inválido — use algo como 150,00 ou deixe em branco.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await container.odontograma.registrarProcedimento.executar({
        pacienteId,
        numeroDente,
        face: face || null,
        tipo,
        condicao: condicao || null,
        descricao,
        data,
        profissionalResponsavel: CONFIGURACAO_CLINICA.nomeProfissional,
        valorCentavos,
        desenho,
      });
      limparFormulario();
      onRegistroAdicionado();
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroDominio ? erroCapturado.message : 'Não foi possível salvar o registro.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section id="detalhe-dente" className="rounded-xl border border-neutral-200 bg-surface p-4" aria-label={`Dados do dente ${numeroDente}`}>
      {numeroDente !== null && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">Dente {numeroDente} — {nomePopularDoDente(numeroDente)}</h2><Button variant="secondary" disabled={salvando} onClick={onFechar}>Fechar dente</Button></div>
          <div className="flex flex-col gap-5">
            {onPlanejar && <Button onClick={onPlanejar}>Planejar procedimento neste dente</Button>}
            <div className="no-print grid gap-5 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
            <section><h3 className="mb-2 text-sm font-semibold text-neutral-700">Desenho sobre o dente</h3><DesenhoDente numero={numeroDente} desenho={desenho} onChange={setDesenho} disabled={salvando} /></section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">Novo registro</h3>
              {erro && (
                <Alert tone="danger" className="mb-3">
                  {erro}
                </Alert>
              )}
              <fieldset disabled={salvando} className="flex flex-col gap-3">
                <Field label="Tipo de registro">
                  <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRegistroDental)}>
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_REGISTRO_DENTAL_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Condição do dente" hint="Opcional — define a cor do dente no gráfico quando informada.">
                  <Select value={condicao} onChange={(e) => setCondicao(e.target.value as CondicaoDental | '')}>
                    <option value="">Não alterar condição</option>
                    {CONDICOES.map((c) => (
                      <option key={c} value={c}>
                        {CONDICAO_DENTAL_LABEL[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Face" hint="Opcional — quando o registro é sobre uma face específica do dente.">
                  <Select value={face} onChange={(e) => setFace(e.target.value as (typeof FACES_DENTAIS)[number] | '')}>
                    <option value="">Dente inteiro</option>
                    {FACES_DENTAIS.map((f) => (
                      <option key={f} value={f}>
                        {FACE_DENTAL_LABEL[f]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Data">
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="min-h-11 w-full rounded-md border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                  />
                </Field>
                <Field label="Descrição">
                  <Textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex.: Restauração em resina composta, face oclusal."
                  />
                </Field>
                <Field label="Valor de referência (opcional)" hint="Pode ser usado no orçamento ao selecionar este registro em Trabalho a executar. Não gera cobrança sozinho.">
                  <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 150,00" />
                </Field>
                <p className="text-xs text-neutral-500">Responsável: {CONFIGURACAO_CLINICA.nomeProfissional}</p>
                <Button onClick={() => void handleSalvar()} loading={salvando} className="self-start">
                  Adicionar ao histórico
                </Button>
              </fieldset>
            </section>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-neutral-700">
                Histórico ({registrosDoDente.length})
              </h3>
              {registrosDoDente.length === 0 && (
                <p className="text-sm text-neutral-500">Nenhum registro para este dente ainda.</p>
              )}
              <ol className="flex flex-col gap-3">
                {registrosDoDente.map((registro) => {
                  const snap = registro.toSnapshot();
                  return (
                    <li key={snap.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-neutral-900">{formatarDataIso(snap.data)}</span>
                        <Badge tone="neutral">{TIPO_REGISTRO_DENTAL_LABEL[snap.tipo]}</Badge>
                      </div>
                      {snap.condicao && (
                        <p className="mt-1 text-neutral-700">
                          Condição: {CONDICAO_DENTAL_LABEL[snap.condicao]}
                        </p>
                      )}
                      {snap.face && (
                        <p className="text-neutral-600">Face: {FACE_DENTAL_LABEL[snap.face]}</p>
                      )}
                      {snap.desenho && snap.desenho.tracos.length > 0 && <DesenhoDente numero={snap.numeroDente} desenho={snap.desenho} />}
                      {snap.descricao && <p className="mt-1 text-neutral-700">{snap.descricao}</p>}
                      {snap.valorCentavos !== null && (
                        <p className="mt-1 text-neutral-700">
                          Valor de referência: {centavosParaReaisTexto(snap.valorCentavos)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-neutral-500">Responsável: {snap.profissionalResponsavel}</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        </>
      )}
    </section>
  );
}
