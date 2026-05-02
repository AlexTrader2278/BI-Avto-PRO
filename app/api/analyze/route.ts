import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'perplexity/sonar';

function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
}

function extractJson(raw: string): string {
  // Strip citation markers first so they don't break JSON
  let s = stripCitationMarkers(raw);

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find the outermost { } pair
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

  // Remove inline citation markers that might be embedded in string values
  // e.g. "cause": "Wear [1] on the gasket [2]" → "cause": "Wear  on the gasket "
  s = s.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '');

  return s.trim();
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  // First try: direct parse
  try { return JSON.parse(extractJson(raw)); } catch { /* fall through */ }

  // Second try: strip all control characters and retry
  try {
    const cleaned = extractJson(raw).replace(/[\x00-\x1F\x7F]/g, (ch) =>
      ch === '\n' || ch === '\r' || ch === '\t' ? ch : ''
    );
    return JSON.parse(cleaned);
  } catch { /* fall through */ }

  // Third try: extract just the "problems" array if root parse fails
  try {
    const m = raw.match(/"problems"\s*:\s*(\[[\s\S]*?\])/);
    if (m) {
      const problems = JSON.parse(m[1].replace(/\s*\[\d+(?:,\s*\d+)*\]/g, ''));
      return { problems };
    }
  } catch { /* fall through */ }

  return null;
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

  const prompt = `Ты — эксперт по диагностике автомобилей. ВАЖНО: твой ответ должен содержать ТОЛЬКО JSON, никакого другого текста.

Для автомобиля ${make} ${model} ${year} года с пробегом ${mileage} км дай топ-5 наиболее частых проблем на основе данных с форумов Дром.ру, Drive2.ru, Reddit.

ФОРМАТ ОТВЕТА — строго этот JSON и ничего больше (никаких пояснений до или после, никаких [1][2] маркеров):
{"problems":[{"name":"Название","probability":75,"mileageRange":"100000-150000 км","cause":"Причина","solution":"Решение","severity":"critical"},{"name":"Название2","probability":60,"mileageRange":"80000-120000 км","cause":"Причина2","solution":"Решение2","severity":"medium"}],"recommendations":["Рекомендация 1","Рекомендация 2"],"mermaidPie":"pie title Вероятности\n    \\"Проблема 1\\" : 75"}

severity: "critical"=срочный ремонт, "medium"=стоит проверить, "low"=плановое.
probability: целое число 0-100.
Верни ТОЛЬКО JSON без какого-либо текста вокруг него.`;

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

    const parsed = safeParseJson(content) as { problems?: RawProblem[]; recommendations?: string[]; mermaidPie?: string } | null;
    if (!parsed) {
      console.error('JSON parse failed. Raw:', content.slice(0, 600));
      return NextResponse.json(
        { error: 'AI вернул некорректный ответ. Попробуйте ещё раз — иногда это случается с нестандартными моделями.' },
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
