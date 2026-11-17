import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { sql } from '../netlify/functions/_shared/db';

/**
 * Importa a estrutura orgânica a partir do export de utilizadores do Entra ID
 * (Entra admin center → Utilizadores → Transferir utilizadores, CSV).
 *
 *   npx tsx scripts/importar-estrutura-entra.ts <ficheiro.csv>            resumo, sem gravar
 *   npx tsx scripts/importar-estrutura-entra.ts <ficheiro.csv> --aplicar  grava na BD
 *
 * O ficheiro é tratado como o directório completo: quem não vier nele sai da tabela.
 * Só se importam unidade, cargo e local; telefones e moradas ficam de fora.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUNAS = ['Object Id', 'User principal name', 'Display name', 'Department', 'Title'];

/** Grafias erradas que a normalização por maiúsculas/acentos não apanha. */
const CORRECCOES: Record<string, string> = {
  'cidade finaceira': 'Cidade Financeira',
  'cidade finaneira': 'Cidade Financeira',
  'academia da pumangol': 'Academia Pumangol',
  'academia - pumangol': 'Academia Pumangol',
  'pumangol - academia': 'Academia Pumangol',
  'terminal de malange': 'Terminal Malanje',
  'terminal do lobito': 'Terminal Lobito',
  'terminal de aviacao de luanda': 'Terminal Aviação',
  'area de recrumentato': 'Área de Recrutamento',
  'malanje': 'Malange',
};

type Linha = Record<string, string>;

type Pessoa = {
  entra_object_id: string;
  nome: string;
  emails: string[];
  cargo: string | null;
  direccao: string | null;
  unidade: string | null;
  local_trabalho: string | null;
  cidade: string | null;
};

function lerCsv(texto: string): Linha[] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      linhas.push(linha); linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }

  const [cabecalho, ...resto] = linhas;
  const emFalta = COLUNAS.filter((c) => !cabecalho?.includes(c));
  if (emFalta.length) throw new Error(`O ficheiro não parece um export do Entra ID. Faltam colunas: ${emFalta.join(', ')}`);
  return resto
    .filter((l) => l.length > 1)
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, l[i] ?? ''])));
}

function chave(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function limpar(valor: string | undefined): string | null {
  const v = (valor ?? '').replace(/\s+/g, ' ').trim();
  if (!v) return null;
  return CORRECCOES[chave(v)] ?? v;
}

/** "Direcção X - Área Y" traz as duas posições no mesmo campo. */
function separarUnidade(departamento: string | null): { direccao: string | null; unidade: string | null } {
  if (!departamento) return { direccao: null, unidade: null };
  const m = departamento.match(/^(dire[cç]?[cç][aã]o\s.+?)\s-\s(.+)$/i);
  return m ? { direccao: m[1], unidade: m[2] } : { direccao: null, unidade: departamento };
}

/** Variantes que só diferem em maiúsculas ou acentos ficam com a grafia mais usada. */
function uniformizar(pessoas: Pessoa[], campo: 'cargo' | 'direccao' | 'unidade' | 'local_trabalho' | 'cidade') {
  const contagem = new Map<string, Map<string, number>>();
  for (const p of pessoas) {
    const v = p[campo];
    if (!v) continue;
    const variantes = contagem.get(chave(v)) ?? new Map<string, number>();
    variantes.set(v, (variantes.get(v) ?? 0) + 1);
    contagem.set(chave(v), variantes);
  }
  const canonica = new Map<string, string>();
  for (const [k, variantes] of contagem) {
    const [melhor] = [...variantes.entries()].sort((a, b) => b[1] - a[1] || (/[À-ÿ]/.test(b[0]) ? 1 : 0) - (/[À-ÿ]/.test(a[0]) ? 1 : 0));
    canonica.set(k, melhor[0]);
  }
  for (const p of pessoas) if (p[campo]) p[campo] = canonica.get(chave(p[campo]!))!;
}

function emailsDe(l: Linha): string[] {
  const todos = [l['User principal name'], ...(l['Proxy addresses'] ?? '').split('+')]
    .map((e) => e.trim().replace(/^smtp:/i, '').toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !e.includes('#ext#'));
  return [...new Set(todos)];
}

function preparar(linhas: Linha[]) {
  const ignorados = { convidados: 0, bloqueados: 0, sem_dados: 0, invalidos: 0 };
  const pessoas: Pessoa[] = [];
  for (const l of linhas) {
    const upn = (l['User principal name'] ?? '').toLowerCase();
    if (upn.includes('#ext#')) { ignorados.convidados++; continue; }
    if (l['Block credential'] === 'True') { ignorados.bloqueados++; continue; }
    const departamento = limpar(l['Department']);
    const cargo = limpar(l['Title']);
    if ((!departamento && !cargo) || /^testes?$/i.test(departamento ?? '')) { ignorados.sem_dados++; continue; }
    const id = l['Object Id']?.trim();
    const emails = emailsDe(l);
    if (!UUID_RE.test(id ?? '') || !emails.length) { ignorados.invalidos++; continue; }
    const { direccao, unidade } = separarUnidade(departamento);
    pessoas.push({
      entra_object_id: id,
      nome: limpar(l['Display name']) ?? emails[0],
      emails,
      cargo: cargo && /^not applicable/i.test(cargo) ? null : cargo,
      direccao,
      unidade,
      local_trabalho: limpar(l['Office']),
      cidade: limpar(l['City']),
    });
  }
  for (const campo of ['cargo', 'direccao', 'unidade', 'local_trabalho', 'cidade'] as const) uniformizar(pessoas, campo);
  return { pessoas, ignorados };
}

async function main() {
  const args = process.argv.slice(2);
  const ficheiro = args.find((a) => !a.startsWith('--'));
  const aplicar = args.includes('--aplicar');
  if (!ficheiro) {
    console.error('Uso: npx tsx scripts/importar-estrutura-entra.ts <ficheiro.csv> [--aplicar]');
    process.exit(1);
  }

  const linhas = lerCsv(readFileSync(ficheiro, 'utf8').replace(/^\uFEFF/, ''));
  const { pessoas, ignorados } = preparar(linhas);

  const contas = await sql`SELECT lower(email) AS email FROM utilizadores WHERE email IS NOT NULL`;
  const emailsContas = new Set(contas.map((c) => c.email as string));
  const comConta = pessoas.filter((p) => p.emails.some((e) => emailsContas.has(e))).length;
  const unidades = new Map<string, number>();
  for (const p of pessoas) if (p.unidade) unidades.set(p.unidade, (unidades.get(p.unidade) ?? 0) + 1);

  console.log(`Linhas no ficheiro: ${linhas.length}`);
  console.log(`Ignoradas: ${ignorados.convidados} convidados externos, ${ignorados.bloqueados} contas bloqueadas, ${ignorados.sem_dados} sem unidade nem cargo, ${ignorados.invalidos} sem Object Id ou email`);
  console.log(`A importar: ${pessoas.length} pessoas, ${comConta} com conta na plataforma, ${unidades.size} unidades`);
  console.log('Maiores unidades:');
  for (const [u, n] of [...unidades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(n).padStart(4)}  ${u}`);

  if (!aplicar) {
    console.log('\nNada gravado. Volte a correr com --aplicar para importar.');
    await sql.end();
    return;
  }

  const resultado = await sql.begin(async (tx) => {
    const gravados = await tx`
      INSERT INTO estrutura_organica ${tx(pessoas, 'entra_object_id', 'nome', 'emails', 'cargo', 'direccao', 'unidade', 'local_trabalho', 'cidade')}
      ON CONFLICT (entra_object_id) DO UPDATE SET
        nome = EXCLUDED.nome, emails = EXCLUDED.emails, cargo = EXCLUDED.cargo, direccao = EXCLUDED.direccao,
        unidade = EXCLUDED.unidade, local_trabalho = EXCLUDED.local_trabalho, cidade = EXCLUDED.cidade,
        importado_em = now()
      RETURNING (xmax = 0) AS novo
    `;
    const removidos = await tx`
      DELETE FROM estrutura_organica
       WHERE NOT (entra_object_id = ANY(${pessoas.map((p) => p.entra_object_id)}::uuid[]))
      RETURNING entra_object_id
    `;
    return {
      novos: gravados.filter((g) => g.novo).length,
      actualizados: gravados.filter((g) => !g.novo).length,
      removidos: removidos.length,
    };
  });
  console.log(`\nGravado: ${resultado.novos} novos, ${resultado.actualizados} actualizados, ${resultado.removidos} removidos.`);
  await sql.end();
}

main().catch(async (e) => {
  console.error('Erro:', e instanceof Error ? e.message : e);
  await sql.end().catch(() => undefined);
  process.exit(1);
});
