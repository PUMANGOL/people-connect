-- onboarding_notificacoes.tipo é text (0000 e db/schema.ts). Algumas BDs têm-no como enum
-- tipo_notificacao_onboarding sem os tipos da comunidade, o que fazia falhar as notificações de
-- publicações e comentários. Passa a text; onde já é text não faz nada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'onboarding_notificacoes'
       AND column_name = 'tipo' AND udt_name = 'tipo_notificacao_onboarding'
  ) THEN
    ALTER TABLE "onboarding_notificacoes" ALTER COLUMN "tipo" TYPE text USING "tipo"::text;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_notificacao_onboarding')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE udt_name = 'tipo_notificacao_onboarding') THEN
    DROP TYPE tipo_notificacao_onboarding;
  END IF;
END $$;
