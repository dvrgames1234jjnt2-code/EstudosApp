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

const serverNotionCache = new Map<string, { data: any; status: number; timestamp: number }>();
const serverInFlight = new Map<string, Promise<{ data: any; status: number }>>();
const CACHE_TTL_MS = 35 * 60 * 1000; // 35 minutos de cache em memória no servidor

async function proxyNotion(path: string, request: NextRequest) {
  const token = process.env.NOTION_TOKEN;
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `https://api.notion.com/v1/${path}${searchParams ? `?${searchParams}` : ''}`;
  const isGet = request.method === 'GET';

  if (isGet) {
    const cached = serverNotionCache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
      return NextResponse.json(cached.data, {
        status: cached.status,
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 's-maxage=2100, stale-while-revalidate=3600' }
      });
    }
    if (serverInFlight.has(url)) {
      const result = await serverInFlight.get(url)!;
      return NextResponse.json(result.data, { status: result.status, headers: { 'X-Cache': 'DEDUPED' } });
    }
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const body = request.method !== 'GET' ? await request.text() : undefined;

  const fetchPromise = (async () => {
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
        if (isGet && response.status === 200) {
          serverNotionCache.set(url, { data, status: response.status, timestamp: Date.now() });
        }
        return { data, status: response.status };
      } catch (error: any) {
        if (attempts >= maxAttempts) {
          return { data: { error: error.message }, status: 500 };
        }
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    return { data: { error: 'Max retry attempts reached' }, status: 500 };
  })();

  if (isGet) {
    serverInFlight.set(url, fetchPromise);
  }

  try {
    const result = await fetchPromise;
    return NextResponse.json(result.data, {
      status: result.status,
      headers: isGet ? { 'Cache-Control': 's-maxage=2100, stale-while-revalidate=3600' } : {}
    });
  } finally {
    if (isGet) {
      serverInFlight.delete(url);
    }
  }
}
