import { useEffect, useState } from 'react';
import { DIRECCOES } from '@/lib/constants';
import { catalogosService, type Catalogos } from '@/src/services/catalogos.service';

const CATEGORIAS_BASE = [
  { value: 'gestao', label: 'Direção / Gestão' },
  { value: 'tecnicos', label: 'Técnicos' },
];

export function useCatalogo() {
  const [catalogo, setCatalogo] = useState<Catalogos | null>(null);

  useEffect(() => {
    let cancelado = false;
    catalogosService.list(true)
      .then((data) => { if (!cancelado) setCatalogo(data); })
      .catch(() => { if (!cancelado) setCatalogo(null); });
    return () => { cancelado = true; };
  }, []);

  const funcoes = catalogo?.funcoes.filter((f) => f.activo) ?? [];
  const direccoes = catalogo?.direccoes.filter((d) => d.activo) ?? [];
  const categorias = catalogo?.categorias.filter((c) => c.activo) ?? [];

  return {
    carregado: catalogo != null,
    funcaoOptions: funcoes.map((f) => ({ value: f.nome, label: f.nome })),
    direccaoOptions: catalogo
      ? direccoes.map((d) => ({ value: d.nome, label: d.nome }))
      : DIRECCOES.map((d) => ({ value: d, label: d })),
    categoriaOptions: catalogo
      ? categorias.map((c) => ({ value: c.slug, label: c.nome }))
      : CATEGORIAS_BASE,
  };
}
