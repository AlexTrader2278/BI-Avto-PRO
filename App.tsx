import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Activity, TrendingUp, FileText, Zap, AlertTriangle, Loader2, Database,
  MessageSquare, Send, Bot, X, Menu, CheckCircle2, FileDown, UploadCloud,
  Share2, ClipboardCheck, Printer, Calendar, Gauge, Fingerprint, Car, FileCode, ExternalLink,
  Paperclip, Trash2, ChevronRight, Info
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import mermaid from 'mermaid';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts';

// --- ИНИЦИАЛИЗАЦИЯ ---
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY || "");

// --- ТИПЫ ДАННЫХ ---
export interface AttachedFile {
  name: string;
  type: string;
  data: string;
}

export interface CarData {
  make: string;
  model: string;
  year?: number;
  mileage: number;
  complaint: string;
  vin: string;
  attachedFiles: AttachedFile[];
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

export interface AnalysisResult {
  id: string;
  detailedIssues: string;
  upsells: ServiceItem[];
  predictiveAnalysis: { failureProbability: number; reasoning: string; } | null;
  sources: GroundingSource[];
  mermaidPie: string;
  mermaidGantt: string;
}

export interface ChatMessage { role: 'user' | 'model'; text: string; }

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const cleanJsonString = (str: string): string => {
  let cleaned = str.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
};

// --- СЕРВИСНАЯ ЛОГИКА ---
export async function analyzeCar(car: CarData): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const prompt = `
    Ты — эксперт по диагностике автомобилей. Проанализируй данные:
    Авто: ${car.make} ${car.model}, Пробег: ${car.mileage} км.
    Жалоба: "${car.complaint}"
    
    Верни ТОЛЬКО валидный JSON в формате:
    {
      "detailedIssues": "описание",
      "upsells": [{"name": "услуга", "reason": "зачем", "critical": true}],
      "predictiveAnalysis": {"failureProbability": 70, "reasoning": "почему"},
      "mermaidPie": "pie title Структура\
\\"Проблема\\": 100",
      "mermaidGantt": "gantt\
title План\
section Ремонт\
Дело :2026-01-25, 1d"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(cleanJsonString(text));
    return {
      ...parsed,
      id: `BI-${Date.now()}`,
      sources: []
    };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function lookupVin(vin: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `VIN: ${vin}. Верни JSON: {"make": "Марка", "model": "Модель", "year": 2020}`;
  const result = await model.generateContent(prompt);
  return JSON.parse(cleanJsonString(result.response.text()));
}

// --- UI КОМПОНЕНТЫ ---
const MermaidViewer: React.FC<{ chart: string; id: string }> = ({ chart, id }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current && chart) {
      ref.current.removeAttribute('data-processed');
      try {
        mermaid.render(`mermaid-${id}-${Date.now()}`, chart).then((res) => {
          if (ref.current) ref.current.innerHTML = res.svg;
        });
      } catch (e) { console.error(e); }
    }
  }, [chart, id]);
  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-4 flex items-center justify-center min-h-[200px] overflow-hidden shadow-inner">
      <div ref={ref} className="w-full" />
    </div>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [carData, setCarData] = useState<CarData>({
    make: '', model: '', mileage: 0, complaint: '', vin: '', attachedFiles: []
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
  }, []);

  const handleVinLookup = async () => {
    if (carData.vin.length < 5) return;
    setVinLoading(true);
    try {
      const res = await lookupVin(carData.vin);
      if (res) setCarData(p => ({ ...p, make: res.make, model: res.model, year: res.year }));
    } catch (e) { console.error(e); }
    finally { setVinLoading(false); }
  };

  const runAnalysis = async () => {
    if (!carData.make || !carData.model) return alert("Введите данные авто");
    setLoading(true);
    try {
      const res = await analyzeCar(carData);
      setAnalysis(res);
    } catch (e) { alert("Ошибка анализа"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center gap-4 bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
          <Zap className="text-blue-400" size={32} />
          <h1 className="text-2xl font-black uppercase tracking-tighter">BI-AVTO <span className="text-blue-400">PRO</span></h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">VIN Номер</label>
              <div className="flex gap-2">
                <input 
                  className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-mono focus:border-blue-600 outline-none transition-all"
                  value={carData.vin}
                  onChange={e => setCarData({...carData, vin: e.target.value.toUpperCase()})}
                  placeholder="WBA..."
                />
                <button onClick={handleVinLookup} disabled={vinLoading} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50">
                  {vinLoading ? <Loader2 className="animate-spin" /> : <Search />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Марка" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 outline-none" value={carData.make} onChange={e => setCarData({...carData, make: e.target.value})} />
              <input placeholder="Модель" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 outline-none" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} />
            </div>

            <input type="number" placeholder="Пробег" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-blue-600 outline-none" value={carData.mileage || ''} onChange={e => setCarData({...carData, mileage: parseInt(e.target.value) || 0})} />
            
            <textarea placeholder="Жалоба клиента" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 h-32 resize-none focus:border-blue-600 outline-none" value={carData.complaint} onChange={e => setCarData({...carData, complaint: e.target.value})} />

            <button onClick={runAnalysis} disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3">
              {loading ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
              {loading ? 'Анализ...' : 'Сформировать отчет'}
            </button>
          </section>

          <section className="lg:col-span-8 space-y-8">
            {analysis ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                  <MermaidViewer chart={analysis.mermaidGantt} id="gantt" />
                </div>

                <div className={`p-8 rounded-[2.5rem] border-2 shadow-xl ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-50 border-red-200' : 'bg-blue-900 border-blue-800 text-white'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-black uppercase tracking-widest opacity-80">Вероятность отказа</h2>
                    <span className="text-5xl font-black">{analysis.predictiveAnalysis?.failureProbability}%</span>
                  </div>
                  <p className="text-lg font-medium leading-relaxed opacity-90">{analysis.predictiveAnalysis?.reasoning}</p>
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
                  <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3">
                    <FileText className="text-blue-600" /> Технический вердикт
                  </h2>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-line font-medium">{analysis.detailedIssues}</div>
                </div>

                <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl">
                  <h2 className="text-lg font-black uppercase mb-8 flex items-center gap-3">
                    <TrendingUp className="text-emerald-400" /> План работ
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.upsells.map((u, i) => (
                      <div key={i} className={`p-6 rounded-2xl border ${u.critical ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="font-black uppercase mb-2 text-sm">{u.name}</div>
                        <p className="text-xs text-slate-400">{u.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 bg-white/50">
                <Info size={48} className="mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest">Готов к анализу</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
