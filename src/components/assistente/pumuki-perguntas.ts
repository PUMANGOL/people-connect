/** Perguntas frequentes de acesso rápido do Pumuki (página /assistente e bolha flutuante). */

/** Sugestões do ecrã inicial — as mais úteis no dia-a-dia. */
export const SUGESTOES_INICIAIS: string[] = [
  'Qual é o horário de trabalho?',
  'O que posso vestir à sexta-feira?',
  'Perdi o meu passe de acesso. O que faço?',
  'Quanto recebo de ajudas de custo numa viagem?',
  'Quem é o meu superior hierárquico?',
  'Que descontos tenho na Academia Pumangol?',
];

export interface CategoriaPerguntas {
  titulo: string;
  perguntas: string[];
}

export const PERGUNTAS_FREQUENTES: CategoriaPerguntas[] = [
  {
    titulo: 'Horário e assiduidade',
    perguntas: [
      'A que horas começa e termina o expediente?',
      'Quanto tempo tenho para almoçar?',
      'Posso tomar o pequeno-almoço no refeitório depois das 08h00?',
      'Posso fazer pausas para café?',
      'O horário das 08h00 às 17h00 aplica-se a quem trabalha por turnos?',
      'É obrigatório registar a entrada no biométrico?',
    ],
  },
  {
    titulo: 'Vestuário',
    perguntas: [
      'Posso ir de jeans para o escritório?',
      'Posso usar calções ou chinelos?',
      'Qual é a altura máxima do salto permitida?',
      'Que EPI tenho de usar para visitar um terminal ou um posto?',
      'Posso usar o telemóvel nas áreas operacionais?',
    ],
  },
  {
    titulo: 'Álcool e drogas',
    perguntas: [
      'Quando é feito o teste de alcoolemia?',
      'Qual é o limite de álcool permitido?',
      'O que acontece se o teste der positivo?',
      'Os medicamentos podem afectar o teste?',
    ],
  },
  {
    titulo: 'Viagens e reembolsos',
    perguntas: [
      'Em que classe viajo de avião?',
      'Qual é o valor máximo por refeição em viagem?',
      'Quanto recebo por quilómetro se usar o meu carro?',
      'Quem trata da reserva do hotel e das passagens?',
      'Qual é o limite de alojamento no Soyo ou nas outras províncias?',
      'Como peço o reembolso das despesas?',
      'Fiquei doente numa viagem de serviço. Quem paga?',
      'Onde envio a Declaração de Compromisso da Política de Viagem?',
    ],
  },
  {
    titulo: 'Passe de acesso',
    perguntas: [
      'Quanto custa a segunda via do passe?',
      'Posso emprestar o meu passe a um colega?',
      'Mudei de função. Tenho de actualizar o passe?',
      'O que faço ao passe quando saio da empresa?',
    ],
  },
  {
    titulo: 'Rede e tecnologia',
    perguntas: [
      'Posso usar o YouTube, o Instagram ou o Facebook no trabalho?',
    ],
  },
  {
    titulo: 'Benefícios e formação',
    perguntas: [
      'O que é o Catálogo de Benefícios?',
      'Posso pagar a formação da Academia Pumangol em prestações?',
      'Como me inscrevo numa formação?',
    ],
  },
  {
    titulo: 'Estrutura e contactos',
    perguntas: [
      'Quem é o CEO da Pumangol?',
      'Quem são os membros da Comissão Executiva?',
      'Quem é a Directora de Pessoas e Cultura?',
      'O que faz a Direcção de Riscos e Compliance?',
      'A quem reporta a Direcção de Riscos e Compliance?',
      'Quantos colaboradores tem a minha direcção?',
      'Quem trabalha no posto X?',
      'Qual é o e-mail ou o telefone profissional de [nome]?',
      'Qual é a morada da sede?',
    ],
  },
];

/**
 * Perguntas-modelo com uma parte a preencher (ex.: "posto X", "[nome]").
 * Devolve a posição do marcador para o seleccionar na caixa de texto, ou null.
 */
export function marcadorAPreencher(pergunta: string): { inicio: number; fim: number } | null {
  const m = /\[[^\]]+\]|\bX\b/.exec(pergunta);
  return m ? { inicio: m.index, fim: m.index + m[0].length } : null;
}
