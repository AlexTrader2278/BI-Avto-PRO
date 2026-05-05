import { NextRequest, NextResponse } from 'next/server';
import { analysisCache, makeAnalysisCacheKey, incrementAnalysisCount } from '@/lib/cache';
import { analyzeRateLimiter, getClientIp, rateLimitResponse } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

async function fetchWithKey(apiKey: string, model: string, messages: object[], extra?: object) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bi-avto-pro.vercel.app',
      'X-Title': 'BI-Avto-PRO',
    },
    body: JSON.stringify({ model, messages, ...extra }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw Object.assign(new Error(errText.slice(0, 300)), { status: res.status });
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY не настроен на сервере' }, { status: 500 });
  }

  // ── Rate limiting ──
  const ip = getClientIp(req);
  const rl = analyzeRateLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(rateLimitResponse(rl.resetAt), { status: 429 });
  }

  const { make, model, year, mileage } = await req.json();

  if (!make || !model || !year || mileage === undefined) {
    return NextResponse.json({ error: 'Заполните марку, модель, год и пробег' }, { status: 400 });
  }

  // ── Cache check ──
  const cacheKey = makeAnalysisCacheKey(make, model, year, mileage);
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } });
  }

  try {
    // ── Шаг 1: Perplexity Sonar ищет реальные данные с форумов + даёт живые ссылки ──
    let forumText = '';
    let citations: string[] = [];

    try {
      const sonarData = await fetchWithKey(
        apiKey,
        'perplexity/sonar',
        [{
          role: 'user',
          content: `Найди топ-5 самых частых проблем и поломок для ${make} ${model} ${year} года с пробегом ${mileage} км. Используй данные с форумов Дром.ру, Drive2.ru, Reddit. Опиши каждую проблему: название, причина, решение, при каком пробеге проявляется. Отвечай на русском языке.`,
        }],
        { temperature: 0.2 }
      );
      forumText = sonarData.choices?.[0]?.message?.content ?? '';
      citations = Array.isArray(sonarData.citations) ? sonarData.citations : [];
    } catch (sonarErr) {
      console.warn('Perplexity step failed, proceeding without forum text:', sonarErr);
      // Продолжаем без форумного текста — GPT справится сам
    }

    // ── Шаг 2: GPT-4o-mini структурирует найденное в гарантированный JSON ──
    const structurePrompt = forumText
      ? `На основе этих данных с форумов о ${make} ${model} ${year} года:\n\n${forumText}\n\nСформируй топ-5 проблем в JSON.`
      : `На основе своих знаний о типичных проблемах ${make} ${model} ${year} года с пробегом ${mileage} км сформируй топ-5 проблем.`;

    const gptData = await fetchWithKey(
      apiKey,
      'openai/gpt-4o-mini',
      [{
        role: 'system',
        content: 'Ты — эксперт по диагностике автомобилей. Возвращай ТОЛЬКО валидный JSON без пояснений.',
      }, {
        role: 'user',
        content: `${structurePrompt}

JSON формат:
{
  "problems": [
    {
      "name": "Название проблемы",
      "probability": 75,
      "mileageRange": "100000-150000 км",
      "cause": "Причина",
      "solution": "Что делать",
      "severity": "critical"
    }
  ],
  "recommendations": ["Рекомендация 1", "Рекомендация 2", "Рекомендация 3"],
  "mermaidPie": "pie title Вероятности проблем\\n    \\"Проблема 1\\" : 75\\n    \\"Проблема 2\\" : 60"
}

severity: "critical"=срочный ремонт, "medium"=стоит проверить, "low"=плановое.
probability: целое число 1-95. Ровно 5 проблем.`,
      }],
      { temperature: 0.2, response_format: { type: 'json_object' } }
    );

    const content: string = gptData.choices?.[0]?.message?.content ?? '';
    if (!content) {
      return NextResponse.json({ error: 'AI вернул пустой ответ. Попробуйте ещё раз.' }, { status: 502 });
    }

    const parsed = JSON.parse(content) as {
      problems?: RawProblem[];
      recommendations?: string[];
      mermaidPie?: string;
    };

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

    const result = {
      id: `BI-${Date.now()}`,
      make,
      model,
      year,
      mileage,
      problems: cleanProblems,
      recommendations: (parsed.recommendations ?? []).map((r) => stripCitationMarkers(String(r))),
      sources: citations,
      mermaidPie: parsed.mermaidPie ?? '',
      analysisCount: incrementAnalysisCount(),
    };

    analysisCache.set(cacheKey, result);

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });

  } catch (err: unknown) {
    console.error('analyze error:', err);
    const status = (err as { status?: number }).status;
    if (status === 401) {
      return NextResponse.json({ error: 'API-ключ OpenRouter недействителен. Обнови OPENROUTER_API_KEY в Vercel.' }, { status: 502 });
    }
    if (status === 402) {
      return NextResponse.json({ error: 'На балансе OpenRouter закончились средства.' }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ошибка анализа. Попробуйте ещё раз.' },
      { status: 500 }
    );
  }
}
