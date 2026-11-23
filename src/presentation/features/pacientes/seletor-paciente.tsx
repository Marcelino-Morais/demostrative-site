import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { Paciente } from '../../../domain/entities/paciente.js';
import { ErroApi } from '../../../application/ports/api-client.js';
import { Input } from '../../components/ui/input.js';
import { cn } from '../../lib/cn.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { useContainer } from '../../providers/container-provider.js';
import { filtrarPacientesParaSelecao, moverDestaque } from './seletor-paciente-filtro.js';

/**
 * Escolha de paciente com busca ao vivo — equivalente web do
 * "Selecione um paciente" do WIM Dental: campo de busca que filtra a
 * lista a cada tecla, linhas com Nome / Nascimento / Celular, clique
 * (ou Enter) seleciona. Acrescenta navegação por ↑/↓ e mantém o
 * paciente escolhido visível com opção de trocar. Esc continua
 * fechando o diálogo pai (comportamento padrão do Radix), como no WIM.
 *
 * Busca por CPF/RG: o filtro local (`filtrarPacientesParaSelecao`) só
 * compara nome/nascimento/celular — em modo com servidor o CPF/RG da
 * lista já chega mascarado, então dígitos suficientes (3+) disparam,
 * com debounce, o MESMO caso de uso `ListarPacientes` já usado em
 * outras telas (busca de verdade no servidor; nunca reimplementa
 * identidade aqui). Em modo 100% local (`!sincronizacaoNucleo`) nada
 * disso é chamado — o CPF real já está em claro na lista local, o
 * filtro local já resolve sozinho.
 */
export function SeletorPaciente({
  pacientes,
  pacienteId,
  onSelecionar,
  autoFocus = false,
}: {
  pacientes: readonly Paciente[];
  pacienteId: string;
  onSelecionar: (pacienteId: string) => void;
  autoFocus?: boolean;
}) {
  const container = useContainer();
  const [termo, setTermo] = useState('');
  const [destaque, setDestaque] = useState(-1);
  const [idsPorDocumento, setIdsPorDocumento] = useState<ReadonlySet<string>>(new Set());
  const [buscaDocumentoFalhou, setBuscaDocumentoFalhou] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaId = useId();

  const { visiveis: visiveisLocal, total } = useMemo(
    () => filtrarPacientesParaSelecao(pacientes, termo),
    [pacientes, termo],
  );
  // Une o filtro local com os ids que só a busca por documento no
  // servidor encontrou — mesmos pacientes já carregados, nunca um
  // paciente novo "inventado" fora da lista recebida por prop.
  const visiveis = useMemo(() => {
    if (idsPorDocumento.size === 0) return visiveisLocal;
    const idsJaVisiveis = new Set(visiveisLocal.map((p) => p.id));
    const extras = pacientes.filter((p) => idsPorDocumento.has(p.id) && !idsJaVisiveis.has(p.id));
    if (extras.length === 0) return visiveisLocal;
    return [...visiveisLocal, ...extras].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  }, [visiveisLocal, idsPorDocumento, pacientes]);
  const selecionado = pacientes.find((p) => p.id === pacienteId);

  // Busca por documento no servidor — só quando faz sentido (3+ dígitos,
  // modo com servidor) e com debounce + proteção contra resposta
  // obsoleta (um termo digitado depois nunca é sobrescrito por uma
  // resposta de uma busca anterior que chegou atrasada).
  useEffect(() => {
    const digitos = termo.replace(/\D/g, '');
    if (!container.sincronizacaoNucleo || digitos.length < 3) {
      setIdsPorDocumento(new Set());
      setBuscaDocumentoFalhou(false);
      return;
    }
    let cancelado = false;
    const temporizador = setTimeout(() => {
      container.pacientes.listar
        .executar(false, termo)
        .then((encontrados) => {
          if (cancelado) return;
          setBuscaDocumentoFalhou(false);
          setIdsPorDocumento(new Set(encontrados.map((p) => p.id)));
        })
        .catch((erroCapturado) => {
          if (cancelado) return;
          // Sessão expirada/indisponível: nunca mantém um resultado
          // antigo de documento visível — só o filtro local continua.
          setIdsPorDocumento(new Set());
          setBuscaDocumentoFalhou(!(erroCapturado instanceof ErroApi && erroCapturado.status === 0));
        });
    }, 200);
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [container, termo]);

  // Cada novo termo destaca o primeiro resultado — Enter logo após digitar já escolhe.
  useEffect(() => {
    setDestaque(termo.trim() && visiveis.length > 0 ? 0 : -1);
  }, [termo, visiveis.length]);

  function escolher(paciente: Paciente): void {
    onSelecionar(paciente.id);
    setTermo('');
  }

  function trocar(): void {
    onSelecionar('');
    // Espera o campo de busca voltar a ser renderizado antes de focar.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque((atual) => moverDestaque(atual, e.key === 'ArrowDown' ? 1 : -1, visiveis.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const alvo = visiveis[destaque];
      if (alvo) escolher(alvo);
    }
  }

  if (selecionado) {
    const snap = selecionado.toSnapshot();
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-brand-600 bg-surface px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-neutral-900">{snap.nomeCompleto}</p>
          <p className="text-xs text-neutral-500">
            {formatarDataIso(snap.dataNascimento)} · {snap.celular ?? '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={trocar}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Trocar
        </button>
      </div>
    );
  }

  const idOpcao = (indice: number) => `${listaId}-opcao-${indice}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite nome, celular ou CPF para buscar…"
          className="pl-9"
          role="combobox"
          aria-expanded="true"
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={destaque >= 0 ? idOpcao(destaque) : undefined}
          aria-label="Buscar paciente"
        />
      </div>
      <ul
        id={listaId}
        role="listbox"
        aria-label="Pacientes"
        className="max-h-56 overflow-y-auto rounded-md border border-neutral-200"
      >
        {visiveis.length === 0 ? (
          <li className="px-3 py-3 text-sm text-neutral-500">Nenhum paciente corresponde a “{termo.trim()}”.</li>
        ) : (
          visiveis.map((p, indice) => {
            const snap = p.toSnapshot();
            return (
              <li
                key={p.id}
                id={idOpcao(indice)}
                role="option"
                aria-selected={indice === destaque}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(p)}
                onMouseEnter={() => setDestaque(indice)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm',
                  indice === destaque ? 'bg-brand-50 text-brand-900' : 'text-neutral-800',
                )}
              >
                <span className="truncate font-medium">{snap.nomeCompleto}</span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {formatarDataIso(snap.dataNascimento)} · {snap.celular ?? '—'}
                </span>
              </li>
            );
          })
        )}
      </ul>
      {total > visiveis.length && (
        <p className="text-xs text-neutral-500">
          Mostrando {visiveis.length} de {total} — continue digitando para refinar.
        </p>
      )}
      {buscaDocumentoFalhou && (
        <p className="text-xs text-warning-700 dark:text-warning-500">
          Não foi possível buscar por CPF/RG agora — a busca por nome/celular continua funcionando.
        </p>
      )}
    </div>
  );
}
