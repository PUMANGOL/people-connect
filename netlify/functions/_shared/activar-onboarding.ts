import { sql } from './db';
import { invalidarColaboradores } from './cache-leitura';
import { lerDocumentosPedidos } from './anexos';
import { appBaseUrl } from '@/src/lib/app-url';
import { criarConvitePassword } from '@/src/lib/auth-sync';
import { emailAcessoColaborador } from './email-templates';
import { mailHasBanner, sendMail } from './mail';

export class ActivacaoErro extends Error {}

interface ProcessoActivacao {
  nome: string;
  email: string | null;
  funcao: string | null;
  direccao: string | null;
  categoria: string | null;
  data_prevista_entrada: unknown;
  colaborador_id: string | null;
}

function dataIso(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function somarDias(iso: string, dias: number): string {
  const data = new Date(`${iso}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

async function atribuirTrilho(colaboradorId: string, funcao: string, inicio: string) {
  const templates = await sql<{ id: string; nome: string }[]>`
    SELECT id, nome
    FROM trilhos_onboarding
    WHERE is_template = true AND activo = true
    ORDER BY CASE WHEN lower(funcao) = lower(${funcao}) THEN 0 ELSE 1 END, nome
    LIMIT 1
  `;
  const template = templates[0];
  if (!template) throw new ActivacaoErro('Não há um trilho de onboarding activo para atribuir.');

  const etapas = await sql<{
    ordem: number;
    nome: string;
    tipo: string;
    duracao_dias: number | null;
    descricao: string | null;
    conteudo_ref: string | null;
    criterio_conclusao: string | null;
    obrigatoria: boolean;
    bloqueante: boolean;
    responsavel_default: string | null;
    documentos_pedidos: unknown;
  }[]>`
    SELECT ordem, nome, tipo, duracao_dias, descricao, conteudo_ref, criterio_conclusao,
           obrigatoria, bloqueante, responsavel_default, documentos_pedidos
    FROM etapas_trilho
    WHERE trilho_id = ${template.id}
    ORDER BY ordem
  `;
  if (!etapas.length) throw new ActivacaoErro('O trilho de onboarding não tem etapas.');

  const tpl = await sql<{ funcao: string | null; nome: string; duracao_estimada: number | null; versao: number | null; categoria: string | null; descricao: string | null }[]>`
    SELECT funcao, nome, duracao_estimada, versao, categoria, descricao
    FROM trilhos_onboarding WHERE id = ${template.id} LIMIT 1
  `;
  const origem = tpl[0];

  await sql.begin(async (tx) => {
    const inst = await tx`
      INSERT INTO trilhos_onboarding (funcao, nome, duracao_estimada, versao, activo, categoria, descricao, is_template)
      VALUES (
        ${origem.funcao}, ${origem.nome}, ${origem.duracao_estimada}, ${origem.versao},
        true, ${origem.categoria}, ${origem.descricao}, false
      )
      RETURNING id
    `;
    const trilhoId = inst[0].id as string;
    let cursor = inicio;
    for (let i = 0; i < etapas.length; i++) {
      const etapa = etapas[i];
      const dias = Math.max(1, Number(etapa.duracao_dias) || 1);
      const dataInicio = cursor;
      const dataFim = somarDias(dataInicio, dias - 1);
      cursor = somarDias(dataFim, 1);
      const nova = await tx`
        INSERT INTO etapas_trilho (
          trilho_id, ordem, nome, tipo, duracao_dias, descricao, conteudo_ref,
          criterio_conclusao, obrigatoria, bloqueante, responsavel_default, documentos_pedidos
        ) VALUES (
          ${trilhoId}, ${etapa.ordem}, ${etapa.nome}, ${etapa.tipo}::tipo_etapa, ${etapa.duracao_dias},
          ${etapa.descricao}, ${etapa.conteudo_ref}, ${etapa.criterio_conclusao},
          ${etapa.obrigatoria}, ${etapa.bloqueante}, ${etapa.responsavel_default},
          ${tx.json(lerDocumentosPedidos(etapa.documentos_pedidos))}
        )
        RETURNING id
      `;
      await tx`
        INSERT INTO progresso_onboarding (colaborador_id, trilho_id, etapa_id, estado, data_inicio, data_prevista)
        VALUES (
          ${colaboradorId}, ${trilhoId}, ${nova[0].id},
          ${i === 0 ? 'em_curso' : 'pendente'}::estado_etapa,
          ${dataInicio}, ${dataFim}
        )
      `;
    }
    await tx`
      UPDATE colaboradores
      SET trilho_id = ${trilhoId}, estado_onboarding = 'em_curso'::estado_onboarding, updated_at = NOW()
      WHERE id = ${colaboradorId}
    `;
  });

  return template.nome;
}

/**
 * Cria a conta do colaborador, abre o trilho e envia o link para definir a palavra-passe.
 * Devolve o texto que fica na auditoria.
 */
export async function activarOnboarding(opts: {
  processoId: string;
  actor: { id: string; email: string; role: string };
}): Promise<string> {
  const rows = await sql<ProcessoActivacao[]>`
    SELECT nome, email, funcao, direccao, categoria, data_prevista_entrada, colaborador_id
    FROM processos_admissao
    WHERE id = ${opts.processoId}
    LIMIT 1
  `;
  const processo = rows[0];
  if (!processo) throw new ActivacaoErro('Processo de admissão não encontrado.');

  const email = processo.email?.trim().toLowerCase() ?? '';
  if (!email.includes('@')) throw new ActivacaoErro('Indique o e-mail do candidato antes de activar o onboarding.');
  if (!processo.funcao?.trim() || !processo.direccao?.trim()) {
    throw new ActivacaoErro('Indique a função e a direcção antes de activar o onboarding.');
  }
  const entrada = dataIso(processo.data_prevista_entrada);
  if (!entrada) throw new ActivacaoErro('Indique a data prevista de entrada antes de activar o onboarding.');

  let utilizadorId: string | null = null;
  let colaboradorId = processo.colaborador_id;
  let temPassword = false;
  let trilhoId: string | null = null;

  if (colaboradorId) {
    const atuais = await sql<{ utilizador_id: string | null; trilho_id: string | null; password_hash: string | null }[]>`
      SELECT c.utilizador_id, c.trilho_id, u.password_hash
      FROM colaboradores c
      LEFT JOIN utilizadores u ON u.id = c.utilizador_id
      WHERE c.id = ${colaboradorId}
      LIMIT 1
    `;
    const atual = atuais[0];
    utilizadorId = atual?.utilizador_id ?? null;
    trilhoId = atual?.trilho_id ?? null;
    temPassword = Boolean(atual?.password_hash);
  }

  if (!utilizadorId) {
    const contas = await sql<{ id: string; password_hash: string | null }[]>`
      SELECT id, password_hash FROM utilizadores WHERE lower(email) = ${email} LIMIT 1
    `;
    if (contas[0]) {
      utilizadorId = contas[0].id;
      temPassword = Boolean(contas[0].password_hash);
    } else {
      const criada = await sql<{ id: string }[]>`
        INSERT INTO utilizadores (nome, email, perfil, departamento, estado)
        VALUES (
          ${processo.nome}, ${email}, 'novo_colaborador'::perfil_utilizador,
          ${processo.direccao}, 'activo'
        )
        RETURNING id
      `;
      utilizadorId = criada[0].id;
    }
  }

  if (!colaboradorId) {
    const existentes = await sql<{ id: string; trilho_id: string | null }[]>`
      SELECT id, trilho_id FROM colaboradores WHERE utilizador_id = ${utilizadorId} LIMIT 1
    `;
    if (existentes[0]) {
      colaboradorId = existentes[0].id;
      trilhoId = existentes[0].trilho_id;
    } else {
      const criado = await sql<{ id: string }[]>`
        INSERT INTO colaboradores (
          nome, funcao, direccao, data_admissao, categoria, email, utilizador_id, estado_onboarding
        ) VALUES (
          ${processo.nome}, ${processo.funcao}, ${processo.direccao}, ${entrada},
          ${processo.categoria?.trim() || 'tecnicos'}, ${email}, ${utilizadorId},
          'nao_iniciado'::estado_onboarding
        )
        RETURNING id
      `;
      colaboradorId = criado[0].id;
      await sql`
        INSERT INTO onboarding_timeline (colaborador_id, tipo, actor_id, actor_nome, actor_role, descricao)
        VALUES (
          ${colaboradorId}, 'utilizador_criado', ${opts.actor.id}, ${opts.actor.email}, ${opts.actor.role},
          ${'Colaborador criado a partir da admissão: ' + processo.nome}
        )
      `;
    }
  }

  await sql`
    UPDATE processos_admissao SET colaborador_id = ${colaboradorId}, updated_at = NOW()
    WHERE id = ${opts.processoId}
  `;

  let trilhoNome: string | null = null;
  if (!trilhoId) {
    trilhoNome = await atribuirTrilho(colaboradorId, processo.funcao, entrada);
  }

  if (!temPassword) {
    const token = await criarConvitePassword(utilizadorId);
    const href = `${appBaseUrl()}/definir-password?token=${encodeURIComponent(token)}`;
    const mensagem = emailAcessoColaborador({
      nome: processo.nome,
      href,
      hasBanner: await mailHasBanner(),
    });
    await sendMail({
      to: email,
      subject: mensagem.subject,
      html: mensagem.html,
      text: mensagem.text,
      contexto: 'admissao-acesso',
    });
  }

  const acesso = temPassword
    ? `A conta ${email} já tinha palavra-passe.`
    : `Link para definir a palavra-passe enviado para ${email}.`;
  const trilho = trilhoNome ? ` Trilho «${trilhoNome}» aberto a partir de ${entrada}.` : '';
  invalidarColaboradores();
  return `${acesso}${trilho}`;
}
