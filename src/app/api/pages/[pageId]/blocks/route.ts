import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/pages/[pageId]/blocks
 * Retorna os blocos de nível superior de uma página Notion.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const token = process.env.NOTION_TOKEN;

  if (!token) {
    return NextResponse.json({ error: 'NOTION_TOKEN não configurado' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
