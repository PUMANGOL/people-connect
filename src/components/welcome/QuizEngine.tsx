import { useState } from 'react';
import { Check, X, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { ProgressBar } from '@/src/components/ui/badge';
import { cn } from '@/lib/utils';
import type { QuizPergunta, QuizResultadoDetalhe } from '@/src/services/onboarding-v2.service';
import { motion, AnimatePresence } from 'motion/react';

interface QuizEngineProps {
  perguntas: QuizPergunta[];
  onFinish: (result: { total: number; acertos: number; detalhes: QuizResultadoDetalhe[] }) => void;
}

export function QuizEngine({ perguntas, onFinish }: QuizEngineProps) {
  const [idx, setIdx] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [revelado, setRevelado] = useState(false);
  const [detalhes, setDetalhes] = useState<QuizResultadoDetalhe[]>([]);

  const pergunta = perguntas[idx];
  const isInformativa = pergunta.tipo === 'informativa';
  const opcoes = pergunta.tipo === 'verdadeiro_falso' ? ['Verdadeiro', 'Falso'] : pergunta.opcoes;

  function responder(i: number) {
    if (revelado || isInformativa) return;
    setEscolha(i);
    setRevelado(true);
  }

  function avancar() {
    const correcta = isInformativa ? true : escolha === pergunta.resposta_correcta;
    const novoDetalhe: QuizResultadoDetalhe = {
      pergunta_id: pergunta.id,
      escolha: isInformativa ? null : escolha,
      correcta,
    };
    const novos = [...detalhes, novoDetalhe];

    if (idx + 1 >= perguntas.length) {
      const escoraveis = novos.filter((_, k) => perguntas[k].tipo !== 'informativa');
      const total = escoraveis.length;
      const acertos = escoraveis.filter((d) => d.correcta).length;
      onFinish({ total, acertos, detalhes: novos });
      return;
    }
    setDetalhes(novos);
    setIdx((n) => n + 1);
    setEscolha(null);
    setRevelado(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-navy-400">
          <span>Pergunta {idx + 1} de {perguntas.length}</span>
          <span>{Math.round(((idx) / perguntas.length) * 100)}%</span>
        </div>
        <ProgressBar value={Math.round((idx / perguntas.length) * 100)} size="sm" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pergunta.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card"
        >
          {isInformativa && (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-info-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-info-600">
              <Info className="h-3.5 w-3.5" /> Sabia que…
            </div>
          )}
          <h3 className="text-lg font-semibold text-navy-900">{pergunta.pergunta}</h3>

          {!isInformativa && (
            <div className="mt-5 space-y-2.5">
              {opcoes.map((op, i) => {
                const isCorrect = i === pergunta.resposta_correcta;
                const isChosen = i === escolha;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={revelado}
                    onClick={() => responder(i)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                      !revelado && 'border-navy-100 hover:border-gold-300 hover:bg-gold-50',
                      revelado && isCorrect && 'border-success-500 bg-success-50 text-success-700',
                      revelado && isChosen && !isCorrect && 'border-error-500 bg-error-50 text-error-600',
                      revelado && !isChosen && !isCorrect && 'border-navy-100 opacity-60'
                    )}
                  >
                    {op}
                    {revelado && isCorrect && <Check className="h-4 w-4 text-success-600" />}
                    {revelado && isChosen && !isCorrect && <X className="h-4 w-4 text-error-500" />}
                  </button>
                );
              })}
            </div>
          )}

          {revelado && pergunta.explicacao && (
            <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-600">
              {pergunta.explicacao}
            </p>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="accent" disabled={!isInformativa && !revelado} onClick={avancar}>
              <span className="inline-flex items-center gap-1.5">
                {idx + 1 >= perguntas.length ? 'Concluir' : 'Seguinte'}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
