import { CarInput, AnalysisResult, ChatMessage } from './types';

export async function analyzeCar(data: CarInput): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Ошибка анализа');
  return json;
}

export async function lookupVin(vin: string): Promise<{ make: string; model: string; year: number }> {
  const res = await fetch('/api/vin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vin }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Ошибка VIN декодера');
  return json;
}

export async function chatWithAI(messages: ChatMessage[], carContext?: CarInput): Promise<string> {
  const res = await fetch('/api/chat-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, carContext }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Ошибка чата');
  return json.reply;
}
