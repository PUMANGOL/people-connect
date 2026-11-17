import { MinhaFichaEditor } from '@/src/components/ficha/MinhaFichaEditor';

/** "A Minha Ficha" — o colaborador consulta e corrige a ficha preenchida no Welcome Flow. */
export default function FichaTrabalhadorPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">Ficha do Trabalhador</h1>
        <p className="mt-1 text-sm text-navy-400">
          Os seus dados pessoais, dependentes e contactos de emergência. Mantenha-os actualizados — a DPC é notificada a cada submissão.
        </p>
      </div>
      <MinhaFichaEditor />
    </div>
  );
}
