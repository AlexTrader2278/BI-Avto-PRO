import { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface ChatRequest {
  message: string;
  history?: Array<{ role: 'user' | 'model'; text: string }>;
  type?: 'analyze' | 'lookup-vin' | 'research';
  carData?: any;
}

interface ChatResponse {
  reply: string;
  sources?: Array<{ title: string; uri: string }>;
  data?: any;
  error?: string;
}

async function callGeminiAPI(prompt: string, systemInstruction: string, type: string = 'default'): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  const body = {
    contents: [{
      parts: [{ text: prompt }],
    }],
    systemInstruction: systemInstruction,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: type === 'json' ? 'application/json' : 'text/plain',
    },
  };

  try {
    const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse<ChatResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', reply: '' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY not configured',
      reply: 'Ошибка конфигурации: API ключ не задан',
    });
  }

  try {
    const { message, type, carData } = req.body as ChatRequest;

    if (!message) {
      return res.status(400).json({ error: 'Message is required', reply: '' });
    }

    let reply = '';

    if (type === 'analyze' && carData) {
      const systemInstruction = `Ты — эксперт BI-AVTO PRO.
      1. Анализируй ФАЙЛЫ (акты работ, историю ТО).
      2. Дополняй статистикой по модели из сети.
      3. Выдавай четкий технический вердикт и план работ.
      Формат ответа: JSON.`;

      const prompt = `АВТОМОБИЛЬ: ${carData.make} ${carData.model}, пробег ${carData.mileage} км.
      ЖАЛОБА: "${carData.complaint}"
      Верни JSON: { detailedIssues, upsells[{name, reason, critical}], predictiveAnalysis{failureProbability, reasoning}, mermaidPie, mermaidGantt, costForecast, categoryDistribution }`;

      reply = await callGeminiAPI(prompt, systemInstruction, 'json');
    } else if (type === 'lookup-vin' && carData?.vin) {
      const prompt = `VIN: ${carData.vin}. Верни JSON: { make, model, year }`;
      reply = await callGeminiAPI(prompt, 'Determine car make, model, year from VIN.', 'json');
    } else {
      reply = await callGeminiAPI(message, 'You are a helpful AI assistant.', 'text');
    }

    return res.status(200).json({
      reply,
      data: type === 'analyze' || type === 'lookup-vin' ? JSON.parse(reply) : undefined,
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      reply: 'Произошла ошибка при обработке запроса. Попробуйте позже.',
    });
  }
}
