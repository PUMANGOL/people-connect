// ============================================================
// Ficha do Trabalhador — modelo "FICHA DO NOVO TRABALHADOR Pumangol"
// Partilhado entre o frontend (formulário, exportação) e o backend
// (validação).
// ============================================================

import * as XLSX from 'xlsx';

export type Sexo = 'M' | 'F';
export type EstadoFicha = 'por_preencher' | 'rascunho' | 'submetida';

export interface FichaConjuge {
  nome: string;
  data_nascimento: string;
  local_nascimento: string;
  endereco: string;
  provincia: string;
  telefone: string;
  telemovel: string;
}

export interface FichaFilho {
  nome: string;
  data_nascimento: string;
  telefone: string;
}

export interface FichaContactoEmergencia {
  nome: string;
  parentesco: string;
  endereco: string;
  telefones: string;
  email: string;
}

/** Dados preenchidos pelo colaborador. Datas em "AAAA-MM-DD" ('' = sem data). */
export interface FichaTrabalhadorDados {
  nome: string;
  data_inicio: string;
  numero_bi: string;
  funcao: string;
  sexo: Sexo | '';
  data_nascimento: string;
  local_nascimento: string;
  estado_civil: string;
  morada: string;
  provincia: string;
  telefone: string;
  telemovel: string;
  email: string;
  conjuge: FichaConjuge | null;
  filhos: FichaFilho[];
  contactos_emergencia: FichaContactoEmergencia[];
}

export interface FichaTrabalhador extends FichaTrabalhadorDados {
  colaborador_id: string;
  estado: EstadoFicha;
  submetida_em: string | null;
  updated_at: string | null;
}

export const ESTADOS_CIVIS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'uniao_facto', label: 'União de facto' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
];

export const PROVINCIAS_ANGOLA = [
  'Bengo', 'Benguela', 'Bié', 'Cabinda', 'Cassai-Zambeze', 'Cuando', 'Cubango', 'Cuanza Norte',
  'Cuanza Sul', 'Cunene', 'Huambo', 'Huíla', 'Icolo e Bengo', 'Luanda', 'Lunda Norte', 'Lunda Sul',
  'Malanje', 'Moxico', 'Moxico Leste', 'Namibe', 'Uíge', 'Zaire',
];

export const MAX_FILHOS = 10;
export const MAX_CONTACTOS_EMERGENCIA = 2;

/** Cônjuge só se pede a casados / união de facto. */
export function temConjuge(estadoCivil: string): boolean {
  return estadoCivil === 'casado' || estadoCivil === 'uniao_facto';
}

export function conjugeVazio(): FichaConjuge {
  return { nome: '', data_nascimento: '', local_nascimento: '', endereco: '', provincia: '', telefone: '', telemovel: '' };
}

export function filhoVazio(): FichaFilho {
  return { nome: '', data_nascimento: '', telefone: '' };
}

export function contactoVazio(): FichaContactoEmergencia {
  return { nome: '', parentesco: '', endereco: '', telefones: '', email: '' };
}

export function fichaVazia(): FichaTrabalhadorDados {
  return {
    nome: '', data_inicio: '', numero_bi: '', funcao: '', sexo: '', data_nascimento: '',
    local_nascimento: '', estado_civil: '', morada: '', provincia: '', telefone: '', telemovel: '',
    email: '', conjuge: null, filhos: [], contactos_emergencia: [contactoVazio(), contactoVazio()],
  };
}

// ----- Normalização (o backend nunca confia na forma do payload) -----

function texto(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function data(v: unknown): string {
  const s = texto(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function preenchido(o: object): boolean {
  return Object.values(o).some((v) => typeof v === 'string' && v !== '');
}

export function normalizarFicha(input: unknown): FichaTrabalhadorDados {
  const f = obj(input);
  const estadoCivil = ESTADOS_CIVIS.some((e) => e.value === f.estado_civil) ? (f.estado_civil as string) : '';
  const c = obj(f.conjuge);
  const conjuge: FichaConjuge = {
    nome: texto(c.nome), data_nascimento: data(c.data_nascimento), local_nascimento: texto(c.local_nascimento),
    endereco: texto(c.endereco, 500), provincia: texto(c.provincia), telefone: texto(c.telefone, 40),
    telemovel: texto(c.telemovel, 40),
  };
  const filhos = (Array.isArray(f.filhos) ? f.filhos : [])
    .slice(0, MAX_FILHOS)
    .map((x) => {
      const o = obj(x);
      return { nome: texto(o.nome), data_nascimento: data(o.data_nascimento), telefone: texto(o.telefone, 40) };
    })
    .filter(preenchido);
  const contactos = (Array.isArray(f.contactos_emergencia) ? f.contactos_emergencia : [])
    .slice(0, MAX_CONTACTOS_EMERGENCIA)
    .map((x) => {
      const o = obj(x);
      return {
        nome: texto(o.nome), parentesco: texto(o.parentesco, 60), endereco: texto(o.endereco, 500),
        telefones: texto(o.telefones, 120), email: texto(o.email, 200),
      };
    })
    .filter(preenchido);

  return {
    nome: texto(f.nome),
    data_inicio: data(f.data_inicio),
    numero_bi: texto(f.numero_bi, 40).toUpperCase(),
    funcao: texto(f.funcao),
    sexo: f.sexo === 'M' || f.sexo === 'F' ? f.sexo : '',
    data_nascimento: data(f.data_nascimento),
    local_nascimento: texto(f.local_nascimento),
    estado_civil: estadoCivil,
    morada: texto(f.morada, 500),
    provincia: texto(f.provincia),
    telefone: texto(f.telefone, 40),
    telemovel: texto(f.telemovel, 40),
    email: texto(f.email, 200),
    conjuge: temConjuge(estadoCivil) && preenchido(conjuge) ? conjuge : null,
    filhos,
    contactos_emergencia: contactos,
  };
}

// ----- Validação para submissão (rascunhos podem ficar incompletos) -----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Erros por campo (chave = caminho, ex.: "contactos_emergencia.0.nome"). Vazio = válido. */
export function validarFicha(f: FichaTrabalhadorDados): Record<string, string> {
  const erros: Record<string, string> = {};
  const obrigatorio = (chave: string, valor: string) => {
    if (!valor.trim()) erros[chave] = 'Campo obrigatório';
  };

  obrigatorio('nome', f.nome);
  obrigatorio('data_inicio', f.data_inicio);
  obrigatorio('numero_bi', f.numero_bi);
  obrigatorio('funcao', f.funcao);
  obrigatorio('sexo', f.sexo);
  obrigatorio('data_nascimento', f.data_nascimento);
  obrigatorio('local_nascimento', f.local_nascimento);
  obrigatorio('estado_civil', f.estado_civil);
  obrigatorio('morada', f.morada);
  obrigatorio('telemovel', f.telemovel);
  if (f.email && !EMAIL_RE.test(f.email)) erros.email = 'Email inválido';

  // Datas de nascimento no futuro (comparação de "AAAA-MM-DD" em texto, hora local).
  const d = new Date();
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const futura = (chave: string, valor: string | undefined) => {
    if (valor && valor > hoje && !erros[chave]) erros[chave] = 'Data no futuro';
  };
  futura('data_nascimento', f.data_nascimento);
  futura('conjuge.data_nascimento', f.conjuge?.data_nascimento);
  f.filhos.forEach((filho, i) => futura(`filhos.${i}.data_nascimento`, filho.data_nascimento));

  if (temConjuge(f.estado_civil)) obrigatorio('conjuge.nome', f.conjuge?.nome ?? '');

  f.filhos.forEach((filho, i) => {
    obrigatorio(`filhos.${i}.nome`, filho.nome);
    obrigatorio(`filhos.${i}.data_nascimento`, filho.data_nascimento);
  });

  const principal = f.contactos_emergencia[0];
  obrigatorio('contactos_emergencia.0.nome', principal?.nome ?? '');
  obrigatorio('contactos_emergencia.0.telefones', principal?.telefones ?? '');
  f.contactos_emergencia.forEach((c, i) => {
    if (c.email && !EMAIL_RE.test(c.email)) erros[`contactos_emergencia.${i}.email`] = 'Email inválido';
  });

  return erros;
}

// ----- Exportação Excel (uma linha por trabalhador + folha de filhos) -----

export interface FichaExportavel {
  ficha: FichaTrabalhadorDados & { estado?: EstadoFicha; submetida_em?: string | null };
  direccao?: string | null;
}

function paraDataExcel(valor: string | null | undefined): Date | string {
  const m = valor ? /^(\d{4})-(\d{2})-(\d{2})/.exec(valor) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}

function estadoCivilLabel(v: string): string {
  return ESTADOS_CIVIS.find((e) => e.value === v)?.label ?? v;
}

function sexoLabel(v: string): string {
  return v === 'M' ? 'Masculino' : v === 'F' ? 'Feminino' : '';
}

const ESTADO_LABEL: Record<EstadoFicha, string> = {
  por_preencher: 'Por preencher',
  rascunho: 'Rascunho',
  submetida: 'Submetida',
};

export function estadoFichaLabel(estado: EstadoFicha): string {
  return ESTADO_LABEL[estado] ?? estado;
}

/** Workbook com as folhas "Trabalhadores" e "Filhos" — pronto para importar (ex.: Upstanding). */
export function construirWorkbookFichas(itens: FichaExportavel[]): XLSX.WorkBook {
  const trabalhadores = itens.map(({ ficha: f, direccao }) => {
    const c = f.conjuge;
    const linha: Record<string, string | number | Date> = {
      'Nome': f.nome,
      'Data de Início': paraDataExcel(f.data_inicio),
      'Número do BI': f.numero_bi,
      'Função': f.funcao,
      'Direcção': direccao ?? '',
      'Sexo': sexoLabel(f.sexo),
      'Data de Nascimento': paraDataExcel(f.data_nascimento),
      'Local de Nascimento': f.local_nascimento,
      'Estado Civil': estadoCivilLabel(f.estado_civil),
      'Morada': f.morada,
      'Província': f.provincia,
      'Telemóvel': f.telemovel,
      'Telefone Alternativo': f.telefone,
      'Email': f.email,
      'Cônjuge - Nome': c?.nome ?? '',
      'Cônjuge - Data de Nascimento': paraDataExcel(c?.data_nascimento),
      'Cônjuge - Local de Nascimento': c?.local_nascimento ?? '',
      'Cônjuge - Endereço': c?.endereco ?? '',
      'Cônjuge - Província': c?.provincia ?? '',
      'Cônjuge - Telemóvel': c?.telemovel ?? '',
      'Cônjuge - Telefone Alternativo': c?.telefone ?? '',
      'Nº de Filhos': f.filhos.length,
    };
    for (let i = 0; i < MAX_CONTACTOS_EMERGENCIA; i++) {
      const e = f.contactos_emergencia[i];
      linha[`Emergência ${i + 1} - Nome`] = e?.nome ?? '';
      linha[`Emergência ${i + 1} - Parentesco`] = e?.parentesco ?? '';
      linha[`Emergência ${i + 1} - Endereço`] = e?.endereco ?? '';
      linha[`Emergência ${i + 1} - Telefones`] = e?.telefones ?? '';
      linha[`Emergência ${i + 1} - Email`] = e?.email ?? '';
    }
    linha['Estado da Ficha'] = f.estado ? estadoFichaLabel(f.estado) : '';
    linha['Submetida em'] = f.submetida_em ? new Date(f.submetida_em) : '';
    return linha;
  });

  const filhos = itens.flatMap(({ ficha: f }) =>
    f.filhos.map((filho, i) => ({
      'Trabalhador': f.nome,
      'Número do BI (Trabalhador)': f.numero_bi,
      'Nº': i + 1,
      'Nome': filho.nome,
      'Data de Nascimento': paraDataExcel(filho.data_nascimento),
      'Telefone': filho.telefone,
    })),
  );

  const wb = XLSX.utils.book_new();
  const wsTrab = XLSX.utils.json_to_sheet(trabalhadores, { dateNF: 'dd/mm/yyyy' });
  wsTrab['!cols'] = Object.keys(trabalhadores[0] ?? { Nome: '' }).map((k) => ({ wch: Math.max(14, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsTrab, 'Trabalhadores');

  const wsFilhos = XLSX.utils.json_to_sheet(
    filhos.length ? filhos : [{ 'Trabalhador': '', 'Número do BI (Trabalhador)': '', 'Nº': '', 'Nome': '', 'Data de Nascimento': '', 'Telefone': '' }],
    { dateNF: 'dd/mm/yyyy' },
  );
  wsFilhos['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 5 }, { wch: 30 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsFilhos, 'Filhos');

  return wb;
}

export function nomeFicheiroFichas(itens: FichaExportavel[]): string {
  const hoje = new Date().toISOString().slice(0, 10);
  if (itens.length === 1) {
    const slug = itens[0].ficha.nome
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return `ficha-trabalhador_${slug || 'colaborador'}_${hoje}.xlsx`;
  }
  return `fichas-trabalhador_${hoje}.xlsx`;
}
