import { FormField, Input } from '@/src/components/ui/input';
import { tempoExperiencia } from '@/src/lib/tempo-experiencia';

const campoClass =
  'disabled:cursor-default disabled:opacity-100 disabled:bg-navy-50 disabled:text-navy-800';

export function MentorFichaCampos({
  email,
  departamento,
  funcao,
  dataInicioContrato,
}: {
  email?: string | null;
  departamento?: string | null;
  funcao?: string | null;
  dataInicioContrato?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Email" className="sm:col-span-2">
        <Input value={email ?? ''} disabled className={campoClass} />
      </FormField>
      <FormField label="Direção / Departamento">
        <Input value={departamento ?? ''} disabled className={campoClass} />
      </FormField>
      <FormField label="Função">
        <Input value={funcao ?? ''} disabled className={campoClass} />
      </FormField>
      <FormField label="Tempo de experiência" className="sm:col-span-2">
        <Input value={tempoExperiencia(dataInicioContrato) ?? ''} disabled className={campoClass} />
      </FormField>
    </div>
  );
}
