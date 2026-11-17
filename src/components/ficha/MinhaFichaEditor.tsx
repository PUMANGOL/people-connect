import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Save, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { SkeletonList } from '@/src/components/ui/skeleton';
import { toast } from '@/src/store';
import { cn } from '@/lib/utils';
import { FichaTrabalhadorForm, SECCOES_FICHA, seccaoDoErro, type SeccaoFicha } from './FichaTrabalhadorForm';
import { fichaTrabalhadorService, errosDaResposta } from '@/src/services/ficha-trabalhador.service';
import { validarFicha, type FichaTrabalhador, type FichaTrabalhadorDados } from '@/lib/ficha-trabalhador';

function dadosDe(f: FichaTrabalhador): FichaTrabalhadorDados {
  const { colaborador_id: _c, estado: _e, submetida_em: _s, updated_at: _u, ...dados } = f;
  return dados;
}

/** Leva o ecrã ao primeiro campo com erro. */
function focarPrimeiroErro() {
  requestAnimationFrame(() => {
    document.querySelector('[aria-invalid="true"], .border-error-500')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function errosDaSeccao(erros: Record<string, string>, seccao: SeccaoFicha): Record<string, string> {
  return Object.fromEntries(Object.entries(erros).filter(([k]) => seccaoDoErro(k) === seccao));
}

/**
 * A ficha do próprio colaborador, em passos (tabs): carrega, guarda rascunho e submete.
 * Usado no Welcome Flow (1º passo) e na página "A Minha Ficha".
 */
export function MinhaFichaEditor({ submitLabel = 'Submeter ficha', onSubmetida, largo }: {
  submitLabel?: string;
  onSubmetida?: (ficha: FichaTrabalhador) => void;
  /** Contentor largo: formulário em 3 colunas em ecrãs grandes. */
  largo?: boolean;
}) {
  const [ficha, setFicha] = useState<FichaTrabalhador | null>(null);
  const [dados, setDados] = useState<FichaTrabalhadorDados | null>(null);
  const [passo, setPasso] = useState<SeccaoFicha>('pessoal');
  // Secções em que já se tentou avançar/submeter: só aí se mostram os erros.
  const [tentadas, setTentadas] = useState<SeccaoFicha[]>([]);
  // Secções já visitadas e deixadas: só essas recebem o check de completas.
  const [visitadas, setVisitadas] = useState<SeccaoFicha[]>([]);
  const [errosServidor, setErrosServidor] = useState<Record<string, string>>({});
  const [aGuardar, setAGuardar] = useState<'rascunho' | 'submeter' | null>(null);
  const [erroCarregar, setErroCarregar] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fichaTrabalhadorService
      .minha()
      .then((f) => {
        if (cancelado) return;
        setFicha(f);
        setDados(dadosDe(f));
      })
      .catch(() => !cancelado && setErroCarregar(true));
    return () => {
      cancelado = true;
    };
  }, []);

  const errosTodos = useMemo(() => (dados ? validarFicha(dados) : {}), [dados]);
  const erros = useMemo(() => {
    const visiveis = Object.fromEntries(Object.entries(errosTodos).filter(([k]) => tentadas.includes(seccaoDoErro(k))));
    return { ...errosServidor, ...visiveis };
  }, [errosTodos, errosServidor, tentadas]);

  const indice = SECCOES_FICHA.findIndex((s) => s.key === passo);
  const ultimo = indice === SECCOES_FICHA.length - 1;

  function irPara(s: SeccaoFicha) {
    setVisitadas((v) => (v.includes(passo) ? v : [...v, passo]));
    setPasso(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function alterar(novo: FichaTrabalhadorDados) {
    setDados(novo);
    if (Object.keys(errosServidor).length > 0) setErrosServidor({});
  }

  function seguinte() {
    setTentadas((t) => (t.includes(passo) ? t : [...t, passo]));
    if (Object.keys(errosDaSeccao(errosTodos, passo)).length > 0) {
      toast.error('Passo incompleto', 'Preencha os campos obrigatórios assinalados.');
      focarPrimeiroErro();
      return;
    }
    irPara(SECCOES_FICHA[indice + 1].key);
  }

  async function guardar(submeter: boolean) {
    if (!dados) return;
    if (submeter) {
      setTentadas(SECCOES_FICHA.map((s) => s.key));
      const chaves = Object.keys(errosTodos);
      if (chaves.length > 0) {
        toast.error('Ficha incompleta', 'Preencha os campos obrigatórios assinalados.');
        irPara(seccaoDoErro(chaves[0]));
        focarPrimeiroErro();
        return;
      }
    }
    setAGuardar(submeter ? 'submeter' : 'rascunho');
    try {
      const f = await fichaTrabalhadorService.guardarMinha(dados, submeter);
      setFicha(f);
      setDados(dadosDe(f));
      if (submeter) {
        toast.success('Ficha submetida', 'Os seus dados foram enviados à DPC. Obrigado!');
        onSubmetida?.(f);
      } else {
        toast.success('Rascunho guardado', 'Pode continuar mais tarde.');
      }
    } catch (err) {
      const e = errosDaResposta(err);
      if (e) {
        setErrosServidor(e);
        const primeira = Object.keys(e)[0];
        if (primeira) irPara(seccaoDoErro(primeira));
        toast.error('Ficha incompleta', 'Preencha os campos obrigatórios assinalados.');
        focarPrimeiroErro();
      } else {
        toast.error('Não foi possível guardar a ficha');
      }
    } finally {
      setAGuardar(null);
    }
  }

  if (erroCarregar) {
    return <p className="py-8 text-center text-sm text-navy-500">Não foi possível carregar a ficha. Tente novamente mais tarde.</p>;
  }
  if (!ficha || !dados) return <SkeletonList rows={6} cols={2} />;

  const submetida = ficha.estado === 'submetida';

  return (
    <div className="space-y-5">
      {/* ===== Passos (tabs horizontais) ===== */}
      <div role="tablist" aria-label="Passos da ficha" className="grid grid-cols-3 gap-2 rounded-xl bg-navy-50 p-1.5">
        {SECCOES_FICHA.map((s, i) => {
          const activo = s.key === passo;
          const comErro = Object.keys(errosDaSeccao(erros, s.key)).length > 0;
          // Completo = já visitado (ou ficha submetida) e sem campos obrigatórios em falta.
          const completo = !comErro
            && (submetida || visitadas.includes(s.key))
            && Object.keys(errosDaSeccao(errosTodos, s.key)).length === 0;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => irPara(s.key)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-all sm:justify-start sm:px-4',
                activo ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500 hover:bg-white/60 hover:text-navy-700',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  comErro
                    ? 'bg-error-500 text-white'
                    : completo
                    ? 'bg-success-500 text-white'
                    : activo
                    ? 'bg-navy-700 text-white'
                    : 'bg-navy-200 text-navy-600',
                )}
              >
                {completo && !comErro ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden truncate sm:inline">{s.titulo}</span>
            </button>
          );
        })}
      </div>
      <p className="-mt-2 text-center text-xs text-navy-400 sm:hidden">{SECCOES_FICHA[indice].titulo}</p>

      {passo === 'pessoal' && (
        <div className="flex items-start gap-3 rounded-xl border border-info-200 bg-info-50 p-4 text-sm text-navy-700">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-info-600" />
          <p>
            Estes dados são confidenciais e usados apenas pela Direcção de Pessoas e Cultura para o seu processo de admissão.
            Os campos com <span className="text-error-500">*</span> são obrigatórios.
          </p>
        </div>
      )}

      <FichaTrabalhadorForm
        value={dados}
        onChange={alterar}
        erros={erros}
        disabled={aGuardar !== null}
        seccao={passo}
        largo={largo}
      />

      {/* ===== Navegação ===== */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-3 rounded-xl border border-navy-100 bg-white/95 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-navy-400">
          {submetida && ficha.submetida_em
            ? `Submetida em ${new Date(ficha.submetida_em).toLocaleString('pt-PT')}. Pode corrigir e submeter de novo.`
            : ficha.updated_at
            ? `Rascunho guardado em ${new Date(ficha.updated_at).toLocaleString('pt-PT')}.`
            : `Passo ${indice + 1} de ${SECCOES_FICHA.length}`}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          {indice > 0 && (
            <Button variant="ghost" onClick={() => irPara(SECCOES_FICHA[indice - 1].key)} disabled={aGuardar !== null}>
              <ArrowLeft className="h-4 w-4" /> Anterior
            </Button>
          )}
          {!submetida && (
            <Button variant="secondary" onClick={() => guardar(false)} loading={aGuardar === 'rascunho'} disabled={aGuardar !== null}>
              <Save className="h-4 w-4" /> Guardar rascunho
            </Button>
          )}
          {ultimo ? (
            <Button variant="accent" onClick={() => guardar(true)} loading={aGuardar === 'submeter'} disabled={aGuardar !== null}>
              <Send className="h-4 w-4" /> {submetida ? 'Submeter alterações' : submitLabel}
            </Button>
          ) : (
            <Button variant="accent" onClick={seguinte} disabled={aGuardar !== null}>
              Seguinte <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
