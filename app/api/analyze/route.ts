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
          content: `Автомобиль ${make} ${model} ${year} года, текущий пробег ${mileage} км. Найди на форумах Дром.ру, Drive2.ru, Reddit актуальные проблемы и поломки которые: 1) уже проявляются при пробеге около ${mileage} км, или 2) характерны для следующих 20000-50000 км (${mileage}–${mileage + 50000} км). НЕ включай проблемы которые типично случаются при пробеге значительно меньше ${mileage} км — они уже пройдены. Отвечай на русском языке. В ответе обязательно приводи ссылки на источники.`,
        }],
        { temperature: 0.2, return_citations: true }
      );

      console.log('[analyze] Perplexity raw response keys:', Object.keys(sonarData));
      console.log('[analyze] Perplexity citations field:', JSON.stringify(sonarData.citations));
      console.log('[analyze] Perplexity search_results field:', JSON.stringify(sonarData.search_results));
      console.log('[analyze] Perplexity message keys:', sonarData.choices?.[0]?.message ? Object.keys(sonarData.choices[0].message) : 'no message');

      forumText = sonarData.choices?.[0]?.message?.content ?? '';

      const citationCandidates: string[] = [];

      if (Array.isArray(sonarData.citations)) {
        for (const c of sonarData.citations) {
          if (typeof c === 'string') citationCandidates.push(c);
          else if (c && typeof c.url === 'string') citationCandidates.push(c.url);
        }
      }

      if (Array.isArray(sonarData.search_results)) {
        for (const r of sonarData.search_results) {
          if (r && typeof r.url === 'string') citationCandidates.push(r.url);
        }
      }

      const annotations = sonarData.choices?.[0]?.message?.annotations;
      if (Array.isArray(annotations)) {
        for (const a of annotations) {
          const url = a?.url_citation?.url ?? a?.url;
          if (typeof url === 'string') citationCandidates.push(url);
        }
      }

      if (citationCandidates.length === 0 && forumText) {
        const urlRegex = /https?:\/\/[^\s)\]]+/g;
        const matches = forumText.match(urlRegex);
        if (matches) citationCandidates.push(...matches);
      }

      citations = Array.from(new Set(citationCandidates.map((u) => u.replace(/[.,;:]+$/, ''))));
      console.log(`[analyze] Final citations count: ${citations.length}`);
    } catch (sonarErr) {
      console.warn('Perplexity step failed, proceeding without forum text:', sonarErr);
    }

    // ── Шаг 2: GPT-4o-mini структурирует найденное в гарантированный JSON ──
    const structurePrompt = forumText
      ? `Данные с форумов о ${make} ${model} ${year} года:\n\n${forumText}`
      : `Используй свои знания о ${make} ${model} ${year} года.`;

    const gptData = await fetchWithKey(
      apiKey,
      'openai/gpt-4o-mini',
      [{
        role: 'system',
        content: 'Ты — эксперт по диагностике автомобилей. Возвращай ТОЛЬКО валидный JSON без пояснений.',
      }, {
        role: 'user',
        content: `${structurePrompt}

Автомобиль: ${make} ${model} ${year} года. ТЕКУЩИЙ ПРОБЕГ: ${mileage} км.

Сформируй топ-5 проблем строго по этим правилам:
1. Показывай ТОЛЬКО проблемы актуальные для пробега от ${mileage} км и выше
2. НЕ включай проблемы которые обычно случаются ДО ${mileage} км — они уже позади
3. Для каждой проблемы mileageRange должен быть >= ${mileage} км
4. probability — вероятность именно при данном пробеге ${mileage} км

JSON формат:
{
  "problems": [
    {
      "name": "Название проблемы",
      "probability": 75,
      "mileageRange": "${mileage}–${mileage + 30000} км",
      "cause": "Причина",
      "solution": "Что делать",
      "severity": "critical"
    }
  ],
  "recommendations": ["Рекомендация с учётом пробега ${mileage} км"],
  "mermaidPie": "pie title Вероятности\\n    \\"Проблема 1\\" : 75"
}

severity: "critical"=срочный ремонт сейчас, "medium"=проверить в ближайшее время, "low"=плановое.
probability: вероятность именно при пробеге ${mileage} км, целое число 1-95.
Ровно 5 проблем. mileageRange у каждой >= ${mileage} км.`,
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
