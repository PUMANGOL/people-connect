/**
 * Texto inicial do email da carta de oferta.
 * O admin edita este HTML antes do envio; o anexo é um PDF carregado à parte.
 */

export function dataPorExtenso(iso: string | null): string {
  if (!iso) return 'a definir';
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const data = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return data.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function texto(value: string | null | undefined, vazio: string): string {
  const limpo = value?.trim();
  return limpo ? limpo : vazio;
}

function escapar(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function assuntoCartaOferta(nome: string): string {
  return `Carta de oferta — ${nome.trim()}`;
}

export function corpoEmailInicial(dados: {
  nome: string;
  funcao: string | null;
  empresa: string | null;
  validade: string | null;
}): string {
  const funcao = texto(dados.funcao, 'a função aprovada');
  const empresa = texto(dados.empresa, 'Pumangol');
  const validade = dataPorExtenso(dados.validade);
  const paragrafos = [
    `Olá ${dados.nome.trim()},`,
    `A Pumangol tem o prazer de lhe apresentar a carta de oferta para a função de ${funcao}, na ${empresa}.`,
    `A carta segue em anexo. A oferta é válida até ${validade}. Pedimos que responda dentro desse prazo, aceitando ou recusando.`,
    'A resposta pode ser dada por este mesmo email. A Direcção de Pessoas e Cultura regista a decisão no processo de admissão.',
  ];
  return paragrafos.map((paragrafo) => `<p>${escapar(paragrafo)}</p>`).join('');
}
