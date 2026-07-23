import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/blocks/[blockId]/subtree-data
 * Retorna todos os blocos filhos de um bloco Notion, em formato flat com path e content.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await params;
  const token = process.env.NOTION_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'NOTION_TOKEN não configurado' }, { status: 500 });
  }

  try {
    const blocks = await fetchAllChildren(blockId, token, []);
    return NextResponse.json({ blocks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Extrai texto legível de um bloco Notion */
function extractText(block: any): string {
  const type = block.type;
  const data = block[type];
  if (!data) return '';

  const richText = data.rich_text || data.text || [];
  return richText.map((rt: any) => rt.plain_text || '').join('');
}

/** Busca recursivamente todos os filhos de um bloco */
async function fetchAllChildren(
  blockId: string,
  token: string,
  parentPath: string[]
): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    url.searchParams.set('page_size', '100');
    if (cursor) url.searchParams.set('start_cursor', cursor);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!res.ok) break;
    const data = await res.json();

    for (const block of data.results || []) {
      const content = extractText(block);
      const blockPath = [...parentPath, content || block.type];

      if (content.trim().length > 0) {
        results.push({
          id: block.id,
          content,
          type: block.type,
          path: blockPath,
        });
      }

      // Recursão em filhos se tiver
      if (block.has_children) {
        const children = await fetchAllChildren(block.id, token, blockPath);
        results.push(...children);
      }
    }

    cursor = data.next_cursor ?? undefined;
  } while (cursor);

  return results;
}
