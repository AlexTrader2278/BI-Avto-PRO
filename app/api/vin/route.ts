import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'perplexity/sonar';

function extractJson(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  s = s.trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY не настроен на сервере' }, { status: 500 });
  }

  const { vin } = await req.json();
  if (!vin) {
    return NextResponse.json({ error: 'VIN обязателен' }, { status: 400 });
  }

  const prompt = `Декодируй VIN номер: ${vin}

Верни ТОЛЬКО валидный JSON без markdown:
{"make": "Марка", "model": "Модель", "year": 2020}`;

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
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter HTTP error:', response.status, errText);
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'API-ключ OpenRouter недействителен. Обнови OPENROUTER_API_KEY в Vercel.' },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: `OpenRouter ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    let parsed: { make?: string; model?: string; year?: number };
    try {
      parsed = JSON.parse(extractJson(content));
    } catch (parseErr) {
      console.error('VIN JSON parse error:', parseErr, '\nRaw:', content.slice(0, 300));
      return NextResponse.json({ error: 'Не удалось декодировать VIN' }, { status: 502 });
    }

    return NextResponse.json({
      make: parsed.make ?? '',
      model: parsed.model ?? '',
      year: Number(parsed.year) || new Date().getFullYear(),
    });
  } catch (err) {
    console.error('vin error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка VIN декодера' },
      { status: 500 }
    );
  }
}
