-- Políticas e Procedimentos passa para o menu Geral e fica visível a todos os grupos.

UPDATE acesso
   SET nome = 'Políticas e Procedimentos',
       rota = '/politicas',
       modulo = 'Geral',
       perfis = ARRAY['rh_admin', 'mentor', 'novo_colaborador']::text[],
       ordem = CASE chave WHEN 'documentos-empresa' THEN 45 ELSE 46 END
 WHERE chave IN ('documentos-empresa', 'meus-documentos');

INSERT INTO grupo_acesso (grupo_id, acesso_id)
SELECT g.id, a.id
  FROM grupo g
  JOIN acesso a ON a.chave IN ('documentos-empresa', 'meus-documentos')
 WHERE g.chave IN ('administradores', 'mentores', 'colaboradores', 'mentorados')
ON CONFLICT DO NOTHING;
