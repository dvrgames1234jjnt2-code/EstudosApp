import { NextRequest, NextResponse } from 'next/server';

const NOTION_VERSION = '2022-06-28';

function normalizeNotionId(id: string): string {
  const clean = id.replace(/-/g, '').trim();
  if (clean.length !== 32) return id.trim();
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

async function appendNotionChildren(parentBlockId: string, children: unknown[], token: string) {
  const clean = normalizeNotionId(parentBlockId);
  const res = await fetch(`https://api.notion.com/v1/blocks/${clean}/children`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ children }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function POST(request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const body = await request.json().catch(() => ({}));
  const { action } = body as { action?: string };

  if (!token) {
    return NextResponse.json({
      syncedToNotion: false,
      reason: 'NOTION_TOKEN não configurado; salvo no Supabase.',
    });
  }

  try {
    if (action === 'create_caso') {
      const { parentBlockId, nome } = body as { parentBlockId?: string; nome?: string };
      if (!parentBlockId || !nome?.trim()) {
        return NextResponse.json({ syncedToNotion: false, reason: 'Parâmetros inválidos.' });
      }
      const result = await appendNotionChildren(
        parentBlockId,
        [
          {
            object: 'block',
            type: 'toggle',
            toggle: {
              rich_text: [{ type: 'text', text: { content: nome.trim() } }],
            },
          },
        ],
        token
      );
      if (!result.ok) {
        return NextResponse.json({
          syncedToNotion: false,
          reason: result.data?.message || `Notion HTTP ${result.status}`,
        });
      }
      const created = result.data?.results?.[0];
      return NextResponse.json({
        syncedToNotion: true,
        blockId: created?.id ?? null,
        block: created ?? null,
      });
    }

    if (action === 'create_questao') {
      const {
        parentBlockId,
        title,
        enunciadoTexto,
        imagensUrls,
        gabaritoTexto,
        gabaritoImagensUrls,
      } = body as {
        parentBlockId?: string;
        title?: string;
        enunciadoTexto?: string;
        imagensUrls?: string[];
        gabaritoTexto?: string;
        gabaritoImagensUrls?: string[];
      };

      if (!parentBlockId || !title?.trim()) {
        return NextResponse.json({ syncedToNotion: false, reason: 'Parâmetros inválidos.' });
      }

      const questaoChildren: unknown[] = [];

      if (enunciadoTexto?.trim()) {
        const chunks = enunciadoTexto.trim().match(/[\s\S]{1,1900}/g) ?? [];
        for (const chunk of chunks) {
          questaoChildren.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: chunk } }],
            },
          });
        }
      }

      for (const imgUrl of imagensUrls ?? []) {
        if (imgUrl?.startsWith('http')) {
          questaoChildren.push({
            object: 'block',
            type: 'image',
            image: { type: 'external', external: { url: imgUrl } },
          });
        }
      }

      const respostaChildren: unknown[] = [];
      if (gabaritoTexto?.trim()) {
        const chunks = gabaritoTexto.trim().match(/[\s\S]{1,1900}/g) ?? [];
        for (const chunk of chunks) {
          respostaChildren.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: chunk } }],
            },
          });
        }
      }
      for (const imgUrl of gabaritoImagensUrls ?? []) {
        if (imgUrl?.startsWith('http')) {
          respostaChildren.push({
            object: 'block',
            type: 'image',
            image: { type: 'external', external: { url: imgUrl } },
          });
        }
      }

      if (respostaChildren.length > 0) {
        questaoChildren.push({
          object: 'block',
          type: 'toggle',
          toggle: {
            rich_text: [{ type: 'text', text: { content: 'Resposta 💡' } }],
            children: respostaChildren,
          },
        });
      }

      const result = await appendNotionChildren(
        parentBlockId,
        [
          {
            object: 'block',
            type: 'toggle',
            toggle: {
              rich_text: [{ type: 'text', text: { content: title.trim() } }],
              ...(questaoChildren.length > 0 ? { children: questaoChildren } : {}),
            },
          },
        ],
        token
      );

      if (!result.ok) {
        return NextResponse.json({
          syncedToNotion: false,
          reason: result.data?.message || `Notion HTTP ${result.status}`,
        });
      }

      const created = result.data?.results?.[0];
      return NextResponse.json({
        syncedToNotion: true,
        blockId: created?.id ?? null,
        block: created ?? null,
      });
    }

    return NextResponse.json({ syncedToNotion: false, reason: 'Ação desconhecida.' });
  } catch (err: any) {
    return NextResponse.json({
      syncedToNotion: false,
      reason: err?.message || 'Erro ao comunicar com o Notion.',
    });
  }
}
