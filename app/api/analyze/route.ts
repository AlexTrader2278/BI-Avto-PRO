import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// gpt-4o-mini supports response_format: json_object → guaranteed valid JSON every time
const MODEL = 'openai/gpt-4o-mini';

function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
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

  const prompt = `Ты — эксперт по диагностике автомобилей. Твои знания основаны на данных с форумов Дром.ру, Drive2.ru, Reddit и других автомобильных сообществ.

Для автомобиля ${make} ${model} ${year} года с пробегом ${mileage} км дай топ-5 наиболее частых проблем и поломок.

Верни JSON строго в этом формате:
{
  "problems": [
    {
      "name": "Короткое название проблемы",
      "probability": 75,
      "mileageRange": "100000-150000 км",
      "cause": "Конкретная причина",
      "solution": "Что делать владельцу",
      "severity": "critical"
    }
  ],
  "recommendations": ["Рекомендация 1", "Рекомендация 2", "Рекомендация 3"],
  "mermaidPie": "pie title Вероятности проблем\n    \\"Проблема 1\\" : 75\n    \\"Проблема 2\\" : 60"
}

Правила:
- severity: только "critical" (срочный ремонт), "medium" (стоит проверить), "low" (плановое)
- probability: целое число от 1 до 95
- Если модель редкая или малоизвестная — давай ответ на основе типичных проблем схожих платформ/двигателей
- Ровно 5 проблем в массиве problems`;

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
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter HTTP error:', response.status, errText);
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'API-ключ OpenRouter недействителен. Обнови OPENROUTER_API_KEY в Vercel → Settings → Environment Variables.' },
          { status: 502 }
        );
      }
      if (response.status === 402) {
        return NextResponse.json(
          { error: 'На балансе OpenRouter закончились средства. Пополни баланс на openrouter.ai/credits' },
          { status: 502 }
        );
      }
      return NextResponse.json(
        { error: `Ошибка сервера AI (${response.status}). Попробуйте ещё раз.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';

    if (!content) {
      return NextResponse.json({ error: 'AI вернул пустой ответ. Попробуйте ещё раз.' }, { status: 502 });
    }

    // With response_format: json_object this should always parse, but keep safety net
    let parsed: { problems?: RawProblem[]; recommendations?: string[]; mermaidPie?: string };
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('JSON parse error (unexpected):', err, '\nRaw:', content.slice(0, 400));
      return NextResponse.json(
        { error: 'Ошибка обработки ответа AI. Попробуйте ещё раз.' },
        { status: 502 }
      );
    }

    const cleanProblems = (parsed.problems ?? []).map((p) => ({
      name: stripCitationMarkers(String(p.name ?? '')),
      probability: Math.max(1, Math.min(95, Number(p.probability) || 50)),
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
      sources: [],
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
