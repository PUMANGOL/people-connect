import { useEffect, useState, type ComponentType } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Mail, Briefcase, Building2, CalendarDays, Megaphone, MessageCircle, Network, ThumbsUp, UserX, Phone, MapPin,
} from 'lucide-react';
import { Avatar } from '@/src/components/ui/badge';
import { ArvoreEstrutura, ListaColegas, temEstrutura } from '@/src/components/EstruturaOrganica';
import { SkeletonCard } from '@/src/components/ui/skeleton';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import { pessoasService, PERFIL_LABEL, type PessoaPerfil } from '@/src/services/pessoas.service';
import { DISPONIBILIDADE } from '@/src/services/perfil.service';

/** Texto simples a partir do HTML das publicações (só para pré-visualização). */
function textoSimples(html: string, max = 140): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const t = (div.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export default function PerfilPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<PessoaPerfil | null>(null);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'erro'>('loading');

  useEffect(() => {
    let cancelado = false;
    setEstado('loading');
    pessoasService
      .perfil(id)
      .then((p) => {
        if (cancelado) return;
        setPerfil(p);
        setEstado('ok');
      })
      .catch(() => !cancelado && setEstado('erro'));
    return () => {
      cancelado = true;
    };
  }, [id]);

  const voltar = (
    <button
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-sm text-navy-500 hover:text-navy-800"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar
    </button>
  );

  if (estado === 'loading') {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {voltar}
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (estado === 'erro' || !perfil) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {voltar}
        <div className="rounded-xl border border-dashed border-navy-200 bg-white p-10 text-center">
          <UserX className="mx-auto h-8 w-8 text-navy-300" />
          <p className="mt-3 text-sm text-navy-500">Perfil não encontrado.</p>
        </div>
      </div>
    );
  }

  const comEstrutura = temEstrutura(perfil.estrutura);
  const detalhes: Array<{ icon: ComponentType<{ className?: string }>; label: string; valor: string | null }> = [
    { icon: Mail, label: 'Email', valor: perfil.email },
    { icon: Phone, label: 'Extensão', valor: perfil.extensao },
    { icon: MapPin, label: 'Localização', valor: perfil.localizacao },
    { icon: Briefcase, label: 'Função', valor: perfil.funcao },
    { icon: Building2, label: 'Local de trabalho', valor: comEstrutura ? null : perfil.area },
    { icon: CalendarDays, label: 'Na Pumangol desde', valor: perfil.data_admissao ? formatDate(perfil.data_admissao) : null },
  ];

  const estatisticas = [
    { icon: Megaphone, label: 'Publicações', valor: perfil.estatisticas.publicacoes },
    { icon: MessageCircle, label: 'Comentários', valor: perfil.estatisticas.comentarios },
    { icon: ThumbsUp, label: 'Gostos dados', valor: perfil.estatisticas.gostos },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {voltar}

      {/* Cabeçalho do perfil */}
      <div className="overflow-hidden rounded-xl border border-navy-100 bg-white">
        <div className="h-28 bg-navy-800 sm:h-36">
          {perfil.capa_url && <img src={perfil.capa_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="px-6 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar
              name={perfil.nome}
              src={perfil.foto_url}
              size="lg"
              className="-mt-10 w-fit [&>div]:h-20 [&>div]:w-20 [&>div]:text-2xl [&>div]:ring-4 [&>div]:ring-white [&>img]:h-20 [&>img]:w-20 [&>img]:ring-4 [&>img]:ring-white"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-navy-900">{perfil.nome}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-semibold text-navy-700">
                  {PERFIL_LABEL[perfil.perfil] ?? perfil.perfil}
                </span>
                {perfil.funcao && <span className="text-sm text-navy-500">{perfil.funcao}</span>}
                {perfil.disponibilidade && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-navy-500">
                    <span className={cn('h-2 w-2 rounded-full', DISPONIBILIDADE[perfil.disponibilidade].ponto)} />
                    {DISPONIBILIDADE[perfil.disponibilidade].label}
                  </span>
                )}
                {!perfil.activo && (
                  <span className="rounded-full bg-error-50 px-2.5 py-0.5 text-xs font-semibold text-error-600">Conta inactiva</span>
                )}
              </div>
            </div>
          </div>
          {perfil.bio && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-navy-600">{perfil.bio}</p>}
          {(perfil.posso_ajudar.length > 0 || perfil.interesses.length > 0) && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {perfil.posso_ajudar.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-navy-500">Pode ajudar com</p>
                  <div className="flex flex-wrap gap-1.5">
                    {perfil.posso_ajudar.map((t) => (
                      <span key={t} className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {perfil.interesses.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-navy-500">Interesses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {perfil.interesses.map((t) => (
                      <span key={t} className="rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-700">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          {/* Dados */}
          <div className="rounded-xl border border-navy-100 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy-800">Informação</h2>
            <dl className="space-y-4">
              {detalhes.filter((d) => d.valor).map((d) => (
                <div key={d.label} className="flex items-start gap-3">
                  <d.icon className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />
                  <div className="min-w-0">
                    <dt className="text-xs text-navy-400">{d.label}</dt>
                    <dd className="break-words text-sm text-navy-800">
                      {d.label === 'Email' ? (
                        <a href={`mailto:${d.valor}`} className="hover:underline">{d.valor}</a>
                      ) : d.valor}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          {comEstrutura && (
            <div className="rounded-xl border border-navy-100 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-800">
                <Network className="h-4 w-4 text-navy-400" /> Estrutura organizacional
              </h2>
              <ArvoreEstrutura estrutura={perfil.estrutura} nome={perfil.nome} fotoUrl={perfil.foto_url} />
              {perfil.estrutura.colegas.pessoas.length > 0 && (
                <div className="mt-5 border-t border-navy-50 pt-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
                    {perfil.estrutura.colegas.ambito === 'unidade' ? 'Na mesma unidade' : 'Na mesma direcção'}
                  </h3>
                  <ListaColegas estrutura={perfil.estrutura} vazio="" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comunidade */}
        <div className="rounded-xl border border-navy-100 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-800">Na Comunidade</h2>
          <div className="grid grid-cols-3 gap-3">
            {estatisticas.map((e) => (
              <div key={e.label} className="rounded-lg bg-navy-50 px-3 py-3 text-center">
                <e.icon className="mx-auto h-4 w-4 text-navy-500" />
                <p className="mt-1 text-xl font-bold text-navy-900">{e.valor}</p>
                <p className="text-[11px] text-navy-500">{e.label}</p>
              </div>
            ))}
          </div>

          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-navy-400">Actividade recente</h3>
          {perfil.actividade.length === 0 ? (
            <p className="text-sm text-navy-400">Sem actividade na comunidade.</p>
          ) : (
            <ul className="divide-y divide-navy-50">
              {perfil.actividade.map((a, i) => (
                <li key={`${a.tipo}-${a.post_id}-${i}`}>
                  <Link to={`/inicio/publicacao/${a.post_id}`} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-3 hover:bg-navy-50">
                    {a.tipo === 'publicacao'
                      ? <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                      : <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-navy-400" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-navy-400">
                        {a.tipo === 'publicacao' ? 'Publicou' : `Comentou${a.titulo ? ` em «${a.titulo}»` : ''}`}
                        {' · '}{formatRelativeTime(a.created_at)}
                      </p>
                      <p className="mt-0.5 text-sm text-navy-700">
                        {a.tipo === 'publicacao' && a.titulo ? a.titulo : textoSimples(a.texto)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
