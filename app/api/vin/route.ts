import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const NHTSA_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function isValidVin(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

interface NhtsaResult {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  ErrorCode?: string;
  ErrorText?: string;
}

async function decodeWithNhtsa(vin: string) {
  const res = await fetch(`${NHTSA_URL}/${encodeURIComponent(vin)}?format=json`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`NHTSA ${res.status}`);
  const data = (await res.json()) as { Results?: NhtsaResult[] };
  const r = data.Results?.[0];
  if (!r) return null;
  const make = (r.Make ?? '').trim();
  const model = (r.Model ?? '').trim();
  const year = Number(r.ModelYear);
  if (!make || !model || !year) return null;
  return {
    make: make.charAt(0) + make.slice(1).toLowerCase(),
    model: model.charAt(0) + model.slice(1).toLowerCase(),
    year,
  };
}

async function decodeWithLlm(vin: string, apiKey: string) {
  const prompt = `Декодируй VIN: ${vin}. Верни ТОЛЬКО валидный JSON: {"make":"...","model":"...","year":2020}`;
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bi-avto-pro.vercel.app',
      'X-Title': 'BI-Avto-PRO',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(content) as { make?: string; model?: string; year?: number };
  if (!parsed.make || !parsed.model) return null;
  return {
    make: String(parsed.make),
    model: String(parsed.model),
    year: Number(parsed.year) || new Date().getFullYear(),
  };
}

export async function POST(req: NextRequest) {
  const { vin } = await req.json();
  if (!vin || typeof vin !== 'string') {
    return NextResponse.json({ error: 'VIN обязателен' }, { status: 400 });
  }

  const cleanVin = vin.trim().toUpperCase();
  if (!isValidVin(cleanVin)) {
    return NextResponse.json(
      { error: 'VIN должен быть ровно 17 символов (без I, O, Q)' },
      { status: 400 }
    );
  }

  try {
    const nhtsa = await decodeWithNhtsa(cleanVin);
    if (nhtsa) {
      console.log('[vin] decoded via NHTSA:', nhtsa);
      return NextResponse.json(nhtsa);
    }
    console.log('[vin] NHTSA returned empty, falling back to LLM');
  } catch (err) {
    console.warn('[vin] NHTSA failed:', err);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Не удалось декодировать VIN' }, { status: 502 });
  }

  try {
    const llm = await decodeWithLlm(cleanVin, apiKey);
    if (llm) {
      console.log('[vin] decoded via LLM fallback:', llm);
      return NextResponse.json(llm);
    }
  } catch (err) {
    console.error('[vin] LLM fallback failed:', err);
  }

  return NextResponse.json({ error: 'Не удалось декодировать VIN' }, { status: 502 });
}
