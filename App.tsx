
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Activity, TrendingUp, FileText, Zap, AlertTriangle, Loader2, Database,
  MessageSquare, Send, Bot, X, Menu, CheckCircle2, FileDown, UploadCloud,
  Share2, ClipboardCheck, Printer, Calendar, Gauge, Fingerprint, Car, FileCode, ExternalLink,
  Paperclip, Trash2, ChevronRight, Info
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
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

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
  const query = `Статистика неисправностей ${carString}, пробег ${car.mileage}км. Известные тех. проблемы и рекомендации на Drive2 и Drom.`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: { tools: [{ googleSearch: {} }], temperature: 0.1 }
    });
    return { context: response.text || "", sources: extractSources(response) };
  } catch (e) {
    return { context: "Внешний поиск ограничен.", sources: [] };
  }
}

export async function analyzeCar(car: CarData): Promise<AnalysisResult> {
  const research = await performWebResearch(car);
  const parts: any[] = [];
  
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
    Ты — эксперт BI-AVTO PRO. 
    1. Анализируй сначала ФАЙЛЫ (акты работ, историю ТО). 
    2. Дополняй статистикой по модели из сети.
    3. Выдавай четкий технический вердикт и план работ.
    Формат ответа: JSON.
  `;

  const prompt = `
    АВТОМОБИЛЬ: ${car.make} ${car.model}, пробег ${car.mileage} км.
    ЖАЛОБА: "${car.complaint}"
    ${filesContext}
    СЕТЕВОЙ КОНТЕКСТ: ${research.context}
    JSON: detailedIssues, upsells[{name, reason, critical}], predictiveAnalysis{failureProbability, reasoning}, mermaidPie, mermaidGantt, costForecast, categoryDistribution.
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
    contents: `VIN: ${vin}. Верни JSON: make, model, year.`,
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
      } catch (e) { console.error(e); }
    }
  }, [chart, id]);
  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-2 md:p-4 flex items-center justify-center min-h-[200px] shadow-inner overflow-hidden">
      <div ref={ref} className="w-full flex justify-center scale-90 md:scale-95 transition-transform" />
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
    if (!carData.make || !carData.model) return alert("Введите данные авто");
    setLoading(true);
    try {
      const res = await analyzeCar(carData);
      setAnalysis(res);
      if (window.innerWidth < 1024) document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#f0f5fa] text-slate-900 font-sans overflow-hidden">
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header - Контрастный */}
        <header className="sticky top-0 h-16 md:h-20 border-b border-slate-300 bg-[#1e293b] text-white px-4 md:px-8 flex items-center justify-between z-50 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
              <Zap className="text-white fill-white" size={18} />
            </div>
            <h1 className="font-black text-lg md:text-xl tracking-tighter uppercase">BI-AVTO <span className="text-blue-400">PRO</span></h1>
          </div>
          <button 
            onClick={() => setShowChat(!showChat)} 
            className={`p-2.5 rounded-xl transition-all ${showChat ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
          >
            <MessageSquare size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:p-10 scroll-smooth">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Input Section - Синие акценты */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-300 p-6 md:p-8 rounded-[2rem] shadow-xl space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-1">Идентификация VIN</label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm uppercase font-mono focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all" 
                      value={carData.vin} 
                      onChange={e => setCarData({...carData, vin: e.target.value.toUpperCase()})} 
                      placeholder="WBA..." 
                    />
                    <button onClick={handleVinLookup} disabled={vinLoading} className="p-3 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition-all shadow-lg shadow-blue-200">
                      {vinLoading ? <Loader2 className="animate-spin" /> : <Search />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Марка</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-600 outline-none transition-all" placeholder="BMW" value={carData.make} onChange={e => setCarData({...carData, make: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Модель</label>
                    <input className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-600 outline-none transition-all" placeholder="X5" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Пробег</label>
                  <input type="number" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-blue-600 outline-none transition-all" placeholder="км" value={carData.mileage || ''} onChange={e => setCarData({...carData, mileage: parseInt(e.target.value) || 0})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Жалоба клиента</label>
                  <textarea className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm h-28 resize-none focus:border-blue-600 outline-none transition-all" placeholder="Опишите проблему..." value={carData.complaint} onChange={e => setCarData({...carData, complaint: e.target.value})} />
                </div>
                
                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-blue-200 rounded-2xl cursor-pointer bg-blue-50/30 hover:bg-blue-50 hover:border-blue-400 transition-all">
                    <UploadCloud size={32} className="text-blue-600 mb-2" />
                    <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Прикрепить документы</span>
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {carData.attachedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl text-[13px] animate-in fade-in">
                        <div className="flex items-center gap-2 truncate text-blue-900 font-medium">
                          <Paperclip size={16} />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="text-red-500 p-1 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={runAnalysis} disabled={loading} className="btn-glow w-full py-5 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.15em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" /> : <Zap size={20} />}
                  {loading ? 'Анализируем...' : 'Сформировать отчет'}
                </button>
              </div>
            </div>

            {/* Results Section - Контрастный */}
            <div id="results" className="lg:col-span-8 space-y-8">
              {!analysis && !loading ? (
                <div className="h-full min-h-[400px] border-2 border-dashed border-slate-300 rounded-[3rem] flex flex-col items-center justify-center bg-white/50 p-10 text-center">
                  <div className="p-6 bg-slate-200 rounded-full mb-6">
                    <Info size={40} className="text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Готов к работе</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs">Введите данные автомобиля и прикрепите документы для запуска глубокой AI-диагностики</p>
                </div>
              ) : loading ? (
                <div className="space-y-8 animate-pulse">
                  <div className="h-64 bg-slate-200 rounded-[2.5rem]"></div>
                  <div className="h-40 bg-slate-200 rounded-[2.5rem]"></div>
                  <div className="h-96 bg-slate-200 rounded-[2.5rem]"></div>
                </div>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
                  
                  {/* Visualizations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Структура повреждений</p>
                      <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Таймлайн сервиса</p>
                      <MermaidViewer chart={analysis.mermaidGantt} id="gantt" />
                    </div>
                  </div>

                  {/* Probability Card - Темный Акцент */}
                  <div className={`p-8 rounded-[2.5rem] border-2 shadow-2xl transition-all ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-50 border-red-200 text-red-950' : 'bg-blue-900 border-blue-800 text-white'}`}>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-200 text-red-700' : 'bg-blue-800 text-blue-300'}`}>
                          <Activity size={24} />
                        </div>
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] opacity-80">Вероятность отказа</h2>
                      </div>
                      <span className="text-5xl font-black tracking-tighter">{analysis.predictiveAnalysis?.failureProbability}%</span>
                    </div>
                    <p className={`p-6 rounded-2xl text-[15px] font-medium leading-relaxed ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-white/50' : 'bg-blue-800/50 border border-blue-700'}`}>
                      {analysis.predictiveAnalysis?.reasoning}
                    </p>
                  </div>

                  {/* Verdict - Белая карточка с четким текстом */}
                  <div className="bg-white border border-slate-300 p-8 md:p-12 rounded-[3rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-900"><FileCode size={80} /></div>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-blue-100 rounded-2xl text-blue-700"><FileText size={24} /></div>
                      <h2 className="text-xl font-black uppercase tracking-tight">Технический вердикт</h2>
                    </div>
                    <div className="text-slate-800 text-[15px] leading-[1.8] whitespace-pre-line text-justify font-medium">
                      {analysis.detailedIssues}
                    </div>
                    
                    {analysis.sources.length > 0 && (
                      <div className="mt-10 pt-10 border-t border-slate-200">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">База знаний:</p>
                        <div className="flex flex-wrap gap-3">
                          {analysis.sources.map((s, i) => (
                            <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-slate-100 text-slate-700 px-4 py-2 rounded-xl border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center gap-2 font-bold shadow-sm">
                              {s.title} <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Plan - Контрастная сетка */}
                  <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[3rem] shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl"><TrendingUp size={24} /></div>
                      <h2 className="text-lg font-black uppercase tracking-widest">План работ</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysis.upsells.map((u, i) => (
                        <div key={i} className={`p-6 rounded-2xl border-2 transition-all ${u.critical ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800 border-slate-700 hover:border-blue-500'}`}>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-black text-[14px] text-white pr-2 leading-tight uppercase tracking-wide">{u.name}</span>
                            {u.critical && <span className="shrink-0 text-[10px] font-black bg-red-600 text-white px-3 py-1 rounded-full uppercase">S.O.S</span>}
                          </div>
                          <p className="text-[12px] text-slate-400 leading-relaxed font-medium">{u.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat - Полноэкранный темный для мобильных */}
        {showChat && (
          <div className="fixed inset-0 md:inset-y-0 md:right-0 md:left-auto w-full md:w-[450px] bg-white border-l border-slate-300 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-600 rounded-xl"><Bot size={22} /></div>
                <div>
                  <h3 className="font-black uppercase text-xs tracking-widest">AI Мастер</h3>
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">Активен</span>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50 custom-scrollbar">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[14px] leading-relaxed shadow-md ${m.role === 'user' ? 'bg-blue-700 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none font-medium'}`}>
                    {m.text}
                  </div>
                  <span className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                    {m.role === 'user' ? 'Вы' : 'Сервис-консультант'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-slate-200 bg-white mobile-safe-area">
              <div className="flex gap-2 p-2 bg-slate-100 border-2 border-slate-200 rounded-2xl focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
                <input 
                  className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none font-medium" 
                  placeholder="Задайте вопрос..." 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      setChatMessages(prev => [...prev, {role:'user', text: chatInput}]);
                      setChatInput('');
                    }
                  }} 
                />
                <button 
                  onClick={() => {
                    if (chatInput.trim()) {
                      setChatMessages(prev => [...prev, {role:'user', text: chatInput}]);
                      setChatInput('');
                    }
                  }}
                  className="p-3.5 bg-blue-700 text-white rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
