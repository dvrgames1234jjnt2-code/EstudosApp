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
  link?: string;
  Ano?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização: linha do DB → BancoQuestionComPath
// ─────────────────────────────────────────────────────────────────────────────
export function normalizarQuestao(row: any): BancoQuestionComPath {
  return {
    id:           row.id,
    // Compatibilidade com campos antigos e novos
    materia:      row.Materia || row.Disciplina || row.materia || row.disciplina || 'Geral',
    tema:         row.tema || row.Tema || row['Tópico'] || row.Assunto || undefined,
    title:        row.Enunciado || row.enunciado || row.texto || row.title || '',
    dificuldade:  row.dificuldade || row.Dificuldade || undefined,
    status:       row.Status || row.status || undefined,
    prova:        row.PROVA || row.prova || undefined,
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
    explicacao:   row['Comentário'] || row.Comentário || row.comentario || row.Comentario || row.explicacao || undefined,
    created_at:   row.created_at || undefined,
    imagemEnunciado: row.Imagem_Enunciado || row.imagemEnunciado || undefined,
    // Campos novos (Etapa 1)
    organizacao_id:    row.organizacao_id    || undefined,
    organizacao_nome:  row.organizacao_nome  || undefined,
    organizacao_path:  row.organizacao_path  || undefined,
    organizacao_nivel: row.organizacao_nivel ?? undefined,
    ID_Qconcursos:     row.ID_Qconcursos     || undefined,
    link:              row.link              || undefined,
    Ano:               row.Ano               ?? undefined,
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
