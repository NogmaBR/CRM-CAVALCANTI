-- Categorias base (conforme análise dos MDs)
INSERT INTO categorias (nome, cor, icone) VALUES
  ('Material', '#E8A317', 'package'),
  ('Elétrica', '#3B82F6', 'zap'),
  ('Hidráulica', '#0EA5E9', 'droplet'),
  ('Limpeza', '#10B981', 'sparkles'),
  ('Entulho', '#78716C', 'trash-2'),
  ('Mão de obra', '#8B5CF6', 'users'),
  ('Equipamentos', '#EC4899', 'wrench'),
  ('Outros', '#6B7280', 'more-horizontal')
ON CONFLICT (nome) DO NOTHING;
