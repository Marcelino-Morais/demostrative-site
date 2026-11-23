import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MODULOS_TUTORIAL, urlEtapaTutorial } from '../features/tutorial/conteudo-tutorial.js';
import { lerProgressoTutorial, salvarProgressoTutorial } from '../features/tutorial/progresso-tutorial.js';
import { Card } from '../components/ui/card.js';
import { buttonClassName } from '../components/ui/button.js';
import { Field } from '../components/ui/field.js';
import { Select } from '../components/ui/input.js';
import { useContainer } from '../providers/container-provider.js';

export function TutorialPage() {
 const container = useContainer();
 const [pacientes, setPacientes] = useState<{ id: string; nome: string }[]>([]);
 const [paciente, setPaciente] = useState('');
 const [erro, setErro] = useState(false);
 const [carregando, setCarregando] = useState(true);
 const progresso = lerProgressoTutorial();
 useEffect(() => {
  salvarProgressoTutorial({ ...lerProgressoTutorial(), apresentado: true });
  let cancelado = false;
  container.pacientes.listar.executar().then(lista => {
   if (!cancelado) setPacientes(lista.map(p => ({ id: p.id, nome: p.nomeCompleto })));
  }).catch(() => { if (!cancelado) setErro(true); }).finally(() => { if (!cancelado) setCarregando(false); });
  return () => { cancelado = true; };
 }, [container]);
 return <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-6">
  <header><Link to="/configuracoes" className="text-sm underline">Voltar às configurações</Link><h1 className="mt-3 text-xl font-semibold">Visitas guiadas</h1><p className="mt-2 text-sm text-neutral-600">Escolha um assunto. A visita abre as próprias telas e destaca onde clicar, com explicações curtas e os botões Próximo, Voltar e Pular. Na primeira utilização, os guias começam automaticamente. Depois de pular ou concluir, eles não se repetem neste navegador, mas você pode refazer aqui. Não há perguntas ou avaliações.</p></header>
  <Card className="flex flex-col gap-3"><h2 className="font-semibold">Comece por aqui</h2><p className="text-sm">Conheça o painel, o cadastro, a agenda e as configurações. A visita não cria dados nem envia mensagens.</p><Link className={buttonClassName('primary', 'self-start')} to={urlEtapaTutorial('inicio')}>Iniciar visita geral</Link></Card>
  <Card className="flex flex-col gap-3"><h2 className="font-semibold">Guias dentro da ficha</h2>
   <p className="text-sm">Para anamnese, dentes, pagamentos, evolução, documentos e exames, escolha uma ficha existente. Nada será alterado nela durante a visita.</p>
   <Field label="Paciente para a visita"><Select value={paciente} disabled={carregando || pacientes.length === 0} onChange={e => setPaciente(e.target.value)}><option value="">{carregando ? 'Carregando fichas…' : 'Escolha um paciente'}</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></Field>
   {!carregando && !erro && pacientes.length === 0 && <p className="text-sm text-neutral-600">Ainda não há pacientes. Comece pelo guia de cadastro. Os guias da ficha ficam disponíveis depois que houver um cadastro.</p>}
   {erro && <p role="alert" className="text-sm text-danger-700">Não foi possível carregar as fichas. Recarregue a página para tentar novamente.</p>}
  </Card>
  <h2 className="text-lg font-semibold">Cenários do dia a dia</h2>
  <p className="text-sm text-neutral-600">Siga a sequência de uma situação completa. Comece por Receber o primeiro paciente; após preencher e salvar o cadastro, o guia continua na ficha criada.</p>
  <div className="grid gap-4 sm:grid-cols-2">{MODULOS_TUTORIAL.filter(m => m.cenario).map(m => <Card key={m.id} className="flex flex-col gap-3"><h3 className="font-semibold">{m.nome}</h3><p className="text-sm text-neutral-500">{m.etapas.length} passos</p>{m.paciente && !paciente ? <p className="text-sm">Escolha um paciente acima para iniciar.</p> : <Link className={buttonClassName('secondary', 'self-start')} to={urlEtapaTutorial(m.id, 0, paciente)}>Iniciar cenário: {m.nome}</Link>}</Card>)}</div>
  <h2 className="text-lg font-semibold">Guias por recurso</h2>
  <div className="grid gap-4 sm:grid-cols-2">{MODULOS_TUTORIAL.filter(m => m.id !== 'inicio' && !m.cenario).map(m => <Card key={m.id} className="flex flex-col gap-3"><h2 className="font-semibold">{m.nome}</h2><p className="text-sm text-neutral-500">{m.etapas.length} passos{progresso.concluidos.includes(m.id) ? ' · Já visitado; pode repetir' : ''}</p>{m.paciente && !paciente ? <p className="text-sm text-neutral-600">Escolha um paciente acima para iniciar.</p> : <Link className={buttonClassName('secondary', 'self-start')} to={urlEtapaTutorial(m.id, 0, paciente)}>Iniciar: {m.nome}</Link>}</Card>)}</div>
 </div>;
}
