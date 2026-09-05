-- ======================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DO BANCO NOTION E ADMIN
-- Cole este script no Editor SQL do seu projeto no Supabase
-- ======================================================

-- 1. Tabela de Administradores (Quais e-mails podem adicionar/remover blocos)
CREATE TABLE IF NOT EXISTS public.notion_blocks_admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notion_blocks_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de notion_blocks_admins" ON public.notion_blocks_admins;
CREATE POLICY "Permitir leitura de notion_blocks_admins"
    ON public.notion_blocks_admins FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir gerenciamento de notion_blocks_admins" ON public.notion_blocks_admins;
CREATE POLICY "Permitir gerenciamento de notion_blocks_admins"
    ON public.notion_blocks_admins FOR ALL USING (true) WITH CHECK (true);


-- 2. Tabela de Blocos / Cadernos do Notion
CREATE TABLE IF NOT EXISTS public.notion_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    block_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    materia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notion_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de notion_blocks" ON public.notion_blocks;
CREATE POLICY "Permitir leitura de notion_blocks"
    ON public.notion_blocks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercao e remocao de notion_blocks" ON public.notion_blocks;
CREATE POLICY "Permitir insercao e remocao de notion_blocks"
    ON public.notion_blocks FOR ALL USING (true) WITH CHECK (true);


-- 3. Tabela de Dúvidas (Bandeira de revisão por questão/usuário)
CREATE TABLE IF NOT EXISTS public.notion_duvidas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    questao_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notion_duvidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo em notion_duvidas" ON public.notion_duvidas;
CREATE POLICY "Permitir acesso completo em notion_duvidas"
    ON public.notion_duvidas FOR ALL USING (true) WITH CHECK (true);


-- 4. Tabela de Respostas do Usuário (Histórico de Resolução das Questões)
CREATE TABLE IF NOT EXISTS public.notion_respostas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    questao_id TEXT NOT NULL,
    resposta TEXT NOT NULL,
    correta BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notion_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo em notion_respostas" ON public.notion_respostas;
CREATE POLICY "Permitir acesso completo em notion_respostas"
    ON public.notion_respostas FOR ALL USING (true) WITH CHECK (true);


-- 5. Tabela de Sessões de Estudo / Cronômetro (Modo livre e Pomodoro, Pausas e Streaks)
CREATE TABLE IF NOT EXISTS public.notion_estudo_sessoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    materia TEXT NOT NULL,
    topico TEXT,
    modo TEXT NOT NULL DEFAULT 'livre',
    duracao_minutos INTEGER NOT NULL DEFAULT 0,
    tempo_pausa_minutos INTEGER NOT NULL DEFAULT 0,
    eficiencia_pct INTEGER NOT NULL DEFAULT 100,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notion_estudo_sessoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso completo em notion_estudo_sessoes" ON public.notion_estudo_sessoes;
CREATE POLICY "Permitir acesso completo em notion_estudo_sessoes"
    ON public.notion_estudo_sessoes FOR ALL USING (true) WITH CHECK (true);

-- ======================================================
-- 💡 EXEMPLO PARA LIBERAR SEU E-MAIL COMO ADMIN:
-- Substitua 'seu_email@exemplo.com' pelo e-mail com o qual você faz login no app:
--
-- INSERT INTO public.notion_blocks_admins (email) 
-- VALUES ('seu_email@exemplo.com') 
-- ON CONFLICT (email) DO NOTHING;
-- ======================================================
