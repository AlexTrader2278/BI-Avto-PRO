
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Activity, TrendingUp, FileText, Zap, AlertTriangle, Loader2, Database,
  MessageSquare, Send, Bot, X, Menu, CheckCircle2, FileDown, UploadCloud,
  Share2, ClipboardCheck, Printer, Calendar, Gauge, Fingerprint, Car, FileCode, ExternalLink,
  Paperclip, Trash2
} from 'lucide-react';
import { GoogleGenAI, Type, Chat } from "@google/genai";
import mermaid from 'mermaid';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Brush
} from 'recharts';

// --- ИНИЦИАЛИЗАЦИЯ ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  salesScript: string;
  predictiveAnalysis: { failureProbability: number; reasoning: string; } | null;
  sources: GroundingSource[];
  mermaidPie: string;
  mermaidGantt: string;
  costForecast: Array<{ mileage: string; cost: number }>;
  categoryDistribution: Array<{ label: string; value: number }>;
}

export interface ChatMessage { role: 'user' | 'model'; text: string; sources?: GroundingSource[]; }

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
const cleanJsonString = (str: string): string => str.replace(/```json/g, '').replace(/```/g, '').trim();

const extractSources = (response: any): GroundingSource[] => {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
};

// --- СЕРВИСНАЯ ЛОГИКА ---
async function performWebResearch(car: CarData): Promise<{ context: string, sources: GroundingSource[] }> {
  const carString = `${car.make} ${car.model} ${car.year || ''}`;
  const query = `Статистика неисправностей ${carString}, пробег ${car.mileage}км. Известные "болячки" и отзывы владельцев на Drive2 и Drom.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
    });
    return { context: response.text || "", sources: extractSources(response) };
  } catch (e) {
    return { context: "Внешний поиск недоступен.", sources: [] };
  }
}

export async function analyzeCar(car: CarData): Promise<AnalysisResult> {
  const research = await performWebResearch(car);
  const parts: any[] = [];
  
  // Добавляем текстовое описание прикрепленных файлов для контекста
  let filesContext = "КОНТЕКСТ ИЗ ПРИКРЕПЛЕННЫХ ДОКУМЕНТОВ (ТО, логи, акты):\n";
  car.attachedFiles.forEach(file => {
    if (file.type.startsWith('image/')) {
      const base64Data = file.data.split(',')[1] || file.data;
      parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
    } else {
      filesContext += `Файл [${file.name}]: ${file.data.substring(0, 1000)}...\n`;
    }
  });

  const systemInstruction = `
    Ты — ведущий технический аналитик BI-AVTO PRO. 
    ТВОЯ ПЕРВООЧЕРЕДНАЯ ЗАДАЧА: Анализировать прикрепленные пользователем файлы (акты выполненных работ, истории ТО, диагностические логи).
    Если в файлах указано, что деталь менялась недавно — не предлагай её замену. 
    Если в файлах виден износ или рекомендации мастеров — выноси это в ПРИОРИТЕТ.
    ВТОРОСТЕПЕННАЯ ЗАДАЧА: Дополнить анализ статистическими данными (Drive2/Drom) по "болячкам" модели на данном пробеге.
    Верни строго JSON.
  `;

  const prompt = `
    АВТОМОБИЛЬ: ${car.make} ${car.model}, пробег ${car.mileage} км.
    ЖАЛОБА: "${car.complaint}"
    ${filesContext}
    СТАТИСТИКА ИЗ СЕТИ: ${research.context}

    Сформируй отчет:
    1. detailedIssues - глубокий разбор на основе ФАЙЛОВ + статистики.
    2. upsells - список работ (name, reason, critical).
    3. predictiveAnalysis - вероятность поломки (0-100) и почему.
    4. mermaidPie, mermaidGantt, costForecast, categoryDistribution для графиков.
  `;
  
  parts.unshift({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: { systemInstruction, responseMimeType: "application/json", temperature: 0.1 }
  });

  const parsed = JSON.parse(cleanJsonString(response.text || "{}"));
  return { ...parsed, id: `BI-${Date.now()}`, sources: research.sources };
}

export async function lookupVin(vin: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Декодируй VIN: ${vin}. Верни JSON: make, model, year.`,
    config: { responseMimeType: "application/json", temperature: 0 }
  });
  return JSON.parse(cleanJsonString(response.text || "null"));
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
      } catch (e) { console.error("Mermaid error:", e); }
    }
  }, [chart, id]);
  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-4 flex items-center justify-center min-h-[250px] shadow-sm overflow-hidden">
      <div ref={ref} className="w-full flex justify-center scale-90" />
    </div>
  );
};

// --- ГЛАВНОЕ ПРИЛОЖЕНИЕ ---
const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [carData, setCarData] = useState<CarData>({
    make: '', model: '', mileage: 0, complaint: '', vin: '', attachedFiles: []
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'Inter' });
  }, []);

  const handleVinLookup = async () => {
    if (carData.vin.length < 5) return;
    setVinLoading(true);
    try {
      const res = await lookupVin(carData.vin);
      if (res) setCarData(p => ({ ...p, make: res.make || p.make, model: res.model || p.model, year: res.year || p.year }));
    } finally { setVinLoading(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setCarData(p => ({ ...p, attachedFiles: [...p.attachedFiles, { name: file.name, type: file.type, data: base64 }] }));
      };
      if (file.type.startsWith('image/')) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
  };

  const removeFile = (index: number) => {
    setCarData(p => ({ ...p, attachedFiles: p.attachedFiles.filter((_, i) => i !== index) }));
  };

  const runAnalysis = async () => {
    if (!carData.make || !carData.model) return alert("Укажите марку и модель");
    setLoading(true);
    try {
      const res = await analyzeCar(carData);
      setAnalysis(res);
    } catch (err) {
      console.error(err);
      alert("Ошибка анализа. Проверьте ключ API.");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl px-8 flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <Zap className="text-blue-600 fill-blue-600" size={24} />
            <h1 className="font-black text-xl tracking-tighter uppercase">BI-AVTO <span className="text-blue-600">PRO</span></h1>
          </div>
          <button onClick={() => setShowChat(!showChat)} className={`p-2 rounded-xl transition-all ${showChat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-900'}`}>
            <MessageSquare size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Левая панель: Ввод данных */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-xl space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VIN-КОД</label>
                  <div className="flex gap-2">
                    <input className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm uppercase font-mono focus:ring-2 focus:ring-blue-500/20 outline-none" value={carData.vin} onChange={e => setCarData({...carData, vin: e.target.value.toUpperCase()})} placeholder="WBA..." />
                    <button onClick={handleVinLookup} disabled={vinLoading} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                      {vinLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Марка</label>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="BMW" value={carData.make} onChange={e => setCarData({...carData, make: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Модель</label>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="X5" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Пробег</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm" placeholder="100000" value={carData.mileage || ''} onChange={e => setCarData({...carData, mileage: parseInt(e.target.value) || 0})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Жалоба</label>
                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm h-24 resize-none" placeholder="Стук в подвеске, ТО..." value={carData.complaint} onChange={e => setCarData({...carData, complaint: e.target.value})} />
                </div>
                
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-slate-200 rounded-[24px] cursor-pointer hover:bg-blue-50/50 transition-all">
                    <UploadCloud size={24} className="text-blue-600 mb-2" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Прикрепить ТО / Акты / Логи</span>
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                  
                  <div className="space-y-2">
                    {carData.attachedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip size={12} className="text-slate-400" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={runAnalysis} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:bg-slate-200 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                  {loading ? 'Анализ данных...' : 'Запустить диагностику'}
                </button>
              </div>
            </div>

            {/* Правая панель: Результаты */}
            <div className="lg:col-span-8">
              {loading ? (
                <div className="space-y-6 animate-pulse">
                  <div className="h-64 bg-slate-100 rounded-[32px]"></div>
                  <div className="h-32 bg-slate-100 rounded-[32px]"></div>
                  <div className="h-64 bg-slate-100 rounded-[32px]"></div>
                </div>
              ) : !analysis ? (
                <div className="h-[500px] border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center bg-white">
                  <Database size={48} className="text-slate-200 mb-4" />
                  <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Ожидание данных для анализа</p>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                    <MermaidViewer chart={analysis.mermaidGantt} id="gantt" />
                  </div>

                  <div className={`p-8 rounded-[32px] border ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <Activity className={analysis.predictiveAnalysis?.failureProbability! > 60 ? 'text-red-600' : 'text-orange-600'} />
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Вероятность поломки</h2>
                      </div>
                      <span className={`text-4xl font-black ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'text-red-600' : 'text-orange-600'}`}>{analysis.predictiveAnalysis?.failureProbability}%</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed bg-white/50 p-4 rounded-2xl">{analysis.predictiveAnalysis?.reasoning}</p>
                  </div>

                  <div className="bg-white border border-slate-200 p-10 rounded-[40px] shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <FileText className="text-blue-600" size={24} />
                      <h2 className="text-lg font-black uppercase tracking-tight">Технический вердикт (AI)</h2>
                    </div>
                    <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line text-justify">{analysis.detailedIssues}</div>
                    
                    {analysis.sources.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Найдено в базах знаний:</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.sources.map((s, i) => (
                            <a key={i} href={s.uri} target="_blank" className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1">
                              {s.title} <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <TrendingUp className="text-emerald-600" size={20} />
                      <h2 className="text-md font-black uppercase tracking-widest">План обслуживания</h2>
                    </div>
                    <div className="space-y-4">
                      {analysis.upsells.map((u, i) => (
                        <div key={i} className={`p-5 rounded-2xl border ${u.critical ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm text-slate-800">{u.name}</span>
                            {u.critical && <span className="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded">КРИТИЧНО</span>}
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{u.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Chat */}
        {showChat && (
          <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white border-l border-slate-200 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3"><Bot className="text-blue-600" /><span className="font-black uppercase text-xs tracking-widest">Технический Ассистент</span></div>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-slate-50">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-xs ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>{m.text}</div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-2">
              <input className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-600" placeholder="Задать вопрос по отчету..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => {
                if (e.key === 'Enter') {
                  setChatMessages([...chatMessages, {role:'user', text: chatInput}]);
                  setChatInput('');
                }
              }} />
              <button className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20"><Send size={18} /></button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
