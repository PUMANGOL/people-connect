-- Capa opcional do evento. Guarda um link externo ou o endereço da app
-- (/api/ficheiros?key=…) depois do envio para o Serviço de Ficheiros.

ALTER TABLE "eventos" ADD COLUMN IF NOT EXISTS "imagem" text;
