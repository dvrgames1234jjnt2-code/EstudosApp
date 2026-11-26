-- ==============================================================================
-- SISTEMA HIERÁRQUICO RECURSIVO DE DECKS, SUBDECKS E FLASHCARDS
-- Estrutura relacional escalável com profundidade arbitrária via parent_id.
-- Execute no SQL Editor do Supabase para habilitar persistência direta no Postgres.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. TABELA DECKS (Auto-relacionamento recursivo via parent_id)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    parent_id   UUID NULL,
    description TEXT NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Caso a tabela decks já exista de uma versão anterior, garante as colunas necessárias
ALTER TABLE public.decks
    ADD COLUMN IF NOT EXISTS name        TEXT,
    ADD COLUMN IF NOT EXISTS parent_id   UUID,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS position    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Garante FK auto-referenciada com integridade referencial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'decks_parent_id_fkey'
          AND conrelid = 'public.decks'::regclass
    ) THEN
        ALTER TABLE public.decks
            ADD CONSTRAINT decks_parent_id_fkey
            FOREIGN KEY (parent_id)
            REFERENCES public.decks(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- Impede auto-referência direta já no nível de constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'decks_no_self_parent'
          AND conrelid = 'public.decks'::regclass
    ) THEN
        ALTER TABLE public.decks
            ADD CONSTRAINT decks_no_self_parent
            CHECK (parent_id IS DISTINCT FROM id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decks_parent_id ON public.decks (parent_id);
CREATE INDEX IF NOT EXISTS idx_decks_parent_position ON public.decks (parent_id, position, created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. PROTEÇÃO CONTRA CICLOS HIERÁRQUICOS (Trigger BEFORE INSERT/UPDATE)
-- Impede mover um deck para dentro de si mesmo ou de qualquer descendente.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_prevent_deck_cycle()
RETURNS TRIGGER AS $$
DECLARE
    has_cycle BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'Um deck não pode ser movido para dentro de si mesmo (id=%).', NEW.id;
    END IF;

    WITH RECURSIVE ancestors AS (
        SELECT id, parent_id
        FROM public.decks
        WHERE id = NEW.parent_id

        UNION ALL

        SELECT d.id, d.parent_id
        FROM public.decks d
        JOIN ancestors a ON d.id = a.parent_id
        WHERE a.parent_id IS NOT NULL
    )
    SELECT EXISTS (
        SELECT 1 FROM ancestors WHERE id = NEW.id
    ) INTO has_cycle;

    IF has_cycle THEN
        RAISE EXCEPTION 'Ciclo hierárquico detectado: não é possível mover um deck para dentro de um de seus descendentes.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_deck_cycle ON public.decks;
CREATE TRIGGER trg_prevent_deck_cycle
    BEFORE INSERT OR UPDATE OF parent_id ON public.decks
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_deck_cycle();

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. TABELA FLASHCARDS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flashcards (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id    UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    front      TEXT NOT NULL,
    back       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_created_at ON public.flashcards (created_at);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. TABELA CARD_REVIEWS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.card_reviews (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id          UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
    review_status    TEXT NOT NULL CHECK (review_status IN ('new', 'learning', 'reviewing', 'mastered')),
    confidence       INTEGER NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 4),
    reviewed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    response_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_card_reviews_card_id ON public.card_reviews (card_id);
CREATE INDEX IF NOT EXISTS idx_card_reviews_reviewed_at ON public.card_reviews (reviewed_at DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER AUTOMÁTICO DE updated_at
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decks_updated_at ON public.decks;
CREATE TRIGGER trg_decks_updated_at
    BEFORE UPDATE ON public.decks
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER trg_flashcards_updated_at
    BEFORE UPDATE ON public.flashcards
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. VIEWS & FUNÇÕES RECURSIVAS DE CONSULTA
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_decks_with_path AS
WITH RECURSIVE deck_tree AS (
    SELECT
        id,
        name,
        parent_id,
        description,
        position,
        created_at,
        updated_at,
        0 AS depth,
        ARRAY[id] AS id_path,
        name AS full_path
    FROM public.decks
    WHERE parent_id IS NULL

    UNION ALL

    SELECT
        d.id,
        d.name,
        d.parent_id,
        d.description,
        d.position,
        d.created_at,
        d.updated_at,
        dt.depth + 1,
        dt.id_path || d.id,
        dt.full_path || ' / ' || d.name
    FROM public.decks d
    JOIN deck_tree dt ON d.parent_id = dt.id
)
SELECT * FROM deck_tree;

CREATE OR REPLACE FUNCTION public.get_deck_descendants(p_deck_id UUID)
RETURNS TABLE(id UUID, depth INTEGER) AS $$
WITH RECURSIVE sub AS (
    SELECT d.id, 0 AS depth
    FROM public.decks d
    WHERE d.id = p_deck_id

    UNION ALL

    SELECT c.id, s.depth + 1
    FROM public.decks c
    JOIN sub s ON c.parent_id = s.id
)
SELECT sub.id, sub.depth FROM sub;
$$ LANGUAGE SQL STABLE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. POLÍTICAS RLS (Habilita leitura e escrita para o aplicativo)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decks_public_all" ON public.decks;
CREATE POLICY "decks_public_all" ON public.decks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "flashcards_public_all" ON public.flashcards;
CREATE POLICY "flashcards_public_all" ON public.flashcards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "card_reviews_public_all" ON public.card_reviews;
CREATE POLICY "card_reviews_public_all" ON public.card_reviews FOR ALL USING (true) WITH CHECK (true);
