export const TEMA_KEY = 'pumangol-tema';

export type Tema = 'claro' | 'escuro';

export function temaActual(): Tema {
  if (typeof document === 'undefined') return 'claro';
  return document.documentElement.classList.contains('dark') ? 'escuro' : 'claro';
}

export function aplicarTema(tema: Tema) {
  document.documentElement.classList.toggle('dark', tema === 'escuro');
  try {
    localStorage.setItem(TEMA_KEY, tema);
  } catch {
    /* armazenamento indisponível */
  }
}

export function alternarTema(): Tema {
  const seguinte: Tema = temaActual() === 'escuro' ? 'claro' : 'escuro';
  aplicarTema(seguinte);
  return seguinte;
}
