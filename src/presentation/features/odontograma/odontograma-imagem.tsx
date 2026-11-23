import { useState } from 'react';
import type { EstadoDoDente } from '../../../domain/entities/registro-dental.js';
import {
  CONDICAO_DENTAL_LABEL,
  TIPO_REGISTRO_DENTAL_LABEL,
  TOM_POR_CONDICAO,
  resumoRapidoDoDente,
} from '../../../domain/entities/registro-dental.js';
import type { NumeroDente } from '../../../domain/value-objects/numeracao-dental.js';
import { cn } from '../../lib/cn.js';
import { formatarDataIso } from '../../lib/formatadores.js';
import { descricaoAcessivel } from './dente-a11y.js';
import { ARCADA_SUPERIOR, ARCADA_INFERIOR } from '../../../domain/value-objects/numeracao-dental.js';
import {
  CLASSES_OVERLAY_COM_REGISTRO,
  CLASSES_OVERLAY_POR_TOM,
  CLASSES_OVERLAY_SELECIONADO,
  CLASSES_PONTO_POR_TOM,
} from './tom-dental-classes.js';

export interface OdontogramaImagemProps {
  estados: Map<NumeroDente, EstadoDoDente>;
  planejamentos?: Map<NumeroDente, string[]>;
  denteSelecionado: NumeroDente | null;
  onSelecionarDente: (numero: NumeroDente) => void;
}

/** Painel de resumo rápido — mostra o dente sob o mouse/teclado, ou o selecionado. */
function ResumoDente({ numero, estado }: { numero: NumeroDente; estado: EstadoDoDente | undefined }) {
  const resumo = resumoRapidoDoDente(numero, estado);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-neutral-900">
        Dente {resumo.numeroDente}{' '}
        <span className="font-normal text-neutral-500">· {resumo.nomePopular}</span>
      </p>
      {resumo.condicaoAtual && (
        <p className="text-neutral-700">
          Condição atual: <strong>{CONDICAO_DENTAL_LABEL[resumo.condicaoAtual]}</strong>
        </p>
      )}
      {resumo.ultimoRegistro ? (
        <>
          <p className="text-neutral-600">
            Último: {TIPO_REGISTRO_DENTAL_LABEL[resumo.ultimoRegistro.tipo]} ·{' '}
            {formatarDataIso(resumo.ultimoRegistro.data)}
          </p>
          <p className="text-neutral-600">{resumo.ultimoRegistro.profissionalResponsavel}</p>
          {resumo.ultimoRegistro.observacao && (
            <p className="mt-1 line-clamp-2 text-neutral-600">
              {resumo.ultimoRegistro.observacao}
            </p>
          )}
          <p className="mt-1 text-neutral-400">
            {resumo.totalDeRegistros} registro{resumo.totalDeRegistros !== 1 ? 's' : ''} no histórico
          </p>
        </>
      ) : (
        <p className="text-neutral-500">Sem registros ainda. Clique para adicionar.</p>
      )}
    </div>
  );
}

/** Cada dente usa um recorte da referência original, com numeração FDI preservada.
 * Os mesmos botões acessíveis continuam abrindo o histórico existente. */
export function OdontogramaImagem({ estados, planejamentos, denteSelecionado, onSelecionarDente }: OdontogramaImagemProps) {
  const [denteEmFoco, setDenteEmFoco] = useState<NumeroDente | null>(null);
  const denteResumo = denteEmFoco ?? denteSelecionado;

  const sair = (numero: NumeroDente) =>
    setDenteEmFoco((atual) => (atual === numero ? null : atual));

  return (
    <div className="odontograma-dentes flex flex-col gap-3">
      <div className="grid min-w-0 flex-1 gap-x-3 gap-y-3 xl:grid-cols-2">
        <p className="col-span-full text-xs text-neutral-500">Toque no dente para registrar ou planejar o tratamento.</p>
        {[
          { titulo: 'Superior direito · 18 a 11', dentes: ARCADA_SUPERIOR.slice(0, 8) },
          { titulo: 'Superior esquerdo · 21 a 28', dentes: ARCADA_SUPERIOR.slice(8) },
          { titulo: 'Inferior direito · 48 a 41', dentes: ARCADA_INFERIOR.slice(0, 8) },
          { titulo: 'Inferior esquerdo · 31 a 38', dentes: ARCADA_INFERIOR.slice(8) },
        ].map(grupo => <section key={grupo.titulo} aria-label={grupo.titulo}>
          <h3 className="mb-1.5 text-xs font-semibold text-neutral-700">{grupo.titulo}</h3>
          <div role="group" aria-label={`Dentes: ${grupo.titulo}`} className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {grupo.dentes.map(numero => {
              const estado = estados.get(numero);
              const temRegistro = Boolean(estado && estado.totalDeRegistros > 0);
              const tom = estado?.condicaoAtual ? TOM_POR_CONDICAO[estado.condicaoAtual] : null;
              const selecionado = denteSelecionado === numero;
              return <button key={numero} type="button"
                onClick={() => onSelecionarDente(numero)}
                onMouseEnter={() => setDenteEmFoco(numero)} onMouseLeave={() => sair(numero)}
                onFocus={() => setDenteEmFoco(numero)} onBlur={() => sair(numero)}
                aria-pressed={selecionado} aria-label={descricaoAcessivel(numero, estado)}
                className={cn('relative flex min-h-28 flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors hover:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
                  temRegistro ? tom ? CLASSES_OVERLAY_POR_TOM[tom] : CLASSES_OVERLAY_COM_REGISTRO : 'border-neutral-300 bg-surface',
                  selecionado && CLASSES_OVERLAY_SELECIONADO)}>
                <span className="font-semibold text-neutral-900">{numero}</span>
                <img src={`${import.meta.env.BASE_URL}odontograma/dente-${numero}.png`} alt="" aria-hidden="true" draggable={false} className="h-24 w-full rounded object-contain" />
                {planejamentos?.has(numero) && <span className="text-[10px] font-semibold text-brand-700" title={planejamentos.get(numero)?.join('; ')}>Planejado: {planejamentos.get(numero)?.join('; ')}</span>}
                {temRegistro && <span aria-hidden="true" className={cn('absolute right-1 top-1 h-2 w-2 rounded-full',tom ? CLASSES_PONTO_POR_TOM[tom] : 'bg-brand-600')} />}
                {selecionado && <span className="text-[10px] font-semibold text-brand-800 dark:text-brand-200">Selecionado</span>}
              </button>;
            })}
          </div>
        </section>)}
      </div>

      <div
        className="w-full shrink-0 rounded-lg border border-neutral-200 bg-surface p-3 text-xs"
        aria-live="polite"
      >
        {denteResumo ? (
          <ResumoDente numero={denteResumo} estado={estados.get(denteResumo)} />
        ) : (
          <p className="text-neutral-500">
            Passe o mouse ou use Tab por cima de um dente para ver o resumo. Clique para abrir o histórico completo e
            registrar um procedimento, observação ou condição.
          </p>
        )}
      </div>
    </div>
  );
}
