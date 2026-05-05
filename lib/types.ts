export interface CarInput {
  make: string;
  model: string;
  year: number;
  mileage: number;
  vin?: string;
}

export interface ProblemForecast {
  name: string;
  probability: number;
  mileageRange: string;
  cause: string;
  solution: string;
  severity: 'critical' | 'medium' | 'low';
}

export interface AnalysisResult {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  problems: ProblemForecast[];
  recommendations: string[];
  sources: string[];
  mermaidPie: string;
  analysisCount?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
