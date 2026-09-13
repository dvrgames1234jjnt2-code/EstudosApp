import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path.join('/');
  return proxyNotion(path, request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path.join('/');
  return proxyNotion(path, request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const path = (await params).path.join('/');
  return proxyNotion(path, request);
}

async function proxyNotion(path: string, request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `https://api.notion.com/v1/${path}${searchParams ? `?${searchParams}` : ''}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const body = request.method !== 'GET' ? await request.text() : undefined;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body,
      });

      if (response.status === 429 && attempts < maxAttempts) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        const waitMs = Math.max(retryAfter * 1000, attempts * 400);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }

      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
      if (attempts >= maxAttempts) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
  return NextResponse.json({ error: 'Max retry attempts reached' }, { status: 500 });
}
