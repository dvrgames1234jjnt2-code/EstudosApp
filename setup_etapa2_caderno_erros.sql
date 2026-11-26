-- ==============================================================================
-- ETAPA 2 — CADERNO DE ERROS & NOVAS COLUNAS (APENAS ADITIVO / SEGURO)
-- Mantém public.organizacao_nos e questoes.organizacao_id intactos.
-- Execute no SQL Editor do Supabase.
-- ==============================================================================

-- 1. Novas colunas de identificação por plataforma, banca, ordem, disciplina e conteúdo
ALTER TABLE public.questoes
    ADD COLUMN IF NOT EXISTS "Idq" text,
    ADD COLUMN IF NOT EXISTS "Idg" text,
    ADD COLUMN IF NOT EXISTS "Idtec" text,
    ADD COLUMN IF NOT EXISTS "Banca" text,
    ADD COLUMN IF NOT EXISTS "Ordem" numeric,
    ADD COLUMN IF NOT EXISTS "Disciplina" text,
    ADD COLUMN IF NOT EXISTS "Texto de apoio" text,
    ADD COLUMN IF NOT EXISTS "Enunciado" text,
    ADD COLUMN IF NOT EXISTS "Pergunta problema" text;

-- 2. Sincroniza Idq a partir de ID_Qconcursos ou id_qconcursos apenas se a coluna existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'questoes'
          AND column_name = 'ID_Qconcursos'
    ) THEN
        EXECUTE '
            UPDATE public.questoes
            SET "Idq" = "ID_Qconcursos"
            WHERE "Idq" IS NULL AND "ID_Qconcursos" IS NOT NULL
        ';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'questoes'
          AND column_name = 'id_qconcursos'
    ) THEN
        EXECUTE '
            UPDATE public.questoes
            SET "Idq" = id_qconcursos
            WHERE "Idq" IS NULL AND id_qconcursos IS NOT NULL
        ';
    END IF;
END $$;

-- 3. Permitir que "Ano" armazene data de aplicação completa (ex: "23/04/2023" ou "2023")
DROP VIEW IF EXISTS public.v_questoes_com_path;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'questoes'
          AND column_name = 'Ano'
          AND data_type <> 'text'
    ) THEN
        ALTER TABLE public.questoes
            ALTER COLUMN "Ano" TYPE text USING "Ano"::text;
    ELSIF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'questoes'
          AND column_name = 'Ano'
    ) THEN
        ALTER TABLE public.questoes ADD COLUMN "Ano" text;
    END IF;
END $$;

CREATE OR REPLACE VIEW public.v_questoes_com_path AS
WITH RECURSIVE hierarquia_path AS (
    SELECT
        id,
        nome,
        parent_id,
        0 AS nivel,
        nome AS path_completo
    FROM public.organizacao_nos
    WHERE parent_id IS NULL

    UNION ALL

    SELECT
        n.id,
        n.nome,
        n.parent_id,
        hp.nivel + 1,
        hp.path_completo || ' > ' || n.nome
    FROM public.organizacao_nos n
    JOIN hierarquia_path hp ON n.parent_id = hp.id
)
SELECT
    q.*,
    on2.nome AS organizacao_nome,
    hp.path_completo AS organizacao_path,
    hp.nivel AS organizacao_nivel
FROM public.questoes q
LEFT JOIN public.organizacao_nos on2 ON q.organizacao_id = on2.id
LEFT JOIN hierarquia_path hp ON on2.id = hp.id;

-- 4. Índices para filtragem rápida por plataforma e ordenação
CREATE INDEX IF NOT EXISTS idx_questoes_idq ON public.questoes ("Idq");
CREATE INDEX IF NOT EXISTS idx_questoes_idg ON public.questoes ("Idg");
CREATE INDEX IF NOT EXISTS idx_questoes_idtec ON public.questoes ("Idtec");
CREATE INDEX IF NOT EXISTS idx_questoes_ordem ON public.questoes ("Ordem");
