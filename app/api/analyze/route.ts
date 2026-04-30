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

  const { make, model, year, mileage } = await req.json();

  if (!make || !model || !year || mileage === undefined) {
    return NextResponse.json({ error: 'Заполните марку, модель, год и пробег' }, { status: 400 });
  }

  const prompt = `Ты — эксперт по диагностике автомобилей. Используй актуальные данные с форумов Дром.ру, Drive2.ru, Reddit, AvtoForumRF.

Для автомобиля ${make} ${model} ${year} года с пробегом ${mileage} км:
- Найди топ-5 наиболее частых проблем и поломок для этой модели
- Оцени вероятность каждой проблемы именно для данного пробега (на основе статистики форумных обсуждений)
- Укажи диапазон пробега, при котором проблема чаще всего проявляется
- Дай практические рекомендации

Верни ТОЛЬКО валидный JSON без markdown-обёртки:
{
  "problems": [
    {
      "name": "Короткое название проблемы",
      "probability": 75,
      "mileageRange": "100 000 — 150 000 км",
      "cause": "Конкретная причина",
      "solution": "Что делать",
      "severity": "critical"
    }
  ],
  "recommendations": [
    "Рекомендация 1",
    "Рекомендация 2"
  ],
  "mermaidPie": "pie title Вероятности проблем\n    \\"Проблема 1\\" : 75\n    \\"Проблема 2\\" : 60"
}

severity: "critical" = срочно нужен ремонт, "medium" = стоит проверить, "low" = плановое обслуживание.
probability: число от 0 до 100.
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
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter error: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const citations: string[] = data.citations ?? [];

    const parsed = JSON.parse(cleanJson(content));

    return NextResponse.json({
      id: `BI-${Date.now()}`,
      make,
      model,
      year,
      mileage,
      problems: parsed.problems ?? [],
      recommendations: parsed.recommendations ?? [],
      sources: citations,
      mermaidPie: parsed.mermaidPie ?? '',
    });
  } catch (err) {
    console.error('analyze error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка анализа' },
      { status: 500 }
    );
  }
}
