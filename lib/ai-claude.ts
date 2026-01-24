import Anthropic from "@anthropic-ai/sdk";
import { CarData, AnalysisResult, AttachedFile } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "",
});

export async function analyzeCar(carData: CarData): Promise<AnalysisResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `
Ты - эксперт по автомобильной диагностике. Проанализируй следующий автомобиль:

Марка: ${carData.make}
Модель: ${carData.model}
Год: ${carData.year || "Не указан"}
Пробег: ${carData.mileage} км
VIN: ${carData.vin}
Жалоба клиента: ${carData.complaint}

Верни ТОЛЬКО валидный JSON в следующем формате:
{
  "detailedIssues": "Подробное описание проблем",
  "upsells": [{"name": "Услуга", "reason": "Обоснование", "critical": true}],
  "predictiveAnalysis": {"failureProbability": 65, "reasoning": "Объяснение"},
  "mermaidPie": "pie title Распределение работ...",
  "mermaidGantt": "gantt\n    title План работ..."
}
`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const analysisData = JSON.parse(content.text);

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
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `VIN: ${vin}. Верни JSON: {"make": "Марка", "model": "Модель", "year": 2020}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return JSON.parse(content.text);
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
    let contextPrompt = "";
    if (carContext) {
      contextPrompt = `Контекст: ${carContext.make} ${carContext.model}, ${carContext.mileage} км, проблема: ${carContext.complaint}\n\n`;
    }

    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    if (anthropicMessages[0].role === "user") {
      anthropicMessages[0].content = contextPrompt + anthropicMessages[0].content;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: anthropicMessages,
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return content.text;
  } catch (error) {
    console.error("Error in chat:", error);
    throw new Error(
      `Ошибка чата: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`
    );
  }
}