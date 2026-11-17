/**
 * Motor do processo de admissão (corte 1).
 * As 22 etapas seguem a ordem do fluxograma. Referências e exame
 * ainda não correm em paralelo com a documentação: isso entra no corte das verificações.
 * O colaborador e o trilho de 90 dias só são criados no fecho, num corte seguinte.
 */

export type EstadoAdmissao =
  | 'rascunho'
  | 'em_aprovacao'
  | 'oferta_enviada'
  | 'oferta_aceite'
  | 'documentacao_pendente'
  | 'em_verificacoes'
  | 'em_contratacao'
  | 'em_cadastro'
  | 'pre_onboarding'
  | 'pronto_para_entrada'
  | 'transferido_onboarding'
  | 'cancelado';

export type EstadoEtapaAdmissao = 'pendente' | 'em_curso' | 'concluida' | 'rejeitada';
export type SemaforoAdmissao = 'verde' | 'amarelo' | 'vermelho';
export type AccaoNao = 'cancelar' | 'recuar' | 'bloquear';
export type ResultadoEtapa = 'sim' | 'nao' | 'concluida';

export interface EtapaDef {
  codigo: string;
  ordem: number;
  fase: string;
  nome: string;
  responsavel: string;
  descricao: string;
  decisao: boolean;
  /** Estado global enquanto esta etapa é a actual. */
  estado: EstadoAdmissao;
  simEtiqueta: string;
  naoEtiqueta: string | null;
  proxima: string | null;
  accaoNao: AccaoNao | null;
  recuarPara: string | null;
}

export const ESTADO_ADMISSAO_LABEL: Record<EstadoAdmissao, string> = {
  rascunho: 'Rascunho',
  em_aprovacao: 'Em aprovação',
  oferta_enviada: 'Oferta enviada',
  oferta_aceite: 'Oferta aceite',
  documentacao_pendente: 'Documentação pendente',
  em_verificacoes: 'Em verificações',
  em_contratacao: 'Em contratação',
  em_cadastro: 'Em cadastro',
  pre_onboarding: 'Pré-onboarding',
  pronto_para_entrada: 'Pronto para entrada',
  transferido_onboarding: 'Transferido para onboarding',
  cancelado: 'Cancelado',
};

export const SEMAFORO_LABEL: Record<SemaforoAdmissao, string> = {
  verde: 'Verde',
  amarelo: 'Amarelo',
  vermelho: 'Vermelho',
};

export const ETAPAS_ADMISSAO: EtapaDef[] = [
  { codigo: 'ADM-001', ordem: 1, fase: '1. Início', nome: 'Candidato seleccionado', responsavel: 'Recrutamento e Cultura', descricao: 'Confirmar o candidato final e abrir o processo de admissão.', decisao: true, estado: 'rascunho', simEtiqueta: 'Criar processo de admissão', naoEtiqueta: 'Manter em recrutamento', proxima: 'ADM-002', accaoNao: 'cancelar', recuarPara: null },
  { codigo: 'ADM-002', ordem: 2, fase: '1. Início', nome: 'Solicitação da proposta financeira', responsavel: 'Recrutamento e Cultura', descricao: 'Pedir a C&B a proposta financeira e o enquadramento da função.', decisao: false, estado: 'rascunho', simEtiqueta: 'Submeter pedido a C&B', naoEtiqueta: null, proxima: 'ADM-003', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-003', ordem: 3, fase: '1. Início', nome: 'Elaboração e aprovação da proposta', responsavel: 'Compensação e Benefícios', descricao: 'C&B prepara a proposta e submete-a à rota de aprovação.', decisao: true, estado: 'em_aprovacao', simEtiqueta: 'Gerar carta de oferta', naoEtiqueta: 'Rever proposta', proxima: 'ADM-004', accaoNao: 'recuar', recuarPara: 'ADM-002' },
  { codigo: 'ADM-004', ordem: 4, fase: '2. Oferta', nome: 'Emissão e envio da carta de oferta', responsavel: 'Recrutamento e Cultura', descricao: 'Enviar a carta ao candidato pelo e-mail registado e arquivar a versão.', decisao: false, estado: 'oferta_enviada', simEtiqueta: 'Marcar oferta como enviada', naoEtiqueta: null, proxima: 'ADM-005', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-005', ordem: 5, fase: '2. Oferta', nome: 'Resposta do candidato', responsavel: 'Candidato', descricao: 'Registar a aceitação ou a recusa. Para renegociar, a proposta volta a C&B. Para encerrar de vez, use Encerrar processo.', decisao: true, estado: 'oferta_enviada', simEtiqueta: 'Avançar para documentação', naoEtiqueta: 'Renegociar proposta', proxima: 'ADM-006', accaoNao: 'recuar', recuarPara: 'ADM-003' },
  { codigo: 'ADM-006', ordem: 6, fase: '3. Documentação', nome: 'Solicitação de documentos de admissão', responsavel: 'Recrutamento e Cultura', descricao: 'Escolher os documentos do catálogo e enviar a checklist ao candidato.', decisao: false, estado: 'documentacao_pendente', simEtiqueta: 'Checklist disponibilizada', naoEtiqueta: null, proxima: 'ADM-007', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-007', ordem: 7, fase: '3. Documentação', nome: 'Submissão de documentos', responsavel: 'Candidato', descricao: 'O candidato entrega os documentos da checklist pelo link enviado.', decisao: false, estado: 'documentacao_pendente', simEtiqueta: 'Documentos submetidos', naoEtiqueta: null, proxima: 'ADM-008', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-008', ordem: 8, fase: '3. Documentação', nome: 'Validação documental', responsavel: 'Recrutamento e Cultura', descricao: 'Verificar integridade, legibilidade e conformidade do dossier.', decisao: true, estado: 'documentacao_pendente', simEtiqueta: 'Marcar dossier validado', naoEtiqueta: 'Solicitar correcção', proxima: 'ADM-009', accaoNao: 'recuar', recuarPara: 'ADM-007' },
  { codigo: 'ADM-009', ordem: 9, fase: '4. Verificações', nome: 'Validação de referências profissionais', responsavel: 'Recrutamento e Cultura', descricao: 'Registar contactos e o resultado das referências.', decisao: true, estado: 'em_verificacoes', simEtiqueta: 'Referências validadas', naoEtiqueta: 'Escalar para decisão', proxima: 'ADM-010', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-010', ordem: 10, fase: '4. Verificações', nome: 'Agendamento de exames médicos', responsavel: 'Saúde Ocupacional', descricao: 'Pedir o exame de admissão. Não registar dados clínicos.', decisao: false, estado: 'em_verificacoes', simEtiqueta: 'Exame agendado', naoEtiqueta: null, proxima: 'ADM-011', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-011', ordem: 11, fase: '4. Verificações', nome: 'Registo do resultado de aptidão', responsavel: 'Saúde Ocupacional', descricao: 'Registar apenas apto, apto com restrições ou não apto, com data e validade.', decisao: true, estado: 'em_verificacoes', simEtiqueta: 'Avançar para contratação', naoEtiqueta: 'Suspender e escalar', proxima: 'ADM-012', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-012', ordem: 12, fase: '5. Contratação', nome: 'Encaminhamento para contrato', responsavel: 'Recrutamento e Cultura', descricao: 'Enviar o dossier validado a Relações Laborais.', decisao: false, estado: 'em_contratacao', simEtiqueta: 'Pedido de contrato criado', naoEtiqueta: null, proxima: 'ADM-013', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-013', ordem: 13, fase: '5. Contratação', nome: 'Elaboração e validação do contrato', responsavel: 'Relações Laborais', descricao: 'Elaborar o contrato e submetê-lo às validações aplicáveis.', decisao: true, estado: 'em_contratacao', simEtiqueta: 'Contrato pronto para assinatura', naoEtiqueta: 'Devolver para correcção', proxima: 'ADM-014', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-014', ordem: 14, fase: '5. Contratação', nome: 'Assinatura do contrato', responsavel: 'Relações Laborais', descricao: 'Registar a assinatura e arquivar a versão final.', decisao: true, estado: 'em_contratacao', simEtiqueta: 'Confirmar admissão', naoEtiqueta: 'Manter pendente', proxima: 'ADM-015', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-015', ordem: 15, fase: '6. Cadastro', nome: 'Criação do colaborador no Upstanding', responsavel: 'Administração de Pessoal / C&B', descricao: 'Registar o número de colaborador quando o cadastro estiver feito. A integração fica para um corte seguinte.', decisao: true, estado: 'em_cadastro', simEtiqueta: 'Colaborador criado', naoEtiqueta: 'Corrigir dados e reenviar', proxima: 'ADM-016', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-016', ordem: 16, fase: '6. Cadastro', nome: 'Geração do checklist de pré-onboarding', responsavel: 'Plataforma', descricao: 'Confirmar que as tarefas de preparação foram atribuídas às áreas de suporte.', decisao: false, estado: 'em_cadastro', simEtiqueta: 'Tarefas atribuídas', naoEtiqueta: null, proxima: 'ADM-017', accaoNao: null, recuarPara: null },
  { codigo: 'ADM-017', ordem: 17, fase: '7. Preparação', nome: 'Criação de e-mail e acessos', responsavel: 'IT', descricao: 'Confirmar e-mail corporativo e acessos aos sistemas.', decisao: true, estado: 'pre_onboarding', simEtiqueta: 'Confirmar acessos', naoEtiqueta: 'Escalar pendência', proxima: 'ADM-018', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-018', ordem: 18, fase: '7. Preparação', nome: 'Preparação de equipamentos', responsavel: 'IT / Gabinete de Activos', descricao: 'Confirmar computador, telefone ou outros recursos do posto.', decisao: true, estado: 'pre_onboarding', simEtiqueta: 'Marcar como preparado', naoEtiqueta: 'Escalar indisponibilidade', proxima: 'ADM-019', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-019', ordem: 19, fase: '7. Preparação', nome: 'Passe e acessos físicos', responsavel: 'DPC / Segurança Patrimonial', descricao: 'Confirmar o passe de serviço e o acesso às instalações.', decisao: true, estado: 'pre_onboarding', simEtiqueta: 'Passe activo', naoEtiqueta: 'Corrigir dados ou aprovação', proxima: 'ADM-020', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-020', ordem: 20, fase: '7. Preparação', nome: 'Posto de trabalho e comunicação à equipa', responsavel: 'Gestor directo', descricao: 'Confirmar lugar, mentor e comunicação de chegada.', decisao: true, estado: 'pre_onboarding', simEtiqueta: 'Área pronta para receber', naoEtiqueta: 'Notificar pendências', proxima: 'ADM-021', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-021', ordem: 21, fase: '8. Fecho', nome: 'Confirmação de prontidão', responsavel: 'Plataforma / DPC', descricao: 'Verde sem pendências críticas. Amarelo é uma devolução já registada. Vermelho é bloqueio ou processo encerrado.', decisao: true, estado: 'pre_onboarding', simEtiqueta: 'Confirmar entrada', naoEtiqueta: 'Escalar bloqueios', proxima: 'ADM-022', accaoNao: 'bloquear', recuarPara: null },
  { codigo: 'ADM-022', ordem: 22, fase: '8. Fecho', nome: 'Activação do onboarding digital', responsavel: 'DPC', descricao: 'Criar a conta no People Connect, enviar o link para definir a palavra-passe e abrir o trilho de onboarding.', decisao: false, estado: 'pronto_para_entrada', simEtiqueta: 'Transferir para onboarding', naoEtiqueta: null, proxima: null, accaoNao: null, recuarPara: null },
];

const POR_CODIGO = new Map(ETAPAS_ADMISSAO.map((etapa) => [etapa.codigo, etapa]));

export function etapaPorCodigo(codigo: string): EtapaDef {
  const etapa = POR_CODIGO.get(codigo);
  if (!etapa) throw new Error(`Etapa de admissão desconhecida: ${codigo}`);
  return etapa;
}

export interface EtapaRuntime {
  codigo: string;
  estado: EstadoEtapaAdmissao;
  resultado: ResultadoEtapa | null;
  observacao: string | null;
}

export interface ProcessoRuntime {
  estado: EstadoAdmissao;
  etapaActual: string;
  semaforo: SemaforoAdmissao;
  bloqueado: boolean;
  bloqueioMotivo: string | null;
  motivoCancelamento: string | null;
  etapas: EtapaRuntime[];
}

export type AccaoAdmissao =
  | { tipo: 'avancar'; observacao?: string | null }
  | { tipo: 'recusar'; observacao: string }
  | { tipo: 'cancelar'; motivo: string };

export type AccaoResultado =
  | { ok: true; processo: ProcessoRuntime; accaoAudit: string; resumo: string }
  | { ok: false; erro: string };

export function estadoInicial(): ProcessoRuntime {
  return {
    estado: 'rascunho',
    etapaActual: 'ADM-001',
    semaforo: 'verde',
    bloqueado: false,
    bloqueioMotivo: null,
    motivoCancelamento: null,
    etapas: ETAPAS_ADMISSAO.map((etapa) => ({
      codigo: etapa.codigo,
      estado: etapa.codigo === 'ADM-001' ? 'em_curso' : 'pendente',
      resultado: null,
      observacao: null,
    })),
  };
}

export function calcularSemaforo(processo: Pick<ProcessoRuntime, 'estado' | 'bloqueado' | 'etapas'>): SemaforoAdmissao {
  if (processo.estado === 'cancelado' || processo.bloqueado) return 'vermelho';
  if (processo.etapas.some((etapa) => etapa.estado === 'rejeitada')) return 'amarelo';
  return 'verde';
}

function fechar(processo: ProcessoRuntime): ProcessoRuntime {
  return { ...processo, semaforo: calcularSemaforo(processo) };
}

function texto(value: string | null | undefined): string | null {
  const limpo = value?.trim();
  return limpo ? limpo : null;
}

export function aplicarAccao(processo: ProcessoRuntime, accao: AccaoAdmissao): AccaoResultado {
  if (processo.estado === 'cancelado') return { ok: false, erro: 'O processo está cancelado.' };
  if (processo.estado === 'transferido_onboarding') return { ok: false, erro: 'O processo já foi transferido para onboarding.' };

  const actual = etapaPorCodigo(processo.etapaActual);

  if (accao.tipo === 'cancelar') {
    const motivo = texto(accao.motivo);
    if (!motivo) return { ok: false, erro: 'Indique o motivo do encerramento.' };
    return {
      ok: true,
      accaoAudit: 'admissao_cancelada',
      resumo: `Processo encerrado em ${actual.codigo}.`,
      processo: fechar({
        ...processo,
        estado: 'cancelado',
        motivoCancelamento: motivo,
        bloqueado: false,
        bloqueioMotivo: null,
      }),
    };
  }

  if (accao.tipo === 'recusar') {
    if (!actual.decisao || !actual.accaoNao) return { ok: false, erro: 'Esta etapa conclui-se sem recusa.' };
    const observacao = texto(accao.observacao);
    if (!observacao) return { ok: false, erro: 'Indique o motivo da decisão.' };

    if (actual.accaoNao === 'cancelar') {
      return {
        ok: true,
        accaoAudit: 'admissao_recusada',
        resumo: `${actual.codigo} manteve o processo em recrutamento.`,
        processo: fechar({
          ...processo,
          estado: 'cancelado',
          motivoCancelamento: observacao,
          bloqueado: false,
          bloqueioMotivo: null,
          etapas: processo.etapas.map((etapa) => etapa.codigo === actual.codigo
            ? { ...etapa, estado: 'rejeitada', resultado: 'nao', observacao }
            : etapa),
        }),
      };
    }

    if (actual.accaoNao === 'bloquear') {
      return {
        ok: true,
        accaoAudit: 'admissao_bloqueada',
        resumo: `${actual.codigo} ficou bloqueada.`,
        processo: fechar({
          ...processo,
          bloqueado: true,
          bloqueioMotivo: observacao,
          etapas: processo.etapas.map((etapa) => etapa.codigo === actual.codigo
            ? { ...etapa, observacao }
            : etapa),
        }),
      };
    }

    const destino = actual.recuarPara;
    if (!destino) return { ok: false, erro: 'Esta recusa não tem etapa de destino.' };
    const destinoDef = etapaPorCodigo(destino);
    const etapas = processo.etapas.map((etapa) => {
      const def = etapaPorCodigo(etapa.codigo);
      if (etapa.codigo === actual.codigo) return { ...etapa, estado: 'rejeitada' as const, resultado: 'nao' as const, observacao };
      if (etapa.codigo === destino) return { ...etapa, estado: 'em_curso' as const, resultado: null, observacao: null };
      if (def.ordem > destinoDef.ordem && def.ordem < actual.ordem) {
        return { ...etapa, estado: 'pendente' as const, resultado: null, observacao: null };
      }
      return etapa;
    });
    return {
      ok: true,
      accaoAudit: 'admissao_recuada',
      resumo: `${actual.codigo} devolveu o processo para ${destino}.`,
      processo: fechar({
        ...processo,
        etapas,
        etapaActual: destino,
        estado: destinoDef.estado,
        bloqueado: false,
        bloqueioMotivo: null,
      }),
    };
  }

  const observacao = texto(accao.observacao);
  const etapasConcluidas = processo.etapas.map((etapa) => etapa.codigo === actual.codigo
    ? {
      ...etapa,
      estado: 'concluida' as const,
      resultado: actual.decisao ? 'sim' as const : 'concluida' as const,
      observacao: observacao ?? etapa.observacao,
    }
    : etapa);

  if (!actual.proxima) {
    return {
      ok: true,
      accaoAudit: 'admissao_transferida',
      resumo: 'Admissão transferida para onboarding.',
      processo: fechar({
        ...processo,
        etapas: etapasConcluidas,
        estado: 'transferido_onboarding',
        bloqueado: false,
        bloqueioMotivo: null,
      }),
    };
  }

  const proxima = etapaPorCodigo(actual.proxima);
  return {
    ok: true,
    accaoAudit: 'admissao_avancada',
    resumo: `${actual.codigo} concluída. Etapa actual: ${proxima.codigo}.`,
    processo: fechar({
      ...processo,
      etapaActual: proxima.codigo,
      estado: proxima.estado,
      bloqueado: false,
      bloqueioMotivo: null,
      etapas: etapasConcluidas.map((etapa) => etapa.codigo === proxima.codigo
        ? { ...etapa, estado: 'em_curso' }
        : etapa),
    }),
  };
}
