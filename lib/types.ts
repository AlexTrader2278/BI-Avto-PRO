export interface CarData {
  make: string;
  model: string;
  year?: number;
  mileage: number;
  complaint: string;
  vin: string;
  attachedFiles: AttachedFile[];
}

export interface AttachedFile {
  name: string;
  type: string;
  data: string;
}

export interface AnalysisResult {
  id: string;
  detailedIssues: string;
  upsells: ServiceItem[];
  predictiveAnalysis: {
    failureProbability: number;
    reasoning: string;
  } | null;
  sources: GroundingSource[];
  mermaidPie: string;
  mermaidGantt: string;
}

export interface ServiceItem {
  name: string;
  reason: string;
  critical?: boolean;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}