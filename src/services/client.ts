// src/services/client.ts - Frontend helper for API calls

interface CarData {
  make: string;
  model: string;
  year?: number;
  mileage: number;
  complaint: string;
  vin: string;
  attachedFiles: Array<{ name: string; type: string; data: string }>;
}

interface AnalysisResult {
  id: string;
  detailedIssues: string;
  upsells: Array<{ name: string; reason: string; critical?: boolean }>;
  salesScript: string;
  predictiveAnalysis: { failureProbability: number; reasoning: string } | null;
  sources: Array<{ title: string; uri: string }>;
  mermaidPie: string;
  mermaidGantt: string;
  costForecast: Array<{ mileage: string; cost: number }>;
  categoryDistribution: Array<{ label: string; value: number }>;
}

export async function analyzeCar(car: CarData): Promise<AnalysisResult> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'analyze',
        type: 'analyze',
        carData: car,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const parsed = data.data || JSON.parse(data.reply);
    return {
      ...parsed,
      id: `BI-${Date.now()}`,
      sources: parsed.sources || [],
    };
  } catch (error) {
    console.error('analyzeCar error:', error);
    throw error;
  }
}

export async function lookupVin(vin: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Определи марку, модель и год VIN: ${vin}`,
        type: 'lookup-vin',
        carData: { vin },
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data.data || JSON.parse(data.reply);
  } catch (error) {
    console.error('lookupVin error:', error);
    return null;
  }
}
