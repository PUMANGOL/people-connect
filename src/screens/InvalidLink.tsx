import { LinkIcon } from 'lucide-react';

export default function InvalidLink() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-warning-50 text-warning-500 flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Link Inválido ou Expirado</h1>
        <p className="text-muted-foreground mb-4">
          O link de acesso ao onboarding é inválido ou não foi possível validá-lo.
        </p>
        <p className="text-sm text-muted-foreground">
          Se recebeu este link por email e está a ter dificuldades, contacte a equipa de RH em{' '}
          <a href="mailto:dpc@pumangol.ao" className="text-gold-600 font-medium hover:underline">
            dpc@pumangol.ao
          </a>
          .
        </p>
      </div>
    </div>
  );
}
