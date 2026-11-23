import { mensagemAniversario } from '../../domain/value-objects/mensagem-aniversario.js';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Cake, Calendar, Gift, Plus, ShieldAlert, UserX } from 'lucide-react';
import type { CampanhaComemorativa } from '../../domain/entities/campanha-comemorativa.js';
import { STATUS_MENSAGEM_CORTESIA_LABEL } from '../../domain/entities/mensagem-cortesia.js';
import type { MensagemCortesiaParaRevisao, ResumoCortesiaDaClinicaResultado } from '../../application/use-cases/cortesia.js';
import { ErroDominio } from '../../domain/types.js';
import { Alert } from '../components/ui/alert.js';
import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Card } from '../components/ui/card.js';
import { Field } from '../components/ui/field.js';
import { Input } from '../components/ui/input.js';
import { Spinner } from '../components/ui/spinner.js';
import { formatarDataIso, hojeParaInputDate } from '../lib/formatadores.js';
import { useContainer } from '../providers/container-provider.js';

const FORMULARIO_CAMPANHA_VAZIO = { titulo: '', dataComemorativa: '', referenciaModeloMensagem: '' };

export function AniversariosPage() {
  const container = useContainer();
  const [resumo, setResumo] = useState<ResumoCortesiaDaClinicaResultado | null>(null);
  const [campanhas, setCampanhas] = useState<CampanhaComemorativa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [preparando, setPreparando] = useState(false);
  const [resultadoPreparo, setResultadoPreparo] = useState<string | null>(null);

  const [formCampanhaAberto, setFormCampanhaAberto] = useState(false);
  const [formCampanha, setFormCampanha] = useState(FORMULARIO_CAMPANHA_VAZIO);
  const [erroCampanha, setErroCampanha] = useState<string | null>(null);
  const [salvandoCampanha, setSalvandoCampanha] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    try {
      const hoje = hojeParaInputDate();
      const [resumoResultado, campanhasResultado] = await Promise.all([
        container.cortesia.resumo.executar(hoje),
        container.cortesia.listarCampanhas.executar(),
      ]);
      setResumo(resumoResultado);
      setCampanhas(campanhasResultado);
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [container]);

  useEffect(() => {
    void carregar();
  }, [carregar, tentativa]);

  function atualizar(): void {
    setTentativa((t) => t + 1);
  }

  async function prepararHoje(): Promise<void> {
    setPreparando(true);
    setResultadoPreparo(null);
    try {
      const r = await container.cortesia.prepararMensagensDoDia.executar(hojeParaInputDate(), { incluirAniversarios: !container.sincronizacaoNucleo });
      setResultadoPreparo(`${r.criadas} nova(s) preparada(s), ${r.jaExistentes} já existiam.`);
      atualizar();
    } finally {
      setPreparando(false);
    }
  }

  async function salvarCampanha(): Promise<void> {
    setErroCampanha(null);
    setSalvandoCampanha(true);
    try {
      await container.cortesia.criarCampanha.executar(formCampanha);
      setFormCampanha(FORMULARIO_CAMPANHA_VAZIO);
      setFormCampanhaAberto(false);
      atualizar();
    } catch (e) {
      setErroCampanha(e instanceof ErroDominio ? e.message : 'Não foi possível criar a campanha.');
    } finally {
      setSalvandoCampanha(false);
    }
  }

  async function alternarCampanha(campanha: CampanhaComemorativa): Promise<void> {
    if (campanha.ativa) await container.cortesia.desativarCampanha.executar(campanha.id);
    else await container.cortesia.ativarCampanha.executar(campanha.id);
    atualizar();
  }

  async function revisarMensagem(mensagem: MensagemCortesiaParaRevisao): Promise<void> {
    await container.cortesia.marcarRevisada.executar(mensagem.id);
    atualizar();
  }

  async function dispensarMensagem(mensagem: MensagemCortesiaParaRevisao): Promise<void> {
    await container.cortesia.dispensarMensagem.executar(mensagem.id);
    atualizar();
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Aniversários e cortesia</h1>
        <p className="text-sm text-neutral-600">
          {container.sincronizacaoNucleo ? 'Felicitações de aniversário são enviadas automaticamente pelo WhatsApp no próprio dia, entre 9h e 17h (horário de Brasília), somente com autorização. Mantenha o servidor e o WAHA ligados. Campanhas continuam manuais.' : 'Modo local: as mensagens continuam manuais. O envio automático exige o servidor da clínica.'}
        </p>
      </div>

      {container.sincronizacaoNucleo && <Link className="self-start text-sm font-medium underline" to="/configuracoes/whatsapp-automatico">Acompanhar felicitações e outros envios</Link>}
      {container.sincronizacaoNucleo && <details className="text-xs text-neutral-500"><summary className="cursor-pointer">Sobre as mensagens antigas</summary><p>Felicitações já revisadas manualmente ou dispensadas neste ano não serão enviadas automaticamente. Isso evita repetir uma mensagem que pode já ter sido enviada pela equipe.</p></details>}

      {erro && (
        <Alert tone="warning" title="Não foi possível carregar">
          <Button variant="secondary" onClick={atualizar} className="text-xs">Tentar de novo</Button>
        </Alert>
      )}

      {carregando && !resumo ? (
        <div className="flex justify-center py-10">
          <Spinner label="Carregando…" />
        </div>
      ) : (
        resumo && (
          <>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Cake className="h-4 w-4" aria-hidden="true" /> Aniversariantes
                </h2>
                <Button variant="secondary" onClick={() => void prepararHoje()} loading={preparando} className="text-xs">
                  {container.sincronizacaoNucleo ? 'Preparar campanhas de hoje' : 'Preparar mensagens de hoje'}
                </Button>
              </div>
              {resultadoPreparo && <Alert tone="brand">{resultadoPreparo}</Alert>}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Hoje ({resumo.aniversarioHoje.length})</p>
                  {resumo.aniversarioHoje.length === 0 ? (
                    <p className="text-sm text-neutral-500">Ninguém.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {resumo.aniversarioHoje.map((p) => (
                        <li key={p.pacienteId} className="text-sm">
                          <Link to={`/pacientes/${p.pacienteId}/dados`} className="text-neutral-800 hover:text-brand-700">
                            {p.nomeCompleto}
                          </Link>{' '}
                          <span className="text-neutral-400">— completa {p.idadeQueVaiCompletar}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Próximos 7 dias ({resumo.aniversarioProximos7Dias.length})</p>
                  {resumo.aniversarioProximos7Dias.length === 0 ? (
                    <p className="text-sm text-neutral-500">Ninguém.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {resumo.aniversarioProximos7Dias.map((p) => (
                        <li key={p.pacienteId} className="text-sm">
                          <Link to={`/pacientes/${p.pacienteId}/dados`} className="text-neutral-800 hover:text-brand-700">
                            {p.nomeCompleto}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Próximos 30 dias ({resumo.aniversarioProximos30Dias.length})</p>
                  {resumo.aniversarioProximos30Dias.length === 0 ? (
                    <p className="text-sm text-neutral-500">Ninguém.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {resumo.aniversarioProximos30Dias.map((p) => (
                        <li key={p.pacienteId} className="text-sm">
                          <Link to={`/pacientes/${p.pacienteId}/dados`} className="text-neutral-800 hover:text-brand-700">
                            {p.nomeCompleto}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>

            <Card className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Pendências de cadastro
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Sem data de nascimento ({resumo.semDataNascimento.length})</p>
                  <ul className="flex flex-col gap-1">
                    {resumo.semDataNascimento.map((p) => (
                      <li key={p.pacienteId} className="text-sm">
                        <Link to={`/pacientes/${p.pacienteId}/dados`} className="text-neutral-800 hover:text-brand-700">
                          {p.nomeCompleto}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Sem consentimento de cortesia ({resumo.semConsentimento.length})</p>
                  <ul className="flex flex-col gap-1">
                    {resumo.semConsentimento.map((p) => (
                      <li key={p.pacienteId} className="text-sm">
                        <Link to={`/pacientes/${p.pacienteId}/dados`} className="text-neutral-800 hover:text-brand-700">
                          {p.nomeCompleto}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                <UserX className="h-3.5 w-3.5" aria-hidden="true" /> Pacientes arquivados ou sem número de WhatsApp válido nunca aparecem aqui.
              </p>
            </Card>

            <Card className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                <Gift className="h-4 w-4" aria-hidden="true" /> Histórico de preparo manual ({resumo.mensagensDoAno.length})
              </h2>
              {resumo.mensagensDoAno.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhum preparo manual registrado neste ano.</p>
              ) : (
                <div className="flex flex-col">
                  {resumo.mensagensDoAno.map((m) => {
                    const bloqueada = m.status === 'PREPARADA' && !m.aindaElegivelParaEnvio;
                    return (
                      <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2 last:border-b-0">
                        <span className="text-sm text-neutral-700">
                          {m.tipo === 'ANIVERSARIO' ? 'Aniversário' : 'Campanha'} — {formatarDataIso(m.dataAgendada)} — {m.numeroMascarado}
                        </span>
                        <div className="flex items-center gap-2">
                          {m.tipo === 'ANIVERSARIO' && !container.sincronizacaoNucleo && <details className="max-w-md"><summary>Ver mensagem de aniversário</summary><p className="whitespace-pre-wrap text-sm">{mensagemAniversario(m.nomePaciente ?? '')}</p><Button variant="secondary" onClick={() => void navigator.clipboard.writeText(mensagemAniversario(m.nomePaciente ?? ''))}>Copiar mensagem</Button></details>}
                          {bloqueada && (
                            <Badge tone="danger">
                              <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Não enviar — consentimento não está mais autorizado
                            </Badge>
                          )}
                          {m.tipo === 'ANIVERSARIO' && container.sincronizacaoNucleo && <span className="text-xs text-neutral-500">Envio controlado pela fila automática</span>}
                          <Badge tone={m.status === 'DISPENSADA' ? 'neutral' : m.status === 'REVISADA_MANUALMENTE' ? 'success' : 'warning'}>
                            {m.tipo === 'ANIVERSARIO' && container.sincronizacaoNucleo && m.status === 'PREPARADA' ? 'Preparo anterior — consulte os envios' : STATUS_MENSAGEM_CORTESIA_LABEL[m.status]}
                          </Badge>
                          {m.status === 'PREPARADA' && !(m.tipo === 'ANIVERSARIO' && container.sincronizacaoNucleo) && (
                            <>
                              {!bloqueada && (
                                <Button variant="secondary" className="text-xs" onClick={() => void revisarMensagem(m)}>
                                  Marcar revisada
                                </Button>
                              )}
                              <Button variant="secondary" className="text-xs" onClick={() => void dispensarMensagem(m)}>
                                Dispensar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                  <Calendar className="h-4 w-4" aria-hidden="true" /> Campanhas comemorativas
                </h2>
                <Button onClick={() => setFormCampanhaAberto(true)} className="text-xs">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Nova campanha
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                Nunca enviada automaticamente por um feriado embutido no sistema — só existe se for cadastrada e ativada
                aqui. Modelo de mensagem ainda precisa de aprovação própria na Meta antes de qualquer envio real.
              </p>

              {formCampanhaAberto && (
                <div className="flex flex-col gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 dark:bg-brand-900/10">
                  <Field label="Título">
                    <Input value={formCampanha.titulo} onChange={(e) => setFormCampanha((v) => ({ ...v, titulo: e.target.value }))} />
                  </Field>
                  <Field label="Data comemorativa (MM-DD)">
                    <Input
                      value={formCampanha.dataComemorativa}
                      onChange={(e) => setFormCampanha((v) => ({ ...v, dataComemorativa: e.target.value }))}
                      placeholder="12-25"
                    />
                  </Field>
                  <Field label="Referência do modelo de mensagem">
                    <Input
                      value={formCampanha.referenciaModeloMensagem}
                      onChange={(e) => setFormCampanha((v) => ({ ...v, referenciaModeloMensagem: e.target.value }))}
                      placeholder="Ex.: modelo-dia-das-maes"
                    />
                  </Field>
                  {erroCampanha && <Alert tone="danger">{erroCampanha}</Alert>}
                  <div className="flex gap-2">
                    <Button onClick={() => void salvarCampanha()} loading={salvandoCampanha}>
                      Salvar
                    </Button>
                    <Button variant="secondary" onClick={() => setFormCampanhaAberto(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {campanhas.length === 0 ? (
                <p className="text-sm text-neutral-500">Nenhuma campanha cadastrada ainda.</p>
              ) : (
                <div className="flex flex-col">
                  {campanhas.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-2 last:border-b-0">
                      <span className="text-sm text-neutral-700">
                        {c.toSnapshot().titulo} <span className="text-neutral-400">— {c.dataComemorativa}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge tone={c.ativa ? 'success' : 'neutral'}>{c.ativa ? 'Ativa' : 'Desativada'}</Badge>
                        <Button variant="secondary" className="text-xs" onClick={() => void alternarCampanha(c)}>
                          {c.ativa ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )
      )}
    </div>
  );
}
