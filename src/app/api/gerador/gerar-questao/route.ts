import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/gerador/gerar-questao
 * Chama a Gemini API no servidor para gerar uma questão de concurso.
 * Mantém a GEMINI_API_KEY segura no servidor.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY não configurada no servidor.' },
      { status: 500 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { conteudo, materia, topico, gabarito, estrategia } = body;

  if (!conteudo || conteudo.trim().length < 50) {
    return NextResponse.json({ error: 'Conteúdo muito curto para gerar questão.' }, { status: 400 });
  }

  const gabaritoAlvo = gabarito || 'A';
  const materiaStr = materia || 'Conhecimentos Gerais';
  const topicoStr = topico || 'Geral';
  const estrategiaStr = estrategia || 'CONCEITUAL CLÁSSICA';

  const prompt = `Você é um especialista em criar questões de concurso público de altíssima qualidade, estilo CESPE/CEBRASPE ou FCC.

CONTEÚDO BASE:
${conteudo.slice(0, 4000)}

INSTRUÇÕES OBRIGATÓRIAS:
1. Crie UMA questão de múltipla escolha (A, B, C, D, E) sobre "${topicoStr}" da disciplina "${materiaStr}".
2. A alternativa CORRETA deve ser a letra ${gabaritoAlvo}.
3. Estratégia de questão: ${estrategiaStr}
4. O enunciado deve ter entre 2 e 5 linhas, baseado fielmente no conteúdo.
5. Cada alternativa deve ter entre 1 e 3 linhas.
6. Os distratores devem ser plausíveis mas claramente errados para quem estudou.
7. Inclua um comentário explicando por que ${gabaritoAlvo} está correta e por que as demais estão erradas.

Responda APENAS com JSON válido neste formato exato:
{
  "PROVA": "${materiaStr} - ${topicoStr}",
  "Disciplina": "${materiaStr}",
  "Topico": "${topicoStr}",
  "Assunto": "${topicoStr}",
  "Enunciado": "Texto do enunciado contextual aqui...",
  "Pergunta_problema": "Com base no texto acima, é CORRETO afirmar que:",
  "Alternativa_A": "Texto da alternativa A",
  "Alternativa_B": "Texto da alternativa B",
  "Alternativa_C": "Texto da alternativa C",
  "Alternativa_D": "Texto da alternativa D",
  "Alternativa_E": "Texto da alternativa E",
  "Gabarito": "${gabaritoAlvo}",
  "Comentario": "Explicação detalhada do gabarito..."
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || 'Erro na Gemini API' },
        { status: res.status }
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let questao: any;
    try {
      questao = JSON.parse(text);
    } catch {
      // Tenta extrair JSON do texto
      const match = text.match(/\{[\s\S]*\}/);
      questao = match ? JSON.parse(match[0]) : null;
    }

    if (!questao) {
      return NextResponse.json({ error: 'Gemini retornou resposta inválida.' }, { status: 500 });
    }

    return NextResponse.json({ questao });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
