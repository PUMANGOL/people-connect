import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { ChecklistItem } from '@/src/services/admissao.service';
import { enviarParaUrl } from '@/src/services/ficheiros.service';
import { ErroVisivel } from '@/src/lib/erro-pedido';

interface Portal {
  nome: string;
  funcao: string | null;
  itens: ChecklistItem[];
}

function tipoDe(file: File): string | null {
  const nome = file.name.toLowerCase();
  if (file.type === 'application/pdf' || nome.endsWith('.pdf')) return 'application/pdf';
  if (file.type === 'image/jpeg' || nome.endsWith('.jpg') || nome.endsWith('.jpeg')) return 'image/jpeg';
  if (file.type === 'image/png' || nome.endsWith('.png')) return 'image/png';
  if (file.type === 'image/webp' || nome.endsWith('.webp')) return 'image/webp';
  return null;
}

function etiqueta(item: ChecklistItem): { label: string; variant: 'neutral' | 'info' | 'success' | 'error' } {
  if (!item.submissao) return { label: 'Por entregar', variant: 'neutral' };
  if (item.submissao.estado === 'validado') return { label: 'Validado', variant: 'success' };
  if (item.submissao.estado === 'rejeitado') return { label: 'Para substituir', variant: 'error' };
  return { label: 'Entregue', variant: 'info' };
}

export default function CandidaturaDocumentosPage() {
  const { token } = useParams<{ token: string }>();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ficheiros, setFicheiros] = useState<Record<string, File | null>>({});
  const [avisos, setAvisos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    let activo = true;
    setACarregar(true);
    fetch(`/api/candidatura/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null) as { data?: Portal; error?: string } | null;
        if (!res.ok) throw new Error(body?.error || 'Este link já não está activo.');
        return body?.data ?? null;
      })
      .then((dados) => { if (activo) setPortal(dados); })
      .catch((err: Error) => { if (activo) setErro(err.message); })
      .finally(() => { if (activo) setACarregar(false); });
    return () => { activo = false; };
  }, [token]);

  async function entregar(item: ChecklistItem) {
    const file = ficheiros[item.id];
    if (!file || !token) return;
    const tipo = tipoDe(file);
    if (!tipo) {
      setAvisos((atual) => ({ ...atual, [item.id]: 'Use PDF, JPG, PNG ou WEBP.' }));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvisos((atual) => ({ ...atual, [item.id]: 'O ficheiro passa de 8 MB.' }));
      return;
    }
    setOcupado(item.id);
    setAvisos((atual) => ({ ...atual, [item.id]: '' }));
    try {
      const prep = await fetch(`/api/candidatura/${token}/envio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissao_documento_id: item.id,
          tipo,
          tamanho: file.size,
        }),
      });
      const prepBody = await prep.json().catch(() => null) as { data?: { url?: string }; error?: string } | null;
      if (!prep.ok || !prepBody?.data?.url) throw new Error(prepBody?.error || 'Não foi possível preparar o envio.');
      const enviado = await enviarParaUrl(prepBody.data.url, file);
      const res = await fetch(`/api/candidatura/${token}/submeter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admissao_documento_id: item.id,
          ficheiroId: enviado.id,
          nome: file.name,
        }),
      });
      const body = await res.json().catch(() => null) as { data?: { itens: ChecklistItem[] }; error?: string } | null;
      if (!res.ok) throw new Error(body?.error || 'Não foi possível entregar o documento.');
      setPortal((atual) => atual && body?.data ? { ...atual, itens: body.data.itens } : atual);
      setFicheiros((atual) => ({ ...atual, [item.id]: null }));
    } catch (err) {
      const msg = err instanceof ErroVisivel || err instanceof Error ? err.message : 'Não foi possível entregar o documento.';
      setAvisos((atual) => ({ ...atual, [item.id]: msg }));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#216A41]">Pumangol · Direcção de Pessoas e Cultura</p>
        <h1 className="mt-2 text-2xl font-bold text-[#0C2A1B]">Documentos da admissão</h1>
        {portal && (
          <p className="mt-1 text-sm text-navy-500">
            {portal.nome}{portal.funcao ? ` · ${portal.funcao}` : ''}
          </p>
        )}

        {aCarregar && <p className="mt-8 text-sm text-navy-400">A carregar a checklist…</p>}
        {erro && <p className="mt-8 rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm text-navy-600">{erro}</p>}

        {portal && (
          <ul className="mt-6 space-y-4">
            {portal.itens.map((item) => {
              const estado = etiqueta(item);
              const bloqueado = item.submissao?.estado === 'validado';
              return (
                <li key={item.id} className="rounded-xl border border-navy-100 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy-800">{item.nome}</p>
                      {item.descricao && <p className="mt-1 text-sm text-navy-500">{item.descricao}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={item.obrigatorio ? 'error' : 'neutral'}>{item.obrigatorio ? 'Obrigatório' : 'Opcional'}</Badge>
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </div>
                  </div>
                  {item.submissao?.ficheiro_nome && (
                    <p className="mt-2 text-xs text-navy-400">Ficheiro actual: {item.submissao.ficheiro_nome}</p>
                  )}
                  {item.submissao?.estado === 'rejeitado' && item.submissao.motivo && (
                    <p className="mt-2 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-600">{item.submissao.motivo}</p>
                  )}
                  {!bloqueado && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        key={item.submissao?.submetido_em ?? 'novo'}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        className="block w-full text-sm text-navy-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy-700"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setFicheiros((atual) => ({ ...atual, [item.id]: file }));
                          setAvisos((atual) => ({ ...atual, [item.id]: '' }));
                        }}
                      />
                      <Button
                        variant="primary"
                        loading={ocupado === item.id}
                        disabled={!ficheiros[item.id] || ocupado !== null}
                        leftIcon={<Upload className="h-4 w-4" />}
                        onClick={() => entregar(item)}
                      >
                        Entregar
                      </Button>
                    </div>
                  )}
                  {avisos[item.id] && <p className="mt-2 text-sm text-error-700">{avisos[item.id]}</p>}
                </li>
              );
            })}
            {!portal.itens.length && (
              <li className="rounded-xl border border-navy-100 bg-white px-4 py-6 text-sm text-navy-400">
                Ainda não há documentos pedidos nesta checklist.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
