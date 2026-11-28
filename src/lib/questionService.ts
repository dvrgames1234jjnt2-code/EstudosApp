/**
 * questionService.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Serviço centralizado de acesso a questões.
 *
 * Estrutura real do banco:
 *   - Tabela de questões:     public.questoes
 *   - Tabela de hierarquia:   public.organizacao_nos  (parent_id, não pai_id)
 *   - Histórico de respostas: public.historico_respostas
 *   - Dúvidas:                public.duvidas
 *
 * Nenhuma alteração destrutiva. Campos antigos (Materia, Disciplina, etc.)
 * continuam sendo lidos normalmente enquanto a migração não for concluída.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { supabase, supabasePublic } from './supabase';
import type { BancoQuestion } from '../components/banco/QuestionsTable';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Nó da hierarquia de organização (tabela: organizacao_nos) */
export interface OrgNode {
  id: string;
  nome: string;
  tipo: string | null;
  parent_id: string | null;   // coluna real no banco
  ordem: number;
  created_at?: string;
  updated_at?: string;
}

/** OrgNode com filhos (para construção de árvore) */
export interface OrgTreeNode extends OrgNode {
  filhos: OrgTreeNode[];
}

/** Questão enriquecida com campos da nova estrutura */
export interface BancoQuestionComPath extends BancoQuestion {
  organizacao_id?: string;
  organizacao_nome?: string;
  organizacao_path?: string;
  organizacao_nivel?: number;
  ID_Qconcursos?: string;
  Idq?: string;
  idq?: string;
  Idg?: string;
  idg?: string;
  Idtec?: string;
  idtec?: string;
  link?: string;
  Ano?: string | number;
  Ordem?: number | null;
  ordem?: number | null;
  Banca?: string;
  banca?: string;
  Disciplina?: string;
  disciplina?: string;
}

export type PlataformaFiltro = 'todas' | 'qconcursos' | 'gran' | 'tec';

export const CADERNO_ERROS_SQL_MIGRATION = `ALTER TABLE public.questoes
  ADD COLUMN IF NOT EXISTS "Idq" text,
  ADD COLUMN IF NOT EXISTS "Idg" text,
  ADD COLUMN IF NOT EXISTS "Idtec" text,
  ADD COLUMN IF NOT EXISTS "Banca" text,
  ADD COLUMN IF NOT EXISTS "Ordem" numeric,
  ADD COLUMN IF NOT EXISTS "Disciplina" text,
  ADD COLUMN IF NOT EXISTS "Texto de apoio" text,
  ADD COLUMN IF NOT EXISTS "Enunciado" text,
  ADD COLUMN IF NOT EXISTS "Pergunta problema" text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questoes' AND column_name = 'ID_Qconcursos'
  ) THEN
    EXECUTE 'UPDATE public.questoes SET "Idq" = "ID_Qconcursos" WHERE "Idq" IS NULL AND "ID_Qconcursos" IS NOT NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questoes' AND column_name = 'id_qconcursos'
  ) THEN
    EXECUTE 'UPDATE public.questoes SET "Idq" = id_qconcursos WHERE "Idq" IS NULL AND id_qconcursos IS NOT NULL';
  END IF;
END $$;

DROP VIEW IF EXISTS public.v_questoes_com_path;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questoes' AND column_name = 'Ano' AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.questoes ALTER COLUMN "Ano" TYPE text USING "Ano"::text;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questoes' AND column_name = 'Ano'
  ) THEN
    ALTER TABLE public.questoes ADD COLUMN "Ano" text;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.v_questoes_com_path AS
WITH RECURSIVE hierarquia_path AS (
  SELECT id, nome, parent_id, 0 AS nivel, nome AS path_completo
  FROM public.organizacao_nos
  WHERE parent_id IS NULL
  UNION ALL
  SELECT n.id, n.nome, n.parent_id, hp.nivel + 1, hp.path_completo || ' > ' || n.nome
  FROM public.organizacao_nos n
  JOIN hierarquia_path hp ON n.parent_id = hp.id
)
SELECT q.*, on2.nome AS organizacao_nome, hp.path_completo AS organizacao_path, hp.nivel AS organizacao_nivel
FROM public.questoes q
LEFT JOIN public.organizacao_nos on2 ON q.organizacao_id = on2.id
LEFT JOIN hierarquia_path hp ON on2.id = hp.id;`;

export function normalizeDifficultyLabel(raw?: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const val = String(raw).trim();
  if (!val) return undefined;
  const lower = val.toLowerCase();
  if (lower === 'facil' || lower === 'fácil') return 'Fácil';
  if (lower === 'media' || lower === 'média') return 'Média';
  if (lower === 'dificil' || lower === 'difícil' || lower === 'díficil') return 'Difícil';
  if (lower === 'ultrahard' || lower === 'ultra hard' || lower === 'ultra-hard') return 'Ultrahard';
  if (lower === 'atencao' || lower === 'atenção') return 'Atenção';
  if (lower === 'bonus' || lower === 'bônus') return 'Bônus';
  return val;
}

export function getQuestionIds(q: Partial<BancoQuestion> & Record<string, any>) {
  const idq = String(q.Idq ?? q.idq ?? q.ID_Qconcursos ?? '').trim();
  const idg = String(q.Idg ?? q.idg ?? q.ID_Gran ?? '').trim();
  const idtec = String(q.Idtec ?? q.idtec ?? q.ID_TEC ?? '').trim();
  return { idq, idg, idtec };
}

export function matchesPlataforma(q: Partial<BancoQuestion> & Record<string, any>, plataforma: PlataformaFiltro): boolean {
  if (plataforma === 'todas') return true;
  const { idq, idg, idtec } = getQuestionIds(q);
  if (plataforma === 'qconcursos') return Boolean(idq);
  if (plataforma === 'gran') return Boolean(idg);
  if (plataforma === 'tec') return Boolean(idtec);
  return true;
}

export function compareQuestoesByOrdem<T extends Partial<BancoQuestion> & Record<string, any>>(a: T, b: T): number {
  const rawA: unknown = a.Ordem ?? a.ordem;
  const rawB: unknown = b.Ordem ?? b.ordem;
  const ordA = rawA !== undefined && rawA !== null && String(rawA).trim() !== '' && !Number.isNaN(Number(rawA)) ? Number(rawA) : Number.MAX_SAFE_INTEGER;
  const ordB = rawB !== undefined && rawB !== null && String(rawB).trim() !== '' && !Number.isNaN(Number(rawB)) ? Number(rawB) : Number.MAX_SAFE_INTEGER;
  if (ordA !== ordB) return ordA - ordB;
  const idA = Number(a.id) || 0;
  const idB = Number(b.id) || 0;
  return idA - idB;
}

export function sortQuestoesByOrdem<T extends Partial<BancoQuestion> & Record<string, any>>(list: T[]): T[] {
  return [...list].sort(compareQuestoesByOrdem);
}

export function isQuestaoAnulada(q?: { status?: unknown; Status?: unknown } | null): boolean {
  if (!q) return false;
  const raw = String(q.status ?? q.Status ?? '').trim().toLowerCase();
  if (!raw) return false;
  return raw === 'anulada' || raw === 'anulado' || raw.includes('anulad');
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização: linha do DB → BancoQuestionComPath
// ─────────────────────────────────────────────────────────────────────────────
export function normalizarQuestao(row: any): BancoQuestionComPath {
  const idq = row.Idq ?? row.idq ?? row.ID_Qconcursos ?? undefined;
  const idg = row.Idg ?? row.idg ?? row.ID_Gran ?? undefined;
  const idtec = row.Idtec ?? row.idtec ?? row.ID_TEC ?? undefined;
  const rawOrdem = row.Ordem ?? row.ordem;
  const ordem = rawOrdem !== undefined && rawOrdem !== null && rawOrdem !== '' && !Number.isNaN(Number(rawOrdem))
    ? Number(rawOrdem)
    : undefined;
  const banca = row.Banca ?? row.banca ?? undefined;
  const disciplina = row.Disciplina ?? row.disciplina ?? row.Materia ?? row.materia ?? 'Geral';
  const rawAno = row.Ano ?? row.ano;
  const anoNormalized = rawAno !== undefined && rawAno !== null && String(rawAno).trim() !== ''
    ? String(rawAno).trim()
    : undefined;

  return {
    id:           row.id,
    // Compatibilidade com campos antigos e novos
    materia:      disciplina,
    disciplina,
    Disciplina:   disciplina,
    tema:         row.tema || row.Tema || row['Tópico'] || row.Assunto || undefined,
    title:        row.Enunciado || row.enunciado || row.texto || row.title || '',
    dificuldade:  normalizeDifficultyLabel(row.dificuldade || row.Dificuldade),
    status:       row.Status || row.status || undefined,
    prova:        row.PROVA || row.Prova || row.prova || undefined,
    dat:          row.created_at || row.dat || undefined,
    referencia:   row.referencia || undefined,
    'Alternativa A': row['Alternativa A'] || row.alternativa_a || undefined,
    'Alternativa B': row['Alternativa B'] || row.alternativa_b || undefined,
    'Alternativa C': row['Alternativa C'] || row.alternativa_c || undefined,
    'Alternativa D': row['Alternativa D'] || row.alternativa_d || undefined,
    'Alternativa E': row['Alternativa E'] || row.alternativa_e || undefined,
    'Texto de apoio': row['Texto de apoio'] || row.texto_apoio || undefined,
    perguntaProblema: row['Pergunta problema'] !== undefined ? row['Pergunta problema'] : (row.pergunta_problema || row.perguntaProblema || undefined),
    respostaCorreta:  row.respostaCorreta || row.resposta_correta || row.Gabarito || row.gabarito || undefined,
    Gabarito:     row.Gabarito || row.gabarito || undefined,
    explicacao:   row['Comentário'] || row.Comentário || row.comentario || row.Comentario || row.explicacao || row.Explicacao || undefined,
    created_at:   row.created_at || undefined,
    imagemEnunciado: row.Imagem_Enunciado || row.imagemEnunciado || undefined,
    // Campos novos (Etapa 1 & Etapa 2)
    organizacao_id:    row.organizacao_id    || undefined,
    organizacao_nome:  row.organizacao_nome  || undefined,
    organizacao_path:  row.organizacao_path  || undefined,
    organizacao_nivel: row.organizacao_nivel ?? undefined,
    ID_Qconcursos:     idq ? String(idq).trim() : undefined,
    Idq:               idq ? String(idq).trim() : undefined,
    idq:               idq ? String(idq).trim() : undefined,
    Idg:               idg ? String(idg).trim() : undefined,
    idg:               idg ? String(idg).trim() : undefined,
    Idtec:             idtec ? String(idtec).trim() : undefined,
    idtec:             idtec ? String(idtec).trim() : undefined,
    Ordem:             ordem,
    ordem,
    Banca:             banca ? String(banca).trim() : undefined,
    banca:             banca ? String(banca).trim() : undefined,
    link:              row.link              || undefined,
    Ano:               anoNormalized,
    Duvida:            typeof row.Duvida === 'boolean' ? row.Duvida : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar todas as questões (compatível com a tela atual)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchQuestoes(): Promise<BancoQuestionComPath[]> {
  const { data, error } = await supabasePublic
    .from('questoes')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizarQuestao);
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar questões por nó da hierarquia (com opção de incluir subpastas)
// Usa a função get_descendentes definida no SQL de preparação.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchQuestoesPorOrganizacao(
  orgId: string,
  incluirSubpastas = true
): Promise<BancoQuestionComPath[]> {
  let ids: string[];

  if (incluirSubpastas) {
    const { data: desc, error } = await supabase
      .rpc('get_descendentes', { p_id: orgId });
    if (error) throw error;
    ids = (desc || []).map((d: { id: string }) => d.id);
  } else {
    ids = [orgId];
  }

  const { data, error } = await supabasePublic
    .from('questoes')
    .select('*')
    .in('organizacao_id', ids)
    .order('id', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizarQuestao);
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar lista plana de nós da hierarquia
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchOrgNodes(): Promise<OrgNode[]> {
  const { data, error } = await supabase
    .from('organizacao_nos')
    .select('id, nome, tipo, parent_id, ordem, created_at, updated_at')
    .order('ordem', { ascending: true });

  if (error) throw error;
  return (data || []) as OrgNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Construir árvore aninhada a partir da lista plana
// ─────────────────────────────────────────────────────────────────────────────
export function buildOrgTree(nodes: OrgNode[]): OrgTreeNode[] {
  const map = new Map<string, OrgTreeNode>();
  const roots: OrgTreeNode[] = [];

  for (const n of nodes) map.set(n.id, { ...n, filhos: [] });

  for (const [, node] of map) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.filhos.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver/criar caminho hierárquico a partir de uma lista de nomes
// Retorna o UUID do nó-folha. Reutiliza nós já existentes.
//
// Exemplo: ["Conhecimentos Bancários", "Mercado de Capitais", "Underwriting"]
//   → cria ou reutiliza cada nó, retorna o UUID de "Underwriting"
//
// cache: Map<"parent_id|nome_lower" → uuid> — passado por referência para
//        reutilizar entre chamadas do mesmo lote de importação.
// ─────────────────────────────────────────────────────────────────────────────
export async function resolverCaminhoOrg(
  caminho: string[],
  cache: Map<string, string>
): Promise<string | null> {
  if (!caminho || !caminho.length) return null;

  let parentId: string | null = null;

  for (const nome of caminho) {
    if (!nome || !nome.trim()) continue;
    const cleanNome = nome.trim();
    const parentKey: string = parentId !== null ? parentId : 'root';
    const cacheKey: string = parentKey + '|' + cleanNome.toLowerCase();

    if (cache.has(cacheKey)) {
      parentId = cache.get(cacheKey) || null;
      continue;
    }

    try {
      // Busca nó existente usando supabasePublic para não depender de sessão
      let query: any = supabasePublic
        .from('organizacao_nos')
        .select('id')
        .ilike('nome', cleanNome);

      if (parentId) {
        query = query.eq('parent_id', parentId);
      } else {
        query = query.is('parent_id', null);
      }

      const resBusca: any = await query.maybeSingle();
      const found = resBusca?.data;

      if (found?.id) {
        const foundId: string = String(found.id);
        cache.set(cacheKey, foundId);
        parentId = foundId;
      } else {
        // Tenta criar novo nó usando supabasePublic primeiro, fallback para supabase
        let resInsert: any = await (supabasePublic.from('organizacao_nos') as any)
          .insert({
            nome: cleanNome,
            parent_id: parentId,
            tipo: 'pasta',
            ordem: 0,
          })
          .select('id')
          .single();

        if (resInsert.error && supabase) {
          resInsert = await (supabase.from('organizacao_nos') as any)
            .insert({
              nome: cleanNome,
              parent_id: parentId,
              tipo: 'pasta',
              ordem: 0,
            })
            .select('id')
            .single();
        }

        if (resInsert.error || !resInsert.data) {
          console.warn(`Aviso ao criar pasta "${cleanNome}":`, resInsert?.error?.message || 'Permissão restrita no Supabase');
          // Não aborta a importação de questões se as pastas estiverem bloqueadas por RLS
          return parentId;
        }

        const createdId: string = String(resInsert.data.id);
        cache.set(cacheKey, createdId);
        parentId = createdId;
      }
    } catch (err: any) {
      console.warn(`Aviso no caminho "${cleanNome}":`, err?.message);
      return parentId;
    }
  }

  return parentId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detectar possíveis duplicatas por ID_Qconcursos (leitura, sem destruir dados)
// ─────────────────────────────────────────────────────────────────────────────
export async function detectarDuplicatasQconcursos(): Promise<
  { ID_Qconcursos: string; ids: number[] }[]
> {
  const { data, error } = await supabase
    .from('questoes')
    .select('id, "ID_Qconcursos"')
    .not('"ID_Qconcursos"', 'is', null);

  if (error) throw error;

  const mapa = new Map<string, number[]>();
  for (const row of data || []) {
    const key = String(row['ID_Qconcursos']);
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key)!.push(row.id);
  }

  return [...mapa.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([ID_Qconcursos, ids]) => ({ ID_Qconcursos, ids }));
}
