import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'perplexity/sonar';

function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY не настроен на сервере' }, { status: 500 });
  }

  const { messages, carContext } = await req.json();

  const systemContent = carContext?.make
    ? `Ты — эксперт по диагностике автомобилей BI-Avto-PRO. Контекст: ${carContext.make} ${carContext.model} ${carContext.year} года, пробег ${carContext.mileage} км. Отвечай кратко и по делу на русском языке. Не вставляй ссылочные маркеры [1], [2].`
    : 'Ты — эксперт по диагностике автомобилей BI-Avto-PRO. Отвечай кратко и по делу на русском языке. Не вставляй ссылочные маркеры [1], [2].';

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
        messages: [{ role: 'system', content: systemContent }, ...messages],
        temperature: 0.3,
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
      if (response.status === 402) {
        return NextResponse.json(
          { error: 'На балансе OpenRouter закончились средства.' },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: `OpenRouter ${response.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply = stripCitationMarkers(data.choices?.[0]?.message?.content ?? '');

    if (!reply) {
      return NextResponse.json({ error: 'AI вернул пустой ответ' }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('chat error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка чата' },
      { status: 500 }
    );
  }
}
