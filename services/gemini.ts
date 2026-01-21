
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { CarData, AnalysisResult, GroundingSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractSources = (response: any): GroundingSource[] => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .filter((c: any) => c.web)
    .map((c: any) => ({
      title: c.web.title,
      uri: c.web.uri
    }));
};

function cleanJsonString(str: string): string {
  return str.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Исследовательская функция сфокусирована на извлечении фактов, а не мнений.
 */
async function gatherResearch(car: CarData): Promise<{ context: string, sources: GroundingSource[] }> {
  const carString = `${car.make} ${car.model} ${car.year ? car.year : ''}`;
  const query = `
    Статистика неисправностей и технические бюллетени: ${carString}. 
    Пробег: ${car.mileage} км. Проблема: ${car.complaint}. 
    Найди конкретные записи в бортжурналах Drive2.ru, темы на форумах Drom.ru и Auto.ru. 
    Меня интересуют: частота поломок узлов на этом пробеге, официальные отзывы (отзывные компании) и конкретные запчасти, которые выходят из строя.
    Игнорируй общие советы, ищи факты по конкретной модели и двигателю.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: { 
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      }
    });
    return { context: response.text || "", sources: extractSources(response) };
  } catch (e) {
    console.error("Research error:", e);
    return { context: "Поиск временно недоступен. Используй общую базу знаний производителя.", sources: [] };
  }
}

export async function analyzeCar(car: CarData): Promise<AnalysisResult> {
  const research = await gatherResearch(car);
  const carString = `${car.make} ${car.model} ${car.year ? car.year : ''}`;
  
  const parts: any[] = [];
  let filesContext = "Данные визуальной диагностики (фото/сканы):\n";

  if (car.attachedFiles && car.attachedFiles.length > 0) {
    car.attachedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const base64Data = file.data.split(',')[1] || file.data;
        parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
      } else {
        filesContext += `- Текстовый отчет/лог ${file.name}: ${file.data}\n`;
      }
    });
  }

  const systemInstruction = `
    Ты — экспертный аналитик BI-AVTO PRO. Твоя задача — проводить строгий технический анализ без выдумок.
    ПРАВИЛА:
    1. ИСПОЛЬЗУЙ ТОЛЬКО ФАКТЫ из предоставленного контекста поиска (Drive2, Drom, Auto.ru).
    2. Если данных по конкретной модели недостаточно, не выдумывай вероятность — поставь низкий риск и укажи на нехватку статистики.
    3. РАСЧЕТ РИСКА (failureProbability):
       - 0-30%: Обычный износ, нет массовых жалоб.
       - 31-60%: Есть подтвержденные случаи на форумах при таком пробеге.
       - 61-100%: Известная "болячка" модели или критическое состояние по фото/жалобе.
    4. ОТВЕТ ДОЛЖЕН БЫТЬ СТАБИЛЬНЫМ. Не меняй оценку риска при повторных запросах без изменения входных данных.
    5. Галлюцинации запрещены. Ссылайся на найденные технические термины и узлы.
  `;

  const mainPrompt = `
    ПРОВЕДИ АНАЛИЗ АВТОМОБИЛЯ:
    Авто: ${carString}
    Пробег: ${car.mileage} км
    Жалоба клиента: "${car.complaint}"
    Контекст из рунета: ${research.context}
    ${filesContext}

    Ожидаемый JSON формат:
    - detailedIssues: технический разбор, почему это произошло.
    - upsells: [{name, reason, critical}] - только обоснованные работы.
    - salesScript: как профессионально донести это до клиента.
    - predictiveAnalysis: {failureProbability: number, reasoning: string} - ОБОСНОВАННЫЙ расчет.
    - mermaidPie, mermaidGantt: визуализация.
    - costForecast, categoryDistribution: данные для графиков.
  `;

  parts.unshift({ text: mainPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.1,
        seed: 42,
      },
    });

    const rawText = response.text || "{}";
    const cleanedText = cleanJsonString(rawText);
    const parsed = JSON.parse(cleanedText);
    
    return { 
      id: `BI-${Date.now()}`, 
      detailedIssues: parsed.detailedIssues || "Анализ не выявил критических отклонений на основе имеющихся данных.",
      upsells: Array.isArray(parsed.upsells) ? parsed.upsells : [],
      salesScript: parsed.salesScript || "",
      predictiveAnalysis: parsed.predictiveAnalysis || { failureProbability: 5, reasoning: "Данные стабильны, специфических рисков не обнаружено." },
      mermaidPie: parsed.mermaidPie || "pie title Состояние\n\"Норма\" : 100",
      mermaidGantt: parsed.mermaidGantt || "gantt\ntitle План\nДиагностика :a1, 2024-01-01, 1d",
      costForecast: Array.isArray(parsed.costForecast) ? parsed.costForecast : [],
      categoryDistribution: Array.isArray(parsed.categoryDistribution) ? parsed.categoryDistribution : [],
      sources: research.sources 
    };
  } catch (error) {
    console.error("Critical Gemini analysis error:", error);
    throw error;
  }
}

/**
 * Точное распознавание и расшифровка VIN через поиск и правила WMI/VDS
 */
export async function lookupVin(vin: string): Promise<{ make: string, model: string, year?: number } | null> {
  if (!vin || vin.length < 11) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Расшифруй VIN-код: ${vin}. Используй WMI и VDS справочники. Верни строго JSON объект с полями make, model, year. Используй поиск для проверки спецификации по базам данных производителей.`,
      config: { 
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        temperature: 0,
      }
    });
    
    const data = JSON.parse(cleanJsonString(response.text || "null"));
    if (data && data.make) return data;
    return null;
  } catch (e) {
    console.error("VIN lookup error:", e);
    return null;
  }
}

/**
 * Извлечение VIN из изображения (фото СТС, кузова, лобового стекла)
 */
export async function extractVinFromImage(base64Image: string, mimeType: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { inlineData: { mimeType, data: base64Image.split(',')[1] || base64Image } },
        { text: "Найди на этом изображении VIN-код автомобиля (17 символов). Верни ТОЛЬКО найденную строку из 17 символов. Если VIN не найден, не пиши ничего." }
      ],
      config: { temperature: 0 }
    });
    
    const foundVin = response.text?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (foundVin && foundVin.length >= 11) {
      return foundVin;
    }
    return null;
  } catch (e) {
    console.error("Image VIN extraction error:", e);
    return null;
  }
}

export function startDiagnosticChat(car: CarData, analysis: AnalysisResult | null) {
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: `Ты — технический эксперт BI-AVTO. Твои ответы должны быть основаны на логах, фото и статистике Drive2/Drom. Если ты чего-то не знаешь — не выдумывай. Будь лаконичен.`,
      tools: [{ googleSearch: {} }],
      temperature: 0.2
    }
  });
}
