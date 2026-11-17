import type { ReactNode } from 'react';
import { Plus, Trash2, User, Users, Baby, Siren } from 'lucide-react';
import { Input, FormField, Select } from '@/src/components/ui/input';
import { DateInput } from '@/src/components/ui/date-time-picker';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ESTADOS_CIVIS,
  MAX_FILHOS,
  PROVINCIAS_ANGOLA,
  conjugeVazio,
  filhoVazio,
  temConjuge,
  type FichaConjuge,
  type FichaContactoEmergencia,
  type FichaFilho,
  type FichaTrabalhadorDados,
} from '@/lib/ficha-trabalhador';

const PROVINCIAS = PROVINCIAS_ANGOLA.map((p) => ({ value: p, label: p }));

/** "AAAA-MM-DD" de hoje (hora local). */
function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Datas de nascimento: menus de mês/ano, sem datas futuras. Adultos abrem por volta de há 30 anos.
const NASCIMENTO_ADULTO = { seletorAno: true, anoMinimo: 1940 } as const;
const NASCIMENTO_FILHO = { seletorAno: true, anoMinimo: 1960 } as const;
const SEXOS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
];

function Seccao({ icon, titulo, descricao, children, accao }: {
  icon: ReactNode;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  accao?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-navy-100 bg-white p-5 sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-navy-800">{titulo}</h3>
            {descricao && <p className="mt-0.5 text-xs text-navy-400">{descricao}</p>}
          </div>
        </div>
        {accao}
      </header>
      {children}
    </section>
  );
}

export type SeccaoFicha = 'pessoal' | 'dependentes' | 'emergencia';

export const SECCOES_FICHA: Array<{ key: SeccaoFicha; titulo: string }> = [
  { key: 'pessoal', titulo: 'Informação pessoal' },
  { key: 'dependentes', titulo: 'Dependentes' },
  { key: 'emergencia', titulo: 'Contactos de emergência' },
];

/** Secção a que pertence um erro de validarFicha() (pelo caminho do campo). */
export function seccaoDoErro(chave: string): SeccaoFicha {
  if (chave.startsWith('conjuge.') || chave.startsWith('filhos.')) return 'dependentes';
  if (chave.startsWith('contactos_emergencia.')) return 'emergencia';
  return 'pessoal';
}

/**
 * Formulário da Ficha do Trabalhador (modelo "FICHA DO NOVO TRABALHADOR Pumangol").
 * Controlado: o pai guarda o estado e decide quando guardar/submeter.
 */
export function FichaTrabalhadorForm({ value, onChange, erros = {}, disabled, seccao, largo }: {
  value: FichaTrabalhadorDados;
  onChange: (value: FichaTrabalhadorDados) => void;
  /** Erros por caminho (ex.: "contactos_emergencia.0.nome"), de validarFicha(). */
  erros?: Record<string, string>;
  disabled?: boolean;
  /** Só esta secção (formulário em passos). Omisso = todas. */
  seccao?: SeccaoFicha;
  /** Contentor largo: 3 colunas em ecrãs grandes. */
  largo?: boolean;
}) {
  const ver = (s: SeccaoFicha) => !seccao || seccao === s;
  const set = <K extends keyof FichaTrabalhadorDados>(k: K, v: FichaTrabalhadorDados[K]) => onChange({ ...value, [k]: v });

  const setEstadoCivil = (estadoCivil: string) =>
    onChange({
      ...value,
      estado_civil: estadoCivil,
      conjuge: temConjuge(estadoCivil) ? value.conjuge ?? conjugeVazio() : null,
    });

  const setConjuge = (k: keyof FichaConjuge, v: string) =>
    set('conjuge', { ...(value.conjuge ?? conjugeVazio()), [k]: v });

  const setFilho = (i: number, k: keyof FichaFilho, v: string) =>
    set('filhos', value.filhos.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  const setContacto = (i: number, k: keyof FichaContactoEmergencia, v: string) =>
    set('contactos_emergencia', value.contactos_emergencia.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  const conjuge = value.conjuge ?? conjugeVazio();
  const hoje = hojeIso();
  const ha30Anos = `${new Date().getFullYear() - 30}-01-01`;
  const grid = cn('grid gap-4 sm:grid-cols-2', largo && 'lg:grid-cols-3');

  return (
    <fieldset disabled={disabled} className="space-y-5">
      {/* ===== Informação pessoal ===== */}
      {ver('pessoal') && (
      <Seccao icon={<User className="h-4 w-4" />} titulo="Informação pessoal">
        <div className={grid}>
          <FormField label="Nome completo" required error={erros.nome} className="sm:col-span-2">
            <Input value={value.nome} onChange={(e) => set('nome', e.target.value)} error={erros.nome} autoComplete="name" />
          </FormField>
          <FormField label="Data de início" required error={erros.data_inicio}>
            <DateInput value={value.data_inicio} onChange={(v) => set('data_inicio', v)} disabled={disabled} />
          </FormField>
          <FormField label="Número do BI" required error={erros.numero_bi}>
            <Input value={value.numero_bi} onChange={(e) => set('numero_bi', e.target.value.toUpperCase())} error={erros.numero_bi} placeholder="Ex.: 001234567LA041" />
          </FormField>
          <FormField label="Função" required error={erros.funcao}>
            <Input value={value.funcao} onChange={(e) => set('funcao', e.target.value)} error={erros.funcao} />
          </FormField>
          <FormField label="Sexo" required error={erros.sexo}>
            <Select options={SEXOS} placeholder="Seleccione" value={value.sexo} onChange={(v) => set('sexo', v as FichaTrabalhadorDados['sexo'])} error={erros.sexo} disabled={disabled} />
          </FormField>
          <FormField label="Data de nascimento" required error={erros.data_nascimento}>
            <DateInput value={value.data_nascimento} onChange={(v) => set('data_nascimento', v)} disabled={disabled} {...NASCIMENTO_ADULTO} maximo={hoje} mesPadrao={ha30Anos} />
          </FormField>
          <FormField label="Local de nascimento" required error={erros.local_nascimento}>
            <Input value={value.local_nascimento} onChange={(e) => set('local_nascimento', e.target.value)} error={erros.local_nascimento} placeholder="Município / Província" />
          </FormField>
          <FormField label="Estado civil" required error={erros.estado_civil}>
            <Select options={ESTADOS_CIVIS} placeholder="Seleccione" value={value.estado_civil} onChange={setEstadoCivil} error={erros.estado_civil} disabled={disabled} />
          </FormField>
          <FormField label="Província" error={erros.provincia}>
            <Select options={PROVINCIAS} placeholder="Seleccione" value={value.provincia} onChange={(v) => set('provincia', v)} disabled={disabled} />
          </FormField>
          <FormField label="Morada" required error={erros.morada} className="sm:col-span-2">
            <Input value={value.morada} onChange={(e) => set('morada', e.target.value)} error={erros.morada} placeholder="Bairro, rua, nº de casa, município" autoComplete="street-address" />
          </FormField>
          <FormField label="Telemóvel" required error={erros.telemovel}>
            <Input type="tel" value={value.telemovel} onChange={(e) => set('telemovel', e.target.value)} error={erros.telemovel} placeholder="+244 9XX XXX XXX" autoComplete="tel" />
          </FormField>
          <FormField label="Telefone alternativo" error={erros.telefone}>
            <Input type="tel" value={value.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="+244 …" />
          </FormField>
          <FormField label="Endereço electrónico (email)" error={erros.email} className="sm:col-span-2">
            <Input type="email" value={value.email} onChange={(e) => set('email', e.target.value)} error={erros.email} autoComplete="email" />
          </FormField>
        </div>
      </Seccao>
      )}

      {/* ===== Dependentes — cônjuge ===== */}
      {ver('dependentes') && temConjuge(value.estado_civil) && (
        <Seccao icon={<Users className="h-4 w-4" />} titulo="Dados do cônjuge" descricao="Esposa / esposo ou companheiro(a) em união de facto.">
          <div className={grid}>
            <FormField label="Nome do cônjuge" required error={erros['conjuge.nome']} className="sm:col-span-2">
              <Input value={conjuge.nome} onChange={(e) => setConjuge('nome', e.target.value)} error={erros['conjuge.nome']} />
            </FormField>
            <FormField label="Data de nascimento" error={erros['conjuge.data_nascimento']}>
              <DateInput value={conjuge.data_nascimento} onChange={(v) => setConjuge('data_nascimento', v)} disabled={disabled} {...NASCIMENTO_ADULTO} maximo={hoje} mesPadrao={ha30Anos} />
            </FormField>
            <FormField label="Local de nascimento">
              <Input value={conjuge.local_nascimento} onChange={(e) => setConjuge('local_nascimento', e.target.value)} />
            </FormField>
            <FormField label="Endereço">
              <Input value={conjuge.endereco} onChange={(e) => setConjuge('endereco', e.target.value)} />
            </FormField>
            <FormField label="Província">
              <Select options={PROVINCIAS} placeholder="Seleccione" value={conjuge.provincia} onChange={(v) => setConjuge('provincia', v)} disabled={disabled} />
            </FormField>
            <FormField label="Telemóvel">
              <Input type="tel" value={conjuge.telemovel} onChange={(e) => setConjuge('telemovel', e.target.value)} placeholder="+244 9XX XXX XXX" />
            </FormField>
            <FormField label="Telefone alternativo" hint="Opcional.">
              <Input type="tel" value={conjuge.telefone} onChange={(e) => setConjuge('telefone', e.target.value)} placeholder="+244 …" />
            </FormField>
          </div>
        </Seccao>
      )}

      {/* ===== Dependentes — filhos ===== */}
      {ver('dependentes') && (
      <Seccao
        icon={<Baby className="h-4 w-4" />}
        titulo="Filhos (as)"
        descricao={value.filhos.length === 0 ? 'Sem filhos registados. Adicione se aplicável.' : undefined}
        accao={value.filhos.length < MAX_FILHOS && !disabled ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => set('filhos', [...value.filhos, filhoVazio()])}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        ) : undefined}
      >
        {value.filhos.length > 0 && (
          <div className={cn('grid gap-3', largo && 'lg:grid-cols-2')}>
            {value.filhos.map((f, i) => (
              <div key={i} className="rounded-lg border border-navy-100 bg-navy-50/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-navy-500">{i + 1}º filho(a)</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => set('filhos', value.filhos.filter((_, j) => j !== i))}
                      className="rounded-md p-1 text-error-400 hover:bg-error-50 hover:text-error-600"
                      aria-label={`Remover ${i + 1}º filho(a)`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Nome" required error={erros[`filhos.${i}.nome`]} className="sm:col-span-3">
                    <Input value={f.nome} onChange={(e) => setFilho(i, 'nome', e.target.value)} error={erros[`filhos.${i}.nome`]} />
                  </FormField>
                  <FormField label="Data de nascimento" required error={erros[`filhos.${i}.data_nascimento`]} className="sm:col-span-2">
                    <DateInput value={f.data_nascimento} onChange={(v) => setFilho(i, 'data_nascimento', v)} disabled={disabled} {...NASCIMENTO_FILHO} maximo={hoje} />
                  </FormField>
                  <FormField label="Telefone">
                    <Input type="tel" value={f.telefone} onChange={(e) => setFilho(i, 'telefone', e.target.value)} />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        )}
      </Seccao>
      )}

      {/* ===== Contactos em caso de emergência ===== */}
      {ver('emergencia') && (
      <Seccao icon={<Siren className="h-4 w-4" />} titulo="Contactos em caso de emergência" descricao="O primeiro contacto é obrigatório.">
        <div className={cn('grid gap-4', largo && 'lg:grid-cols-2 lg:gap-6')}>
          {value.contactos_emergencia.map((c, i) => {
            const k = (campo: string) => `contactos_emergencia.${i}.${campo}`;
            return (
              <div key={i} className={cn('grid content-start gap-4 sm:grid-cols-2', i > 0 && 'border-t border-navy-100 pt-4', i > 0 && largo && 'lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0')}>
                <p className="text-xs font-semibold text-navy-500 sm:col-span-2">
                  Contacto {i + 1}{i > 0 && <span className="font-normal text-navy-400"> (opcional)</span>}
                </p>
                <FormField label="Nome" required={i === 0} error={erros[k('nome')]}>
                  <Input value={c.nome} onChange={(e) => setContacto(i, 'nome', e.target.value)} error={erros[k('nome')]} />
                </FormField>
                <FormField label="Parentesco">
                  <Input value={c.parentesco} onChange={(e) => setContacto(i, 'parentesco', e.target.value)} placeholder="Ex.: Mãe, Irmão" />
                </FormField>
                <FormField label="Endereço" className="sm:col-span-2">
                  <Input value={c.endereco} onChange={(e) => setContacto(i, 'endereco', e.target.value)} />
                </FormField>
                <FormField label="Números de telefone" required={i === 0} error={erros[k('telefones')]}>
                  <Input type="tel" value={c.telefones} onChange={(e) => setContacto(i, 'telefones', e.target.value)} error={erros[k('telefones')]} placeholder="Separe vários por vírgula" />
                </FormField>
                <FormField label="Endereço electrónico" error={erros[k('email')]}>
                  <Input type="email" value={c.email} onChange={(e) => setContacto(i, 'email', e.target.value)} error={erros[k('email')]} />
                </FormField>
              </div>
            );
          })}
        </div>
      </Seccao>
      )}
    </fieldset>
  );
}
