import { GoogleGenerativeAI } from "@google/generative-ai";
import { CarData, AnalysisResult, AttachedFile } from "./types";

const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
);

export async function analyzeCar(carData: CarData): Promise<AnalysisResult> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Ты - эксперт по автомобильной диагностике. Проанализируй следующий автомобиль:

Марка: ${carData.make}
Модель: ${carData.model}
Год: ${carData.year || "Не указан"}
Пробег: ${carData.mileage} км
VIN: ${carData.vin}
Жалоба клиента: ${carData.complaint}

Верни ТОЛЬКО валидный JSON без дополнительного текста в следующем формате:
{
  "detailedIssues": "Подробное описание проблем и возможных причин (2-3 параграфа)",
  "upsells": [
    {
      "name": "Название услуги",
      "reason": "Обоснование необходимости",
      "critical": true/false
    }
  ],
  "predictiveAnalysis": {
    "failureProbability": 65,
    "reasoning": "Объяснение прогноза"
  },
  "mermaidPie": "pie title Распределение работ\n    \"Диагностика\" : 20\n    \"Ремонт\" : 50\n    \"Профилактика\" : 30",
  "mermaidGantt": "gantt\n    title План работ\n    dateFormat  YYYY-MM-DD\n    section Диагностика\n    Компьютерная диагностика :2026-01-25, 1d\n    section Ремонт\n    Замена деталей :2026-01-26, 2d"
}

ВАЖНО: Верни ТОЛЬКО JSON, без markdown форматирования и комментариев.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Очистка ответа от markdown форматирования
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.slice(7);
    }
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    const analysisData = JSON.parse(cleanedResponse);

    return {
      id: Date.now().toString(),
      detailedIssues: analysisData.detailedIssues,
      upsells: analysisData.upsells || [],
      predictiveAnalysis: analysisData.predictiveAnalysis || null,
      sources: [],
      mermaidPie: analysisData.mermaidPie || "",
      mermaidGantt: analysisData.mermaidGantt || "",
    };
  } catch (error) {
    console.error("Error analyzing car:", error);
    throw new Error(
      `Ошибка анализа: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
    );
  }
}

export async function lookupVin(vin: string): Promise<any> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
VIN номер: ${vin}

Проанализируй этот VIN и верни информацию об автомобиле.
Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "make": "Марка",
  "model": "Модель",
  "year": 2020
}

ВАЖНО: Верни ТОЛЬКО JSON, без markdown форматирования.
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Очистка ответа
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.slice(7);
    }
    if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.slice(3);
    }
    if (cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();

    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error("Error looking up VIN:", error);
    throw new Error(
      `Ошибка поиска VIN: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
    );
  }
}

export async function chatWithAI(
  messages: { role: string; content: string }[],
  carContext?: CarData
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let contextPrompt = "";
    if (carContext) {
      contextPrompt = `\nКонтекст автомобиля:\nМарка: ${carContext.make}\nМодель: ${carContext.model}\nПробег: ${carContext.mileage} км\nПроблема: ${carContext.complaint}\n\n`;
    }

    const lastMessage = messages[messages.length - 1];
    const prompt = contextPrompt + lastMessage.content;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error in chat:", error);
    throw new Error(
      `Ошибка чата: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
    );
  }
}

export async function processFiles(files: AttachedFile[]) {
  return files.map((file) => {
    if (file.type.startsWith("image/")) {
      return {
        type: "image",
        data: file.data.split(",")[1], // Убираем data:image/...;base64,
      };
    }
    return {
      type: "text",
      data: file.data,
    };
  });
}