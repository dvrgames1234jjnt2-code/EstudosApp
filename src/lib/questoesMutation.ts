import { supabase, supabasePublic } from "./supabase";

export type QuestaoWritePayload = Record<string, string | number | boolean | null>;

const TEMA_COLUMN_CHAIN = ["tema", "Tema", "Assunto", "Tópico"] as const;

function extractMissingColumn(message: string): string | null {
  const cacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (cacheMatch?.[1]) return cacheMatch[1];

  const pgMatch = message.match(/column "([^"]+)" of relation/i);
  if (pgMatch?.[1]) return pgMatch[1];

  return null;
}

function adaptPayloadForError(
  current: QuestaoWritePayload,
  message: string
): QuestaoWritePayload | null {
  const next: QuestaoWritePayload = { ...current };
  let changed = false;

  const missingCol = extractMissingColumn(message);
  if (missingCol && Object.prototype.hasOwnProperty.call(next, missingCol)) {
    const val = next[missingCol];
    delete next[missingCol];
    changed = true;

    const temaIdx = TEMA_COLUMN_CHAIN.indexOf(
      missingCol as (typeof TEMA_COLUMN_CHAIN)[number]
    );
    if (temaIdx !== -1 && val !== null && val !== "") {
      const nextTemaCol = TEMA_COLUMN_CHAIN[temaIdx + 1];
      if (nextTemaCol && !Object.prototype.hasOwnProperty.call(next, nextTemaCol)) {
        next[nextTemaCol] = val;
      }
    }
  }

  if (
    /invalid input syntax for type integer/i.test(message) &&
    typeof next.Ano === "string"
  ) {
    const yrMatch = next.Ano.match(/\b(19|20)\d{2}\b/);
    next.Ano = yrMatch ? Number(yrMatch[0]) : null;
    changed = true;
  }

  return changed ? next : null;
}

interface MutationOutcome {
  error: { message: string } | null;
  affectedCount?: number;
}

async function runQuestaoMutation(
  runner: (
    client: typeof supabase,
    payload: QuestaoWritePayload
  ) => Promise<MutationOutcome>,
  initialPayload: QuestaoWritePayload,
  requireAffectedRow = false
): Promise<string | null> {
  let payload: QuestaoWritePayload = { ...initialPayload };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    let res = await runner(supabase, payload);

    const primarySucceeded =
      !res.error && (!requireAffectedRow || (res.affectedCount ?? 0) > 0);
    if (primarySucceeded) return null;

    const missingCol = res.error ? extractMissingColumn(res.error.message || "") : null;
    if (!missingCol) {
      const pubRes = await runner(supabasePublic, payload);
      const pubSucceeded =
        !pubRes.error && (!requireAffectedRow || (pubRes.affectedCount ?? 0) > 0);
      if (pubSucceeded) return null;
      if (pubRes.error) {
        res = pubRes;
      } else if (!res.error) {
        return "Nenhuma alteração foi aplicada no banco (verifique permissões de edição).";
      }
    }

    const msg = res.error?.message || "Erro ao salvar na tabela questoes.";
    const adapted = adaptPayloadForError(payload, msg);
    if (!adapted || Object.keys(adapted).length === 0) {
      return msg;
    }
    payload = adapted;
  }

  return "Não foi possível adaptar os campos da questão ao esquema do banco.";
}

export async function safeUpdateQuestoesByIds(
  ids: (string | number)[],
  payload: QuestaoWritePayload
): Promise<string | null> {
  if (ids.length === 0) return null;
  return runQuestaoMutation(
    async (client, currentPayload) => {
      const { data, error } = await client
        .from("questoes")
        .update(currentPayload)
        .in("id", ids)
        .select("id");
      return {
        error,
        affectedCount: Array.isArray(data) ? data.length : 0,
      };
    },
    payload,
    true
  );
}

export async function safeInsertQuestao(
  payload: QuestaoWritePayload
): Promise<string | null> {
  return runQuestaoMutation(async (client, currentPayload) => {
    const { error } = await client.from("questoes").insert(currentPayload);
    return { error };
  }, payload);
}
