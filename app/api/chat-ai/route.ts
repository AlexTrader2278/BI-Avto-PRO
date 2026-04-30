import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'perplexity/sonar';

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
  }

  const { messages, carContext } = await req.json();

  const systemContent = carContext?.make
    ? `Ты — эксперт по диагностике автомобилей BI-Avto-PRO. Контекст: ${carContext.make} ${carContext.model} ${carContext.year} года, пробег ${carContext.mileage} км. Отвечай кратко и по делу на русском языке.`
    : 'Ты — эксперт по диагностике автомобилей BI-Avto-PRO. Отвечай кратко и по делу на русском языке.';

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
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка запроса к AI' }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('chat error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка чата' },
      { status: 500 }
    );
  }
}
