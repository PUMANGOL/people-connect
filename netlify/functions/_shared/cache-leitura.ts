import { revalidateTag, unstable_cache } from 'next/cache';

/** Leituras de colaboradores. As escritas chamam invalidarColaboradores(). */
export const TAG_COLABORADORES = 'colaboradores';
/** Lista de mentores. Só sai do cache quando os dados mudam. */
export const TAG_MENTORES = 'mentores';

const REVALIDAR_SEGUNDOS = 180;

type OpcoesCache = {
  revalidate?: number | false;
  tags?: string[];
};

/** O cache do Next fica em disco: sem a base na chave, trocar DATABASE_URL serviria dados da base anterior. */
function chaveBase(): string {
  try {
    const url = new URL(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || '');
    return `${url.hostname}:${url.port}${url.pathname}`;
  } catch {
    return '';
  }
}

/** Resultado JSON, partilhado entre pedidos. A autenticação fica fora desta função. */
export function emCache<T>(key: string[], fn: () => Promise<T>, opcoes?: OpcoesCache): Promise<T> {
  return unstable_cache(
    async () => JSON.parse(JSON.stringify(await fn())) as T,
    [chaveBase(), ...key],
    {
      revalidate: opcoes?.revalidate ?? REVALIDAR_SEGUNDOS,
      tags: opcoes?.tags ?? [TAG_COLABORADORES],
    },
  )();
}

export function invalidarColaboradores(): void {
  revalidateTag(TAG_COLABORADORES);
}

export function invalidarMentores(): void {
  revalidateTag(TAG_MENTORES);
}
