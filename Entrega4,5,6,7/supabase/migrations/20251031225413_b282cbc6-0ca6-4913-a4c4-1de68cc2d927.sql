-- Criar tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cargo VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, cargo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'cargo', 'Operador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para criar perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabela de categorias
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver categorias"
  ON public.categorias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar categorias"
  ON public.categorias FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tabela de produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(200) NOT NULL,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  descricao TEXT,
  tipo VARCHAR(100),
  material VARCHAR(100),
  tamanho VARCHAR(50),
  peso DECIMAL(10, 3),
  unidade_medida VARCHAR(20) DEFAULT 'unidade',
  estoque_atual INTEGER DEFAULT 0 NOT NULL,
  estoque_minimo INTEGER DEFAULT 10 NOT NULL,
  preco_unitario DECIMAL(10, 2),
  localizacao VARCHAR(100),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver produtos"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem gerenciar produtos"
  ON public.produtos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tabela de movimentações de estoque
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  estoque_anterior INTEGER NOT NULL,
  estoque_posterior INTEGER NOT NULL,
  motivo TEXT,
  observacoes TEXT,
  data_movimentacao TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver movimentações"
  ON public.movimentacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem criar movimentações"
  ON public.movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em produtos
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Inserir dados de exemplo
INSERT INTO public.categorias (nome, descricao) VALUES
  ('Martelos', 'Martelos de diversos tipos e tamanhos'),
  ('Chaves', 'Chaves de fenda, Phillips e especiais'),
  ('Alicates', 'Alicates universais e especializados');

INSERT INTO public.produtos (nome, codigo, categoria_id, descricao, tipo, material, tamanho, peso, estoque_atual, estoque_minimo, preco_unitario, localizacao) VALUES
  ('Martelo de Unha 25mm', 'MAR-025', (SELECT id FROM public.categorias WHERE nome = 'Martelos'), 'Martelo profissional com cabo de madeira', 'Unha', 'Aço carbono', '25mm', 0.500, 45, 20, 35.90, 'A1-P2'),
  ('Martelo de Borracha 50mm', 'MAR-050', (SELECT id FROM public.categorias WHERE nome = 'Martelos'), 'Martelo com cabeça de borracha', 'Borracha', 'Borracha/Aço', '50mm', 0.400, 15, 20, 28.50, 'A1-P3'),
  ('Chave Phillips #2 Isolada', 'CHP-002', (SELECT id FROM public.categorias WHERE nome = 'Chaves'), 'Chave Phillips com isolamento 1000V', 'Phillips', 'Aço cromo-vanádio', '#2', 0.150, 8, 15, 22.90, 'B2-P1');