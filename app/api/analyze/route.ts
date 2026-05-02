import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'perplexity/sonar';

function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
}

function extractJson(text: string): string {
  let s = text.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  s = s.trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

interface RawProblem {
  name?: string;
  probability?: number | string;
  mileageRange?: string;
  cause?: string;
  solution?: string;
  severity?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY не настроен на сервере' }, { status: 500 });
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

Верни ТОЛЬКО валидный JSON, без markdown, без пояснений, без ссылочных маркеров вида [1] [2]:
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
Не вставляй [1], [2] и подобные маркеры цитат внутрь полей JSON.
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
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter HTTP error:', response.status, errText);
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'API-ключ OpenRouter недействителен. Получи новый ключ на https://openrouter.ai/keys и обнови переменную OPENROUTER_API_KEY в Vercel → Settings → Environment Variables, затем сделай Redeploy.' },
          { status: 502 }
        );
      }
      if (response.status === 402) {
        return NextResponse.json(
          { error: 'На балансе OpenRouter закончились средства. Пополни баланс на https://openrouter.ai/credits' },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: `OpenRouter ${response.status}: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const citations: string[] = Array.isArray(data.citations) ? data.citations : [];

    if (!content) {
      return NextResponse.json({ error: 'AI вернул пустой ответ' }, { status: 502 });
    }

    let parsed: { problems?: RawProblem[]; recommendations?: string[]; mermaidPie?: string };
    try {
      parsed = JSON.parse(extractJson(content));
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, '\nRaw:', content.slice(0, 500));
      return NextResponse.json(
        { error: 'AI вернул некорректный JSON. Попробуйте ещё раз.' },
        { status: 502 }
      );
    }

    const cleanProblems = (parsed.problems ?? []).map((p) => ({
      name: stripCitationMarkers(String(p.name ?? '')),
      probability: Math.max(0, Math.min(100, Number(p.probability) || 0)),
      mileageRange: stripCitationMarkers(String(p.mileageRange ?? '')),
      cause: stripCitationMarkers(String(p.cause ?? '')),
      solution: stripCitationMarkers(String(p.solution ?? '')),
      severity: (['critical', 'medium', 'low'] as const).includes(p.severity as 'critical' | 'medium' | 'low')
        ? (p.severity as 'critical' | 'medium' | 'low')
        : 'medium',
    }));

    const cleanRecs = (parsed.recommendations ?? []).map((r) => stripCitationMarkers(String(r)));

    return NextResponse.json({
      id: `BI-${Date.now()}`,
      make,
      model,
      year,
      mileage,
      problems: cleanProblems,
      recommendations: cleanRecs,
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
