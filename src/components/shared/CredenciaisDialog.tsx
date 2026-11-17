import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Dialog } from '@/src/components/ui/dialog';
import { toast } from '@/src/store';

/** Copia texto para a área de transferência; fallback para contextos sem Clipboard API (HTTP). */
async function copiarTexto(texto: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('Cópia não suportada');
}

/** Botão pequeno de cópia: ícone de copiar → check durante 2s depois de copiar. */
function BotaoCopiar({ valor, rotulo }: { valor: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = window.setTimeout(() => setCopiado(false), 2000);
    return () => window.clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await copiarTexto(valor);
      setCopiado(true);
    } catch {
      toast.error('Não foi possível copiar', `Seleccione e copie ${rotulo === 'email' ? 'o email' : 'a password'} manualmente.`);
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? 'Copiado' : `Copiar ${rotulo}`}
      aria-label={copiado ? "Copiado" : `Copiar ${rotulo}`}
      className="shrink-0 rounded p-1 text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
    >
      {copiado ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Credenciais de acesso acabadas de criar — a password só é mostrada uma vez. */
export function CredenciaisDialog({ titulo, descricao, credenciais, onClose }: {
  titulo: string;
  descricao: string;
  credenciais: { email: string; password: string };
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={onClose}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50">
          <KeyRound className="h-5 w-5 text-gold-600" />
        </div>
        <h2 className="text-lg font-semibold text-navy-800">{titulo}</h2>
      </div>
      <p className="mb-4 text-sm text-navy-500">{descricao}</p>
      <div className="space-y-2 rounded-lg bg-navy-50 p-4 text-sm">
        <p className="flex items-center gap-1.5">
          <span className="text-navy-400">Email:</span>
          <strong className="min-w-0 break-all text-navy-800">{credenciais.email}</strong>
          <BotaoCopiar valor={credenciais.email} rotulo="email" />
        </p>
        <p className="flex items-center gap-1.5">
          <span className="text-navy-400">Password:</span>
          <strong className="min-w-0 break-all text-navy-800">{credenciais.password}</strong>
          <BotaoCopiar valor={credenciais.password} rotulo="password" />
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="accent" onClick={onClose}>Copiei as credenciais</Button>
      </div>
    </Dialog>
  );
}
