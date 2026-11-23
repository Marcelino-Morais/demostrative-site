import { textoDentesTratamento } from '../../../domain/value-objects/dentes-tratamento.js';
import type { ReactNode } from 'react';
import type {
  DocumentoAnamnese,
  DocumentoPlano,
  DocumentosDoPaciente,
} from '../../../application/use-cases/documentos-paciente.js';
import { STATUS_CONSULTA_LABEL } from '../../../domain/entities/consulta.js';
import type { ConsultaProps } from '../../../domain/entities/consulta.js';
import type { EvolucaoClinicaProps } from '../../../domain/entities/evolucao-clinica.js';
import type { PacienteProps } from '../../../domain/entities/paciente.js';
import { CONDICAO_DENTAL_LABEL, TIPO_REGISTRO_DENTAL_LABEL } from '../../../domain/entities/registro-dental.js';
import type { GrupoHistoricoDente } from '../../../domain/entities/registro-dental.js';
import { AVISO_TAXA_EMERGENCIA } from '../../../domain/value-objects/atendimento-emergencia.js';
import { CONFIGURACAO_CLINICA } from '../../../infrastructure/bootstrap/configuracao-clinica.js';
import { centavosParaReaisTexto, formatarDataHoraIso, formatarDataIso } from '../../lib/formatadores.js';
import { useEnderecoClinica } from '../../lib/usar-endereco-clinica.js';
import { linhasPlanoDePagamento } from '../plano-tratamento/plano-tratamento-format.js';

/** Título de cada seção do documento — `<h2>` com respiro e sem quebra logo abaixo na impressão. */
function TituloSecao({ children }: { children: ReactNode }) {
  return (
    <h2 className="border-b border-neutral-300 pb-1 text-base font-semibold text-neutral-900">
      {children}
    </h2>
  );
}

function Secao({ children }: { children: ReactNode }) {
  return <section className="doc-secao flex flex-col gap-3">{children}</section>;
}

/** Par rótulo → valor, usado na ficha de identificação e na anamnese. */
function Campo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="evitar-quebra flex flex-col gap-0.5 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{rotulo}</span>
      <span className="text-neutral-900">{valor}</span>
      {detalhe && <span className="text-neutral-600">{detalhe}</span>}
    </div>
  );
}

/**
 * Cabeçalho comum a todo documento impresso: identidade da profissional
 * e da clínica, identidade do paciente e data de geração. Aparece em
 * tela E no papel (não é `no-print`).
 */
export function CabecalhoDocumento({
  documentos,
  tituloDocumento,
}: {
  documentos: DocumentosDoPaciente;
  tituloDocumento: string;
}) {
  const p = documentos.paciente;
  const endereco = useEnderecoClinica();
  return (
    <header className="flex flex-col gap-3 border-b-2 border-neutral-800 pb-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-lg font-bold text-neutral-900">{CONFIGURACAO_CLINICA.nomeClinica}</p>
        <p className="text-sm text-neutral-700">
          {CONFIGURACAO_CLINICA.nomeProfissional} · {CONFIGURACAO_CLINICA.registroProfissional} ·{' '}
          {CONFIGURACAO_CLINICA.cidade}
        </p>
        {endereco && <p className="text-xs text-neutral-500">{endereco}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-neutral-900">{tituloDocumento}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-sm text-neutral-700">
          <span>
            <span className="text-neutral-500">Paciente:</span> <span className="font-medium">{p.nomeCompleto}</span>
          </span>
          {documentos.idade !== null && (
            <span>
              <span className="text-neutral-500">Idade:</span> {documentos.idade} anos
            </span>
          )}
          {p.dataNascimento && (
            <span>
              <span className="text-neutral-500">Nascimento:</span> {formatarDataIso(p.dataNascimento)}
            </span>
          )}
          {p.cpf && (
            <span>
              <span className="text-neutral-500">CPF:</span> {p.cpf}
            </span>
          )}
          {p.rg && (
            <span>
              <span className="text-neutral-500">RG:</span> {p.rg}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500">Documento gerado em {formatarDataHoraIso(documentos.geradoEm)}</p>
      </div>
    </header>
  );
}

export function SecaoFichaClinica({ paciente, idade }: { paciente: PacienteProps; idade: number | null }) {
  return (
    <Secao>
      <TituloSecao>Ficha clínica — identificação</TituloSecao>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome completo" valor={paciente.nomeCompleto} />
        <Campo
          rotulo="Data de nascimento"
          valor={paciente.dataNascimento ? formatarDataIso(paciente.dataNascimento) : 'Não informada'}
          detalhe={idade !== null ? `${idade} anos` : undefined}
        />
        <Campo rotulo="Estado civil" valor={paciente.estadoCivil || 'Não informado'} />
        <Campo rotulo="CPF" valor={paciente.cpf || 'Não informado'} />
        <Campo rotulo="RG" valor={paciente.rg || 'Não informado'} />
        <Campo rotulo="Celular" valor={paciente.celular || 'Não informado'} />
        <Campo rotulo="E-mail" valor={paciente.email || 'Não informado'} />
        <Campo rotulo="Indicado por" valor={paciente.indicadoPor || 'Não informado'} />
        <Campo rotulo="Endereço" valor={paciente.endereco || 'Não informado'} />
        <Campo rotulo="Cadastrado em" valor={formatarDataIso(paciente.criadoEm)} />
        {paciente.arquivadoEm && (
          <Campo rotulo="Situação" valor={`Arquivado em ${formatarDataIso(paciente.arquivadoEm)}`} />
        )}
      </div>
    </Secao>
  );
}

export function SecaoAnamneseDoc({ anamnese }: { anamnese: DocumentoAnamnese | null }) {
  return (
    <Secao>
      <TituloSecao>Anamnese</TituloSecao>
      {!anamnese ? (
        <p className="text-sm text-neutral-500">Anamnese ainda não preenchida para este paciente.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            Atualizada em {formatarDataIso(anamnese.atualizadoEm)} · {Math.round(anamnese.percentualPreenchido * 100)}%
            preenchida
          </p>

          {anamnese.pontosDeAtencao.length > 0 && (
            <div className="evitar-quebra rounded-md border border-warning-300 bg-warning-50 p-2.5 text-sm text-warning-800 dark:border-warning-700 dark:bg-warning-900/20 dark:text-warning-200">
              <p className="font-semibold">Pontos de atenção clínica</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {anamnese.pontosDeAtencao.map((ponto) => (
                  <li key={ponto}>{ponto}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {anamnese.secoes.map((secao) => (
              <div key={secao.id} className="evitar-quebra flex flex-col gap-1.5">
                <h3 className="text-sm font-semibold text-neutral-800">{secao.titulo}</h3>
                <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {secao.itens.map((item) => (
                    <div key={item.rotulo} className="text-sm">
                      <dt className="text-neutral-500">{item.rotulo}</dt>
                      <dd className="font-medium text-neutral-900">
                        {item.valor}
                        {item.detalhe && (
                          <span className="block text-xs font-normal text-neutral-600">
                            {item.detalhe}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="evitar-quebra mt-2 border-t border-neutral-200 pt-3 text-sm">
            <p className="font-semibold text-neutral-800">Consentimento</p>
            <p className="text-neutral-700">
              {anamnese.consentimento.confirmado
                ? 'O paciente confirmou que as informações acima são verdadeiras (substitui a assinatura física).'
                : 'Confirmação do paciente ainda não registrada.'}
            </p>
            {anamnese.consentimento.localEData && (
              <p className="text-neutral-600">{anamnese.consentimento.localEData}</p>
            )}
            <div className="mt-8 border-t border-neutral-500 pt-1 text-center text-xs text-neutral-500 sm:max-w-xs">
              Assinatura do paciente
            </div>
          </div>
        </>
      )}
    </Secao>
  );
}

export function SecaoOdontogramaDoc({
  odontograma,
}: {
  odontograma: DocumentosDoPaciente['odontograma'];
}) {
  return (
    <Secao>
      <TituloSecao>Histórico do odontograma</TituloSecao>
      {odontograma.totalRegistros === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum registro no odontograma.</p>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {odontograma.totalRegistros} registro{odontograma.totalRegistros > 1 ? 's' : ''} em{' '}
            {odontograma.dentesComRegistro} dente{odontograma.dentesComRegistro > 1 ? 's' : ''}.
          </p>
          <div className="flex flex-col gap-3">
            {odontograma.dentes.map((grupo) => (
              <BlocoDente key={grupo.numeroDente} grupo={grupo} />
            ))}
          </div>
        </>
      )}
    </Secao>
  );
}

function BlocoDente({ grupo }: { grupo: GrupoHistoricoDente }) {
  return (
    <div className="evitar-quebra rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-semibold text-neutral-900">
          Dente {grupo.numeroDente} — {grupo.nomePopular}
        </p>
        <p className="text-xs text-neutral-500">
          Condição atual: {grupo.condicaoAtual ? CONDICAO_DENTAL_LABEL[grupo.condicaoAtual] : 'não registrada'}
        </p>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-[0.65rem] uppercase text-neutral-500">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">Data</th>
              <th scope="col" className="py-1 pr-2 font-medium">Tipo</th>
              <th scope="col" className="py-1 pr-2 font-medium">Condição</th>
              <th scope="col" className="py-1 pr-2 font-medium">Descrição</th>
              <th scope="col" className="py-1 pr-2 font-medium">Valor</th>
              <th scope="col" className="py-1 font-medium">Profissional</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {grupo.registros.map((r) => (
              <tr key={r.id}>
                <td className="py-1 pr-2 align-top text-neutral-700">{formatarDataIso(r.data)}</td>
                <td className="py-1 pr-2 align-top text-neutral-700">
                  {TIPO_REGISTRO_DENTAL_LABEL[r.tipo]}
                </td>
                <td className="py-1 pr-2 align-top text-neutral-700">
                  {r.condicao ? CONDICAO_DENTAL_LABEL[r.condicao] : '—'}
                </td>
                <td className="py-1 pr-2 align-top text-neutral-700">{r.descricao || '—'}</td>
                <td className="py-1 pr-2 align-top text-neutral-700">
                  {r.valorCentavos !== null ? centavosParaReaisTexto(r.valorCentavos) : '—'}
                </td>
                <td className="py-1 align-top text-neutral-500">{r.profissionalResponsavel || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STATUS_PLANO_LABEL = { ATIVO: 'Ativo', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' } as const;

export function SecaoFinanceiroDoc({ planos }: { planos: DocumentoPlano[] }) {
  return (
    <Secao>
      <TituloSecao>Plano de tratamento e pagamentos</TituloSecao>
      {planos.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum plano de tratamento cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {planos.map((plano) => (
            <BlocoPlano key={plano.props.id} plano={plano} />
          ))}
        </div>
      )}
    </Secao>
  );
}

function BlocoPlano({ plano }: { plano: DocumentoPlano }) {
  const { props, resumo, planoDePagamento } = plano;
  const linhasPagamento = linhasPlanoDePagamento(planoDePagamento, props.condicoesDePagamento);
  const acordo = props.condicoesDePagamento.observacoes.trim();
  return (
    <div className="evitar-quebra flex flex-col gap-3 rounded-lg border border-neutral-200 p-3">
      <p className="text-sm font-semibold text-neutral-900">
        Plano de {formatarDataIso(props.criadoEm)} — {STATUS_PLANO_LABEL[props.status]}
        {props.validoAte ? ` · orçamento válido até ${formatarDataIso(props.validoAte)}` : ''}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">Dente / região</th>
              <th scope="col" className="py-1 pr-2 font-medium">Trabalho a executar</th>
              <th scope="col" className="py-1 pr-2 text-right font-medium">Valor</th>
              <th scope="col" className="py-1 font-medium">Concluído</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {props.itens.length === 0 && (
              <tr>
                <td colSpan={4} className="py-1.5 text-neutral-500">
                  Nenhum trabalho lançado.
                </td>
              </tr>
            )}
            {props.itens.map((item) => (
              <tr key={item.id}>
                <td className="py-1 pr-2 align-top text-neutral-700">
                  {textoDentesTratamento(item) || item.regiao || '—'}
                </td>
                <td className="py-1 pr-2 align-top text-neutral-800">
                  {item.trabalhoAExecutar}
                  {item.observacao && (
                    <span className="block text-xs text-neutral-500">{item.observacao}</span>
                  )}
                </td>
                <td className="py-1 pr-2 text-right align-top tabular-nums text-neutral-700">
                  {centavosParaReaisTexto(item.valorCentavos)}
                </td>
                <td className="py-1 align-top text-neutral-700">{item.concluido ? 'Sim' : 'Não'}</td>
              </tr>
            ))}
            {resumo.taxaEmergenciaCentavos > 0 && (
              <tr>
                <td className="py-1 pr-2 align-top text-neutral-700">—</td>
                <td className="py-1 pr-2 align-top text-neutral-800">Taxa de atendimento de emergência</td>
                <td className="py-1 pr-2 text-right align-top tabular-nums text-neutral-700">
                  {centavosParaReaisTexto(resumo.taxaEmergenciaCentavos)}
                </td>
                <td className="py-1 align-top text-neutral-700">—</td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-neutral-300">
            <tr>
              <td className="py-1 pr-2 text-xs font-semibold uppercase text-neutral-500" colSpan={2}>
                Total planejado
              </td>
              <td className="py-1 pr-2 text-right font-semibold tabular-nums">
                {centavosParaReaisTexto(resumo.valorTotalCentavos)}
              </td>
              <td className="py-1" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-neutral-500">Total pago:</span>{' '}
          <span className="font-medium">{centavosParaReaisTexto(resumo.valorPagoCentavos)}</span>
        </span>
        <span>
          <span className="text-neutral-500">Saldo devedor:</span>{' '}
          <span className="font-medium">{centavosParaReaisTexto(resumo.saldoDevedorCentavos)}</span>
        </span>
      </div>

      {props.pagamentos.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">Pagamentos efetuados</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm">
            {props.pagamentos.map((pg) => (
              <li key={pg.id} className="flex flex-wrap gap-x-2 text-neutral-700">
                <span className="font-medium text-neutral-900">
                  {centavosParaReaisTexto(pg.valorCentavos)}
                </span>
                <span>· {formatarDataIso(pg.data)}</span>
                {pg.metodo && <span>· {pg.metodo}</span>}
                {pg.observacao && <span className="text-neutral-500">· {pg.observacao}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase text-neutral-500">Plano de pagamento</p>
        {linhasPagamento.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {linhasPagamento.map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-neutral-600">Pagamento à vista do valor total.</p>
        )}
        {acordo && <p className="mt-1 text-sm text-neutral-700">{acordo}</p>}
        {props.emergencia && <p className="mt-1 text-sm font-medium text-neutral-800">{AVISO_TAXA_EMERGENCIA}</p>}
      </div>
    </div>
  );
}

export function SecaoEvolucaoDoc({ evolucoes }: { evolucoes: EvolucaoClinicaProps[] }) {
  return (
    <Secao>
      <TituloSecao>Evolução clínica</TituloSecao>
      {evolucoes.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma evolução registrada.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {evolucoes.map((ev) => (
            <li
              key={ev.id}
              className="evitar-quebra rounded-lg border border-neutral-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold text-neutral-900">{formatarDataIso(ev.data)}</span>
                <span className="text-xs text-neutral-500">
                  {ev.numeroDenteRelacionado ? `Dente ${ev.numeroDenteRelacionado} · ` : ''}
                  {ev.statusAssinaturaPaciente === 'CONFIRMADO' ? 'Confirmado pelo paciente' : 'Aguardando confirmação'}
                </span>
              </div>
              <p className="mt-1 text-neutral-800">{ev.tratamentosRealizados}</p>
              {ev.observacoes && <p className="mt-0.5 text-neutral-600">{ev.observacoes}</p>}
            </li>
          ))}
        </ol>
      )}
    </Secao>
  );
}

export function SecaoConsultasDoc({ consultas }: { consultas: ConsultaProps[] }) {
  return (
    <Secao>
      <TituloSecao>Histórico de consultas</TituloSecao>
      {consultas.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma consulta registrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Data</th>
                <th scope="col" className="py-1 pr-3 font-medium">Horário</th>
                <th scope="col" className="py-1 pr-3 font-medium">Duração</th>
                <th scope="col" className="py-1 pr-3 font-medium">Motivo</th>
                <th scope="col" className="py-1 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {consultas.map((c) => {
                const subdued = c.status === 'CANCELADA' || c.status === 'FALTOU';
                return (
                  <tr key={c.id} className={subdued ? 'text-neutral-400' : ''}>
                    <td className="py-1 pr-3 align-top">{formatarDataIso(c.data)}</td>
                    <td className="py-1 pr-3 align-top">{c.horario}</td>
                    <td className="py-1 pr-3 align-top">{c.duracaoMinutos} min</td>
                    <td className="py-1 pr-3 align-top">{c.motivo || '—'}</td>
                    <td className="py-1 align-top">{STATUS_CONSULTA_LABEL[c.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Secao>
  );
}

/** Área de assinaturas ao pé de um documento (pacote completo / ficha). */
export function AreaAssinaturas({ nomePaciente }: { nomePaciente: string }) {
  return (
    <div className="evitar-quebra mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2 print:grid-cols-2">
      <div className="border-t border-neutral-500 pt-2 text-center text-sm">
        <p className="font-medium">{nomePaciente}</p>
        <p className="text-neutral-500">Assinatura do paciente</p>
      </div>
      <div className="border-t border-neutral-500 pt-2 text-center text-sm">
        <p className="font-medium">{CONFIGURACAO_CLINICA.nomeProfissional}</p>
        <p className="text-neutral-500">{CONFIGURACAO_CLINICA.registroProfissional}</p>
      </div>
    </div>
  );
}
