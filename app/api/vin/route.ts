import { NextRequest, NextResponse } from 'next/server';
import { decodeWmi, decodeYear, isVinValid } from '@/lib/vinDecoder';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface VinResult {
  make: string;
  model: string;
  year: number;
  country?: string;
  manufacturer?: string;
}

function normalizeMake(s: string): string {
  return s.trim().toLowerCase().replace(/[-_\s]/g, '');
}

function makesMatch(aiMake: string, expectedMakes: string[]): boolean {
  const a = normalizeMake(aiMake);
  return expectedMakes.some((m) => {
    const e = normalizeMake(m);
    return a === e || a.includes(e) || e.includes(a);
  });
}

async function askLlm(
  apiKey: string,
  vin: string,
  manufacturer: string | null,
  expectedMakes: string[] | null,
  year: number | null
): Promise<{ make: string; model: string } | null> {
  const yearHint = year ? `Год выпуска (позиция 10 VIN): ${year}.` : '';
  const wmiHint = manufacturer
    ? `Производитель по WMI (${vin.slice(0, 3)}): ${manufacturer}.`
    : `WMI ${vin.slice(0, 3)} в локальной таблице отсутствует — определи производителя самостоятельно.`;
  const expectedHint =
    expectedMakes && expectedMakes.length > 0
      ? `Ожидаемая марка (одна из): ${expectedMakes.join(', ')}.`
      : '';

  const prompt = `VIN: ${vin}
${wmiHint}
${yearHint}
${expectedHint}

Найди в открытых источниках (форумы, базы дилеров, объявления о продаже с этим VIN или похожими по структуре VDS-кодом) точную марку и модель этого автомобиля. ВДС-код (символы 4-8) определяет конкретную модель и кузов внутри производителя.

Верни ТОЛЬКО валидный JSON без пояснений:
{"make": "марка", "model": "конкретная модель"}`;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bi-avto-pro.vercel.app',
      'X-Title': 'BI-Avto-PRO',
    },
    body: JSON.stringify({
      model: 'perplexity/sonar',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn('[vin] LLM HTTP error:', res.status, errText.slice(0, 200));
    return null;
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  let s = content.trim();
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1) s = s.slice(first, last + 1);

  try {
    const parsed = JSON.parse(s) as { make?: string; model?: string };
    if (!parsed.make || !parsed.model) return null;
    return { make: String(parsed.make), model: String(parsed.model) };
  } catch (err) {
    console.warn('[vin] LLM JSON parse failed:', err, '\nRaw:', content.slice(0, 200));
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { vin } = await req.json();
  if (!vin || typeof vin !== 'string') {
    return NextResponse.json({ error: 'VIN обязателен' }, { status: 400 });
  }

  const cleanVin = vin.trim().toUpperCase();
  if (!isVinValid(cleanVin)) {
    return NextResponse.json(
      { error: 'VIN должен быть 17 символов латиницей/цифрами (без I, O, Q)' },
      { status: 400 }
    );
  }

  // ── Шаг 1: детерминированный разбор VIN ──
  const wmi = decodeWmi(cleanVin);
  const year = decodeYear(cleanVin);

  console.log('[vin] WMI:', wmi, 'year:', year);

  // ── Шаг 2: LLM (всегда вызываем, даже если WMI неизвестен) ──
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fallbackYear = year ?? new Date().getFullYear();
  const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

  if (!apiKey) {
    return NextResponse.json(
      {
        make: wmi?.expectedMakes[0] ?? '',
        model: '',
        year: fallbackYear,
        country: wmi?.country,
        manufacturer: wmi?.manufacturer,
      } satisfies VinResult,
      { headers: noStoreHeaders }
    );
  }

  const llmResult = await askLlm(
    apiKey,
    cleanVin,
    wmi?.manufacturer ?? null,
    wmi?.expectedMakes ?? null,
    year
  );

  // ── Шаг 3: собираем итоговый ответ ──
  let finalMake = wmi?.expectedMakes[0] ?? '';
  let finalModel = '';

  if (wmi && llmResult && makesMatch(llmResult.make, wmi.expectedMakes)) {
    finalMake = llmResult.make;
    finalModel = llmResult.model;
    console.log('[vin] LLM accepted (matches WMI):', llmResult);
  } else if (wmi && llmResult) {
    console.warn(
      `[vin] LLM make "${llmResult.make}" не совпадает с WMI ${wmi.expectedMakes.join('/')} — оставляем марку из WMI`
    );
    finalMake = wmi.expectedMakes[0];
    finalModel = llmResult.model;
  } else if (!wmi && llmResult) {
    finalMake = llmResult.make;
    finalModel = llmResult.model;
    console.log('[vin] WMI unknown — fully trusting LLM:', llmResult);
  } else {
    console.warn('[vin] No WMI and no LLM result — returning empty fields');
  }

  return NextResponse.json(
    {
      make: finalMake,
      model: finalModel,
      year: fallbackYear,
      country: wmi?.country,
      manufacturer: wmi?.manufacturer,
    } satisfies VinResult,
    { headers: noStoreHeaders }
  );
}
