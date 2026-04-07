-- Script SQL para criação da tabela de transações
-- Execute este comando no Editor SQL do seu projeto Supabase

CREATE TABLE IF NOT EXISTS transacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  tipo TEXT CHECK (tipo IN ('PF', 'PJ')) NOT NULL,
  categoria TEXT CHECK (categoria IN ('entrada', 'saida', 'divida')) NOT NULL,
  status TEXT CHECK (status IN ('pago', 'pendente')) NOT NULL DEFAULT 'pago'
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir acesso anônimo (para fins de demonstração/protótipo)
-- Em produção, você deve restringir isso ao auth.uid()
CREATE POLICY "Permitir tudo para usuários anônimos" ON transacoes
  FOR ALL USING (true) WITH CHECK (true);
