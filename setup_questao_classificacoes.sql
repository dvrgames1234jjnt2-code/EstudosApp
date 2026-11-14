-- Classificações individuais para questões dos cadernos comuns.
-- Não altera a dificuldade original armazenada em public.questoes.

CREATE TABLE IF NOT EXISTS public.questao_classificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    questao_id TEXT NOT NULL,
    classificacao TEXT NOT NULL CHECK (
        classificacao IN ('Fácil', 'Média', 'Difícil', 'Atenção', 'Lacuna', 'Treinar', 'Dominada', 'Ultrahard', 'Bônus')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, questao_id)
);

ALTER TABLE public.questao_classificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários gerenciam suas classificações de questões" ON public.questao_classificacoes;
CREATE POLICY "Usuários gerenciam suas classificações de questões"
    ON public.questao_classificacoes FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS questao_classificacoes_user_id_idx
    ON public.questao_classificacoes (user_id);
