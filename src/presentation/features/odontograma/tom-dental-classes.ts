import type { TomCondicao } from '../../../domain/entities/registro-dental.js';

/**
 * Só a camada de apresentação sabe traduzir um "tom" semântico
 * (`TomCondicao`, decidido no domínio) em classes Tailwind — mantém o
 * domínio livre de qualquer conhecimento de CSS/design system.
 */
export const CLASSES_POR_TOM: Record<TomCondicao, string> = {
  neutral: 'border-neutral-300 bg-neutral-100 text-neutral-600',
  success: 'border-success-300 bg-success-100 text-success-800 dark:border-success-700 dark:bg-success-900/40 dark:text-success-300',
  warning: 'border-warning-300 bg-warning-100 text-warning-800 dark:border-warning-700 dark:bg-warning-900/40 dark:text-warning-300',
  danger: 'border-danger-300 bg-danger-100 text-danger-800 dark:border-danger-700 dark:bg-danger-900/40 dark:text-danger-300',
  info: 'border-info-300 bg-info-100 text-info-800 dark:border-info-700 dark:bg-info-900/40 dark:text-info-300',
  tooth: 'border-tooth-300 bg-tooth-100 text-tooth-800 dark:border-tooth-700 dark:bg-tooth-900/40 dark:text-tooth-300',
};

export const CLASSES_SEM_REGISTRO = 'border-neutral-200 bg-surface text-neutral-500';

export const CLASSES_SELECIONADO = 'ring-2 ring-brand-600 ring-offset-1 ring-offset-surface';

/**
 * Preenchimento translúcido da ÁREA CLICÁVEL de um dente COM histórico
 * sobre a imagem do odontograma, por tom da condição atual. Fica sutil
 * de propósito — o resumo ao lado carrega a informação; a área só
 * sinaliza "este dente tem registro" e a gravidade.
 */
export const CLASSES_OVERLAY_POR_TOM: Record<TomCondicao, string> = {
  neutral: 'bg-neutral-500/20 border-neutral-600/60',
  success: 'bg-success-500/20 border-success-600/60',
  warning: 'bg-warning-500/25 border-warning-600/70',
  danger: 'bg-danger-500/25 border-danger-600/70',
  info: 'bg-info-500/20 border-info-600/60',
  tooth: 'bg-tooth-500/25 border-tooth-600/70',
};

/** Área de um dente com histórico mas sem condição atual definida (só observações). */
export const CLASSES_OVERLAY_COM_REGISTRO = 'bg-brand-500/15 border-brand-600/50';

/** Área selecionada (histórico completo aberto para este dente). */
export const CLASSES_OVERLAY_SELECIONADO =
  'ring-2 ring-brand-600 ring-offset-1 ring-offset-transparent border-brand-600 bg-brand-500/25';

/** Cor sólida do pontinho que marca um dente com histórico, por tom. */
export const CLASSES_PONTO_POR_TOM: Record<TomCondicao, string> = {
  neutral: 'bg-neutral-500',
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  danger: 'bg-danger-600',
  info: 'bg-info-600',
  tooth: 'bg-tooth-600',
};
