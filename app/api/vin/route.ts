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
  manufacturer: string,
  expectedMakes: string[],
  year: number | null
): Promise<{ make: string; model: string } | null> {
  const yearHint = year ? `Год выпуска (по позиции 10 VIN): ${year}.` : '';
  const prompt = `VIN: ${vin}
Производитель из WMI: ${manufacturer}.
${yearHint}
Ожидаемая марка (одна из): ${expectedMakes.join(', ')}.

Найди в открытых источниках (форумы, базы дилеров, объявления о продаже с этим VIN или похожими по структуре VDS-кодом) точную модель этого автомобиля. ВДС-код (символы 4-8) определяет конкретную модель и кузов внутри производителя.

Верни ТОЛЬКО валидный JSON без пояснений:
{"make": "марка из списка ожидаемых", "model": "конкретная модель"}`;

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

  if (!wmi) {
    return NextResponse.json(
      { error: `Производитель по VIN не определён (WMI: ${cleanVin.slice(0, 3)}). Заполните марку и модель вручную.` },
      { status: 422 }
    );
  }

  // ── Шаг 2: LLM с поиском по форумам уточняет конкретную модель ──
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      make: wmi.expectedMakes[0],
      model: '',
      year: year ?? new Date().getFullYear(),
      country: wmi.country,
      manufacturer: wmi.manufacturer,
    } satisfies VinResult);
  }

  const llmResult = await askLlm(apiKey, cleanVin, wmi.manufacturer, wmi.expectedMakes, year);

  // ── Шаг 3: валидация — марка от AI должна совпадать с ожидаемой по WMI ──
  let finalMake = wmi.expectedMakes[0];
  let finalModel = '';

  if (llmResult && makesMatch(llmResult.make, wmi.expectedMakes)) {
    finalMake = llmResult.make;
    finalModel = llmResult.model;
    console.log('[vin] LLM result accepted:', llmResult);
  } else if (llmResult) {
    console.warn(
      `[vin] LLM make "${llmResult.make}" не совпадает с WMI ${wmi.expectedMakes.join('/')} — используем модель но ставим марку из WMI`
    );
    finalMake = wmi.expectedMakes[0];
    finalModel = llmResult.model;
  } else {
    console.warn('[vin] LLM не вернул результат — отдаём только марку по WMI');
  }

  return NextResponse.json({
    make: finalMake,
    model: finalModel,
    year: year ?? new Date().getFullYear(),
    country: wmi.country,
    manufacturer: wmi.manufacturer,
  } satisfies VinResult);
}
