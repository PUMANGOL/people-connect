import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Avatar } from '@/src/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Estrutura, PessoaEstrutura } from '@/src/services/pessoas.service';

export function temEstrutura(e: Estrutura): boolean {
  return Boolean(e.direccao || e.unidade);
}

function LinhaPessoa({ pessoa }: { pessoa: PessoaEstrutura }) {
  return (
    <Link to={`/perfil/${pessoa.id}`} className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-navy-50">
      <Avatar name={pessoa.nome} src={pessoa.foto_url} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-navy-800">{pessoa.nome}</p>
        {pessoa.funcao && <p className="truncate text-xs text-navy-400">{pessoa.funcao}</p>}
      </div>
    </Link>
  );
}

type No = { chave: string; rotulo: string; conteudo: ReactNode; destaque?: boolean };

/** Pumangol › Direcção › Unidade › pessoa, com quem dirige a direcção e o local de trabalho. */
export function ArvoreEstrutura({
  estrutura,
  nome,
  fotoUrl,
  proprio = false,
}: {
  estrutura: Estrutura;
  nome: string;
  fotoUrl: string | null;
  proprio?: boolean;
}) {
  const nos: No[] = [
    { chave: 'org', rotulo: 'Organização', conteudo: <p className="text-sm font-medium text-navy-800">Pumangol</p> },
  ];
  if (estrutura.direccao) {
    nos.push({
      chave: 'direccao',
      rotulo: 'Direcção',
      conteudo: (
        <>
          <p className="text-sm font-medium text-navy-800">{estrutura.direccao}</p>
          {estrutura.lideranca.length > 0 && (
            <div className="mt-1.5">
              {estrutura.lideranca.map((l) => <LinhaPessoa key={l.id} pessoa={l} />)}
            </div>
          )}
        </>
      ),
    });
  }
  if (estrutura.unidade) {
    nos.push({
      chave: 'unidade',
      rotulo: 'Unidade',
      conteudo: <p className="text-sm font-medium text-navy-800">{estrutura.unidade}</p>,
    });
  }
  nos.push({
    chave: 'pessoa',
    rotulo: proprio ? 'A tua posição' : 'Posição',
    destaque: true,
    conteudo: (
      <div className="flex items-center gap-2.5">
        <Avatar name={nome} src={fotoUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">{nome}</p>
          {estrutura.cargo && <p className="truncate text-xs text-navy-500">{estrutura.cargo}</p>}
        </div>
      </div>
    ),
  });

  const local = [estrutura.local_trabalho, estrutura.cidade].filter(Boolean).join(' · ');

  return (
    <div>
      <ol>
        {nos.map((no, i) => (
          <li key={no.chave} className={cn('relative pl-7', i < nos.length - 1 && 'pb-5')}>
            {i < nos.length - 1 && (
              <span aria-hidden className="absolute -bottom-1 left-[7px] top-[19px] w-px bg-navy-100" />
            )}
            <span
              aria-hidden
              className={cn(
                'absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2',
                no.destaque ? 'border-gold-500 bg-gold-500' : 'border-navy-200 bg-white',
              )}
            />
            <p className="text-[11px] font-medium uppercase tracking-wide text-navy-400">{no.rotulo}</p>
            <div className="mt-0.5">{no.conteudo}</div>
          </li>
        ))}
      </ol>
      {local && (
        <p className="mt-4 flex items-center gap-1.5 border-t border-navy-50 pt-3 text-xs text-navy-500">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-navy-400" />
          {local}
        </p>
      )}
    </div>
  );
}

export function ListaColegas({ estrutura, vazio }: { estrutura: Estrutura; vazio: string }) {
  const { colegas } = estrutura;
  if (colegas.pessoas.length === 0) return <p className="text-sm text-navy-500">{vazio}</p>;
  const resto = colegas.total - colegas.pessoas.length;
  return (
    <>
      <ul className="space-y-0.5">
        {colegas.pessoas.map((p) => (
          <li key={p.id}><LinhaPessoa pessoa={p} /></li>
        ))}
      </ul>
      {resto > 0 && (
        <p className="mt-2 text-xs text-navy-400">
          E mais {resto} {resto === 1 ? 'colega' : 'colegas'} na {colegas.ambito === 'unidade' ? 'unidade' : 'direcção'}.
        </p>
      )}
    </>
  );
}
