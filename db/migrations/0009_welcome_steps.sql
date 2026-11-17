-- Welcome Flow configurável no admin: activar/desactivar cada vídeo sem o apagar,
-- ordenar os passos (arrastar e soltar) e desligar o quiz.

ALTER TABLE "welcome_videos" ADD COLUMN IF NOT EXISTS "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "welcome_videos" ADD COLUMN IF NOT EXISTS "ordem" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Ordem inicial = sequência que estava fixa no código (PCE → HSE → 4 DPC → extras por data de criação).
UPDATE "welcome_videos" w SET "ordem" = o.n
FROM (
  SELECT slot, ROW_NUMBER() OVER (
    ORDER BY CASE slot
      WHEN 'institucional'      THEN 1
      WHEN 'hse'                THEN 2
      WHEN 'saude_seguranca'    THEN 2
      WHEN 'dpc_beneficios'     THEN 3
      WHEN 'dpc_avaliacao'      THEN 4
      WHEN 'dpc_saude_bemestar' THEN 5
      WHEN 'dpc_formacao'       THEN 6
      ELSE 7
    END, slot
  ) AS n
  FROM "welcome_videos"
) o
WHERE w.slot = o.slot;--> statement-breakpoint

ALTER TABLE "quiz_config" ADD COLUMN IF NOT EXISTS "quiz_ativo" boolean DEFAULT true NOT NULL;
