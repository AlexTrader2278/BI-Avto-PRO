export interface CarData {
  make: string;
  model: string;
  year?: number;
  mileage: number;
  complaint: string;
  vin: string;
  attachedFiles: Array<{
    name: string;
    type: string;
    data: string;
  }>;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ServiceItem {
  name: string;
  reason: string;
  critical?: boolean;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface CostForecastPoint {
  mileage: string;
  cost: number;
}

export interface AnalysisResult {
  id: string;
  detailedIssues: string;
  upsells: ServiceItem[];
  salesScript: string;
  predictiveAnalysis: {
    failureProbability: number;
    reasoning: string;
  } | null;
  sources: GroundingSource[];
  mermaidPie: string;
  mermaidGantt: string;
  costForecast: CostForecastPoint[];
  categoryDistribution: ChartDataPoint[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: GroundingSource[];
}

export interface InspectionHistory {
  id: string;
  date: string;
  model: string;
  status: string;
}