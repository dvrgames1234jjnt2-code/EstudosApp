-- Classificação pessoal das questões do Notion.
-- Cada usuário mantém sua própria classificação sem alterar a categoria original no Notion.

CREATE TABLE IF NOT EXISTS public.notion_classificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    questao_id TEXT NOT NULL,
    classificacao TEXT NOT NULL CHECK (
        classificacao IN (
            'bonus', 'faceis', 'atencao', 'lacuna', 'media', 'dificil',
            'ultrahard', 'dominada', 'treinar', 'revisar'
        )
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, questao_id)
);

ALTER TABLE public.notion_classificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários gerenciam suas classificações" ON public.notion_classificacoes;
CREATE POLICY "Usuários gerenciam suas classificações"
    ON public.notion_classificacoes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notion_classificacoes_user_id_idx
    ON public.notion_classificacoes (user_id);
