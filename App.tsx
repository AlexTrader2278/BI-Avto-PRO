
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Activity, TrendingUp, FileText, Zap, AlertTriangle, Loader2, Database,
  MessageSquare, Send, Bot, X, Menu, CheckCircle2, FileDown, UploadCloud,
  Share2, ClipboardCheck, Printer, Calendar, Gauge, Fingerprint, Car, FileCode, ExternalLink,
  Paperclip, Trash2, ChevronRight
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
    <div className="bg-white border border-slate-200 rounded-2xl md:rounded-[24px] p-2 md:p-4 flex items-center justify-center min-h-[200px] md:min-h-[250px] shadow-sm overflow-hidden">
      <div ref={ref} className="w-full flex justify-center scale-[0.85] md:scale-90" />
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
    mermaid.initialize({ 
      startOnLoad: false, 
      theme: 'neutral', 
      fontFamily: 'Inter',
      securityLevel: 'loose'
    });
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
    setAnalysis(null);
    try {
      const res = await analyzeCar(carData);
      setAnalysis(res);
      // Плавный скролл к результатам на мобильных
      if (window.innerWidth < 1024) {
        setTimeout(() => {
          document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка анализа. Проверьте подключение.");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden select-none">
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Адаптивная Шапка */}
        <header className="sticky top-0 h-16 md:h-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between z-50">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Zap className="text-white fill-white" size={18} />
            </div>
            <h1 className="font-black text-base md:text-xl tracking-tighter uppercase">BI-AVTO <span className="text-blue-600">PRO</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowChat(!showChat)} 
              className={`p-2.5 rounded-xl transition-all shadow-sm ${showChat ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'}`}
              aria-label="Открыть чат"
            >
              <MessageSquare size={18} className="md:w-5 md:h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 lg:p-12 scroll-smooth">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
            
            {/* Панель Ввода: Сверху на мобильных */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl md:rounded-[32px] shadow-sm md:shadow-xl space-y-5 md:space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">VIN-КОД</label>
                  <div className="flex gap-2">
                    <input 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm uppercase font-mono focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" 
                      value={carData.vin} 
                      onChange={e => setCarData({...carData, vin: e.target.value.toUpperCase()})} 
                      placeholder="WBA..." 
                    />
                    <button onClick={handleVinLookup} disabled={vinLoading} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-200">
                      {vinLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase px-1">Марка</label>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none" placeholder="BMW" value={carData.make} onChange={e => setCarData({...carData, make: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase px-1">Модель</label>
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none" placeholder="X5" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase px-1">Пробег (км)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 outline-none" placeholder="100000" value={carData.mileage || ''} onChange={e => setCarData({...carData, mileage: parseInt(e.target.value) || 0})} />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase px-1">Жалоба</label>
                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm h-24 resize-none focus:border-blue-500 outline-none" placeholder="Стук в подвеске, ТО..." value={carData.complaint} onChange={e => setCarData({...carData, complaint: e.target.value})} />
                </div>
                
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-slate-200 rounded-2xl md:rounded-[24px] cursor-pointer hover:bg-blue-50/50 hover:border-blue-200 transition-all active:scale-[0.98]">
                    <UploadCloud size={28} className="text-blue-600 mb-2" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Прикрепить документы</span>
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {carData.attachedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs animate-in slide-in-from-left-2">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip size={14} className="text-blue-500 shrink-0" />
                          <span className="truncate font-medium text-slate-600">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(i)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={runAnalysis} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 disabled:bg-slate-200 disabled:shadow-none transition-all flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                  {loading ? 'Анализ...' : 'Запустить ИИ-Анализ'}
                </button>
              </div>
            </div>

            {/* Панель Результатов */}
            <div id="results-section" className="lg:col-span-8 space-y-6 md:space-y-10">
              {loading ? (
                <div className="space-y-6 animate-pulse">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-48 md:h-64 bg-slate-200 rounded-2xl md:rounded-[32px]"></div>
                    <div className="h-48 md:h-64 bg-slate-200 rounded-2xl md:rounded-[32px]"></div>
                  </div>
                  <div className="h-40 bg-slate-200 rounded-2xl md:rounded-[32px]"></div>
                  <div className="h-64 bg-slate-200 rounded-2xl md:rounded-[32px]"></div>
                </div>
              ) : !analysis ? (
                <div className="h-[300px] md:h-[500px] border-2 border-dashed border-slate-200 rounded-2xl md:rounded-[40px] flex flex-col items-center justify-center bg-white/50">
                  <div className="p-4 bg-slate-100 rounded-full mb-4">
                    <Database size={32} className="text-slate-400" />
                  </div>
                  <p className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-widest text-center px-4">Заполните данные слева для получения отчета</p>
                </div>
              ) : (
                <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
                  
                  {/* Графики */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="group">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Распределение систем</p>
                      <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                    </div>
                    <div className="group">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Таймлайн работ</p>
                      <MermaidViewer chart={analysis.mermaidGantt} id="gantt" />
                    </div>
                  </div>

                  {/* Вероятность поломки */}
                  <div className={`p-6 md:p-8 rounded-2xl md:rounded-[32px] border shadow-sm transition-all ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-50/50 border-red-100' : 'bg-orange-50/50 border-orange-100'}`}>
                    <div className="flex justify-between items-start md:items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                          <Activity size={20} />
                        </div>
                        <h2 className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500">Предиктивный риск</h2>
                      </div>
                      <span className={`text-3xl md:text-4xl font-black tracking-tighter ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'text-red-600' : 'text-orange-600'}`}>
                        {analysis.predictiveAnalysis?.failureProbability}%
                      </span>
                    </div>
                    <div className="bg-white/80 backdrop-blur p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/50 text-[13px] md:text-sm font-medium text-slate-700 leading-relaxed shadow-sm">
                      {analysis.predictiveAnalysis?.reasoning}
                    </div>
                  </div>

                  {/* Технический вердикт */}
                  <div className="bg-white border border-slate-200 p-6 md:p-10 rounded-2xl md:rounded-[40px] shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <FileText className="text-blue-600" size={20} />
                      </div>
                      <h2 className="text-base md:text-lg font-black uppercase tracking-tight">Технический вердикт</h2>
                    </div>
                    <div className="text-slate-600 text-[13px] md:text-sm leading-relaxed whitespace-pre-line text-justify space-y-4">
                      {analysis.detailedIssues}
                    </div>
                    
                    {analysis.sources.length > 0 && (
                      <div className="mt-8 pt-8 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Источники знаний:</p>
                        <div className="flex flex-wrap gap-2">
                          {analysis.sources.map((s, i) => (
                            <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all flex items-center gap-1.5 font-bold">
                              {s.title} <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* План обслуживания */}
                  <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl md:rounded-[32px] shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-emerald-50 rounded-lg">
                        <TrendingUp className="text-emerald-600" size={20} />
                      </div>
                      <h2 className="text-sm md:text-md font-black uppercase tracking-widest">План обслуживания</h2>
                    </div>
                    <div className="space-y-3">
                      {analysis.upsells.map((u, i) => (
                        <div key={i} className={`group p-4 md:p-5 rounded-xl md:rounded-2xl border transition-all hover:shadow-md ${u.critical ? 'bg-red-50/30 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm text-slate-800 pr-2">{u.name}</span>
                            {u.critical && (
                              <span className="shrink-0 text-[8px] md:text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded shadow-sm shadow-red-200 uppercase">Критично</span>
                            )}
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

        {/* Адаптивный Чат (Full-screen на мобильных) */}
        {showChat && (
          <div className="fixed inset-0 md:inset-y-0 md:right-0 md:left-auto w-full md:w-[450px] lg:w-[500px] bg-white border-l border-slate-200 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="px-6 py-4 md:p-8 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <Bot size={20} />
                </div>
                <div>
                  <span className="block font-black uppercase text-[10px] md:text-xs tracking-widest leading-none mb-1">Ассистент</span>
                  <span className="block text-[8px] text-emerald-500 font-bold uppercase tracking-widest leading-none">Online</span>
                </div>
              </div>
              <button onClick={() => setShowChat(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-slate-100 md:bg-transparent rounded-full md:rounded-none">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 bg-slate-50/50 scroll-smooth">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4">
                    <Bot size={32} className="text-blue-500" />
                  </div>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Задайте вопрос по диагностике</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[90%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                    {m.text}
                  </div>
                  <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    {m.role === 'user' ? 'Вы' : 'AI Мастер'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 md:p-6 border-t border-slate-100 bg-white">
              <div className="flex gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-2xl focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                <input 
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" 
                  placeholder="Напишите сообщение..." 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && chatInput.trim()) {
                      setChatMessages(prev => [...prev, {role:'user', text: chatInput}]);
                      setChatInput('');
                      // Эмуляция ответа (здесь можно добавить реальный вызов API чата)
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
                  className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="mt-3 flex justify-center">
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">AI can make mistakes</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
