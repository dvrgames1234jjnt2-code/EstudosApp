-- ==============================================================================
-- ETAPA 1 — PREPARAÇÃO DA NOVA ARQUITETURA (APENAS ADITIVO)
-- Tabela organizacao_nos e coluna questoes.organizacao_id já existem no Supabase.
-- Este script adiciona apenas o que ainda não foi criado.
-- ==============================================================================

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. organizacao_nos — JÁ EXISTE. Estrutura confirmada:
--    id UUID PK | nome TEXT | tipo TEXT (default 'pasta') |
--    parent_id UUID FK (self) | ordem INTEGER |
--    created_at TIMESTAMPTZ | updated_at TIMESTAMPTZ
--
--    questoes.organizacao_id UUID FK → organizacao_nos.id  — JÁ EXISTE.
--    questoes."ID_Qconcursos" TEXT + índice                — JÁ EXISTE.
--
--    NÃO recriar nada acima.
-- ────────────────────────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────────────────────────
-- 1.1 Políticas de RLS para organizacao_nos (Permitir leitura e escrita para importação)
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizacao_nos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública organizacao_nos" ON public.organizacao_nos;
CREATE POLICY "Permitir leitura pública organizacao_nos" ON public.organizacao_nos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de organizacao_nos" ON public.organizacao_nos;
CREATE POLICY "Permitir inserção de organizacao_nos" ON public.organizacao_nos
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de organizacao_nos" ON public.organizacao_nos;
CREATE POLICY "Permitir atualização de organizacao_nos" ON public.organizacao_nos
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir exclusão de organizacao_nos" ON public.organizacao_nos;
CREATE POLICY "Permitir exclusão de organizacao_nos" ON public.organizacao_nos
    FOR DELETE USING (true);


-- ────────────────────────────────────────────────────────────────────────────────
-- 2. Campo Ano em questoes (adicionar se ainda não existir)
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.questoes
    ADD COLUMN IF NOT EXISTS "Ano" integer;


-- ────────────────────────────────────────────────────────────────────────────────
-- 3. VIEW — Questão com caminho completo da hierarquia
--    Usa organizacao_nos + parent_id (estrutura real do banco).
-- ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_questoes_com_path AS
WITH RECURSIVE hierarquia_path AS (
    -- Raízes (sem pai)
    SELECT
        id,
        nome,
        parent_id,
        0         AS nivel,
        nome      AS path_completo
    FROM public.organizacao_nos
    WHERE parent_id IS NULL

    UNION ALL

    -- Filhos
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
    on2.nome           AS organizacao_nome,
    hp.path_completo   AS organizacao_path,
    hp.nivel           AS organizacao_nivel
FROM public.questoes q
LEFT JOIN public.organizacao_nos on2 ON q.organizacao_id = on2.id
LEFT JOIN hierarquia_path hp         ON on2.id = hp.id;


-- ────────────────────────────────────────────────────────────────────────────────
-- 4. FUNÇÃO — Todos os IDs descendentes de um nó (para filtrar com subpastas)
--    Uso: SELECT * FROM questoes WHERE organizacao_id IN (SELECT id FROM get_descendentes('uuid'))
-- ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_descendentes(p_id UUID)
RETURNS TABLE(id UUID) AS $$
WITH RECURSIVE desc_tree AS (
    SELECT id FROM public.organizacao_nos WHERE organizacao_nos.id = p_id
    UNION ALL
    SELECT n.id FROM public.organizacao_nos n
    JOIN desc_tree d ON n.parent_id = d.id
)
SELECT id FROM desc_tree;
$$ LANGUAGE SQL STABLE;


-- ────────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICAÇÃO DE DUPLICATAS POR ID_Qconcursos (somente leitura)
--    Descomente e execute separadamente ANTES de aplicar constraint UNIQUE:
-- ────────────────────────────────────────────────────────────────────────────────
-- SELECT "ID_Qconcursos", COUNT(*) AS total
-- FROM public.questoes
-- WHERE "ID_Qconcursos" IS NOT NULL
-- GROUP BY "ID_Qconcursos"
-- HAVING COUNT(*) > 1
-- ORDER BY total DESC;
