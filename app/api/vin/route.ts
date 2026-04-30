import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'perplexity/sonar';

function cleanJson(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
  }

  const { vin } = await req.json();
  if (!vin) {
    return NextResponse.json({ error: 'VIN обязателен' }, { status: 400 });
  }

  const prompt = `Декодируй VIN номер: ${vin}

Верни ТОЛЬКО валидный JSON без markdown-обёртки:
{"make": "Марка", "model": "Модель", "year": 2020}

Верни ТОЛЬКО JSON.`;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bi-avto-pro.vercel.app',
        'X-Title': 'BI-Avto-PRO',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка запроса к AI' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(cleanJson(content));

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('vin error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка VIN декодера' },
      { status: 500 }
    );
  }
}
