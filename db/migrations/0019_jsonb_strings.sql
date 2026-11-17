-- Valores jsonb gravados como string JSON (JSON.stringify sem ::text era codificado duas vezes
-- pelo driver) passam a objecto/array. Só converte strings cujo conteúdo é um objecto ou array
-- JSON válido; qualquer outra string fica como está. Pode correr mais de uma vez.
DO $$
DECLARE
  col record;
  linha record;
  valor jsonb;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.data_type = 'jsonb' AND t.table_type = 'BASE TABLE'
  LOOP
    FOR linha IN EXECUTE format(
      'SELECT ctid, %1$I AS v FROM %2$I WHERE jsonb_typeof(%1$I) = ''string''',
      col.column_name, col.table_name
    ) LOOP
      valor := linha.v;
      BEGIN
        WHILE jsonb_typeof(valor) = 'string' LOOP
          valor := (valor #>> '{}')::jsonb;
        END LOOP;
      EXCEPTION WHEN others THEN
        valor := NULL;
      END;
      IF jsonb_typeof(valor) IN ('object', 'array') THEN
        EXECUTE format('UPDATE %I SET %I = $1 WHERE ctid = $2', col.table_name, col.column_name)
          USING valor, linha.ctid;
      END IF;
    END LOOP;
  END LOOP;
END $$;
