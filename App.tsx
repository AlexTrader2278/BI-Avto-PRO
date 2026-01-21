
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Activity, TrendingUp, FileText, Zap, AlertTriangle, Loader2, Database,
  MessageSquare, Send, Bot, X, Menu, CheckCircle2, FileDown, Download, UploadCloud,
  Share2, ClipboardCheck, Printer, Calendar, Gauge, Fingerprint, Car, FileCode, ExternalLink,
  Camera
} from 'lucide-react';
import { CarData, AnalysisResult, ChatMessage, InspectionHistory } from './types';
import { analyzeCar, startDiagnosticChat, lookupVin, extractSources, extractVinFromImage } from './services/gemini';
import SkeletonLoader from './components/SkeletonLoader';
import PredictiveAnalysisModule from './components/PredictiveAnalysisModule';
import InteractiveDashboard from './components/InteractiveDashboard';
import mermaid from 'mermaid';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

try {
  if (typeof mermaid !== 'undefined' && mermaid.initialize) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'light',
      securityLevel: 'loose',
      fontFamily: 'Inter',
    });
  }
} catch (e) {
  console.error("Mermaid init failed:", e);
}

const STORAGE_KEYS = {
  HISTORY: 'BI_AVTO_HISTORY_V5',
  ANALYSIS_PREFIX: 'BI_AVTO_DATA_',
};

const MermaidViewer: React.FC<{ chart: string; id: string }> = ({ chart, id }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && chart && chart.trim().length > 0) {
      ref.current.removeAttribute('data-processed');
      try {
        if (typeof mermaid !== 'undefined' && mermaid.render) {
          mermaid.render(`mermaid-${id}-${Date.now()}`, chart).then((res) => {
            if (ref.current) ref.current.innerHTML = res.svg;
          }).catch(err => {
            console.error("Mermaid render error:", err);
            if (ref.current) ref.current.innerHTML = `<p class="text-[10px] text-slate-700">Ошибка отрисовки графика</p>`;
          });
        } else {
          if (ref.current) ref.current.innerHTML = `<p class="text-[10px] text-slate-700 italic">Визуализация недоступна</p>`;
        }
      } catch (e) {
        console.error("Mermaid block failed:", e);
      }
    }
  }, [chart, id]);

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-4 flex items-center justify-center min-h-[250px] w-full overflow-hidden report-card">
      <div ref={ref} className="w-full flex justify-center scale-90" />
    </div>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInstance = useRef<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [carData, setCarData] = useState<CarData>({
    make: '', model: '', year: undefined, mileage: 0, complaint: '', vin: '', attachedFiles: []
  });
  
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<InspectionHistory[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  // Заполнение данных по VIN (WMI/VDS декодер + поиск)
  const handleVinLookup = async (forcedVin?: string) => {
    const vinToSearch = forcedVin || carData.vin;
    if (vinToSearch.length < 5) return;
    setVinLoading(true);
    try {
      const res = await lookupVin(vinToSearch);
      if (res) {
        setCarData(prev => ({ 
          ...prev, 
          vin: vinToSearch,
          make: res.make || prev.make, 
          model: res.model || prev.model, 
          year: res.year || prev.year 
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVinLoading(false);
    }
  };

  // OCR распознавание VIN из изображения
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        
        const newFile = {
          name: file.name,
          type: file.type,
          data: base64Data
        };

        setCarData(prev => ({
          ...prev,
          attachedFiles: [...prev.attachedFiles, newFile]
        }));

        // Если это изображение, пробуем найти на нем VIN
        if (file.type.startsWith('image/')) {
          setScanLoading(true);
          try {
            const extractedVin = await extractVinFromImage(base64Data, file.type);
            if (extractedVin) {
              await handleVinLookup(extractedVin);
            }
          } catch (err) {
            console.error("Scan failed:", err);
          } finally {
            setScanLoading(false);
          }
        }
      };
      if (file.type.startsWith('image/')) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
  };

  const handleRunAnalysis = async () => {
    if (!carData.make || !carData.model) {
      alert("Укажите марку и модель автомобиля");
      return;
    }
    setLoading(true);
    setAppError(null);
    try {
      const result = await analyzeCar(carData);
      setAnalysis(result);
      const newHist = { 
        id: result.id, 
        date: new Date().toLocaleDateString(), 
        model: `${carData.make} ${carData.model}`, 
        status: 'OK' 
      };
      const updatedHistory = [newHist, ...history].slice(0, 20);
      setHistory(updatedHistory);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
      localStorage.setItem(`${STORAGE_KEYS.ANALYSIS_PREFIX}${result.id}`, JSON.stringify(result));
    } catch (error) {
      console.error("Analysis error:", error);
      setAppError("Ошибка при анализе. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const msg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      if (!chatInstance.current) chatInstance.current = startDiagnosticChat(carData, analysis);
      const res = await chatInstance.current.sendMessage({ message: msg });
      const sources = extractSources(res);
      setChatMessages(prev => [...prev, { 
        role: 'model', 
        text: res.text || 'Нет ответа',
        sources: sources.length > 0 ? sources : undefined
      }]);
    } catch (e) {
      console.error("Chat error:", e);
      setChatMessages(prev => [...prev, { role: 'model', text: 'Ошибка соединения с ассистентом.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleShare = async () => {
    if (!analysis) return;
    const shareData = {
      title: `BI-Avto PRO: Отчет по ${carData.make} ${carData.model}`,
      text: `Результаты диагностики автомобиля ${carData.make} ${carData.model}. Рекомендовано работ: ${analysis.upsells.length}.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !analysis) return;
    setIsExporting(true);
    
    const originalClass = reportRef.current.className;
    reportRef.current.classList.add('export-mode');

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 3, 
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Отчет-BI-AVTO-${carData.make}-${analysis.id}.pdf`);
    } catch (err) {
      console.error('PDF Export failed:', err);
    } finally {
      reportRef.current.className = originalClass;
      setIsExporting(false);
    }
  };

  const handleExportHtml = () => {
    if (!analysis) return;
    setIsExportingHtml(true);

    const upsellsHtml = analysis.upsells.map(u => `
      <div class="p-5 rounded-2xl border ${u.critical ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'} mb-4 flex items-start gap-4 shadow-sm">
        <div class="mt-1">
          ${u.critical ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'}
        </div>
        <div class="flex-1">
          <div class="flex justify-between items-center mb-1">
            <h4 class="font-bold text-gray-900 leading-none">${u.name}</h4>
            ${u.critical ? '<span class="text-[9px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">Критично</span>' : ''}
          </div>
          <p class="text-xs text-gray-600 leading-relaxed">${u.reason}</p>
        </div>
      </div>
    `).join('');

    const sourcesHtml = analysis.sources?.map(s => `
        <a href="${s.uri}" target="_blank" class="text-[11px] bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors inline-flex items-center gap-1 mb-2 mr-2 decoration-none">
          ${s.title} 🔗
        </a>
    `).join('') || '';

    const htmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отчет BI-AVTO: ${carData.make} ${carData.model}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #1e293b; }
        .glass-card { background: white; border-radius: 32px; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05); padding: 40px; border: 1px solid rgba(0,0,0,0.05); }
        .gradient-header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); }
    </style>
</head>
<body class="p-4 md:p-10">
    <div class="max-w-4xl mx-auto space-y-10">
        <!-- Brand Header -->
        <header class="glass-card flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-none overflow-hidden relative">
            <div class="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div class="flex items-center gap-6 relative z-10">
                <div class="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-600/20">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
                <div>
                    <h1 class="text-3xl font-black tracking-tighter uppercase text-slate-900">BI-AVTO <span class="text-blue-600">PRO</span></h1>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Цифровой паспорт и диагностика</p>
                </div>
            </div>
            <div class="text-left md:text-right relative z-10">
                <p class="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">ID Отчета: ${analysis.id}</p>
                <p class="text-sm font-extrabold text-slate-900">${new Date().toLocaleDateString('ru-RU')}</p>
                <p class="text-xs text-slate-400">Сформировано системой BI-AVTO AI</p>
            </div>
        </header>

        <!-- Vehicle Stats Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2">Автомобиль</p>
                <p class="font-extrabold text-slate-900 text-lg leading-tight">${carData.make} ${carData.model}</p>
            </div>
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2">Год выпуска</p>
                <p class="font-extrabold text-slate-900 text-lg">${carData.year || 'н/д'}</p>
            </div>
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2">Пробег</p>
                <p class="font-extrabold text-slate-900 text-lg">${carData.mileage.toLocaleString()} км</p>
            </div>
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2">VIN-код</p>
                <p class="font-bold text-blue-600 font-mono text-sm">${carData.vin || 'НЕТ ДАННЫХ'}</p>
            </div>
        </div>

        <!-- Risk Level -->
        <div class="glass-card border-none overflow-hidden relative ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-50' : 'bg-orange-50'}">
            <div class="flex items-center justify-between mb-8">
                <div class="flex items-center gap-4">
                    <div class="p-3 rounded-2xl ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                    </div>
                    <div>
                        <h3 class="text-xs font-black uppercase tracking-widest text-slate-500">Предиктивный риск поломки</h3>
                        <p class="text-[10px] text-slate-400 mt-0.5 italic">Данные Drive2, Drom и профильных форумов</p>
                    </div>
                </div>
                <div class="text-5xl font-black ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'text-red-600' : 'text-orange-600'} tracking-tighter">${analysis.predictiveAnalysis?.failureProbability || 0}%</div>
            </div>
            <p class="text-sm font-medium text-slate-700 leading-relaxed border-l-4 ${analysis.predictiveAnalysis?.failureProbability! > 60 ? 'border-red-600' : 'border-orange-500'} pl-6 italic bg-white/50 py-4 rounded-r-xl">${analysis.predictiveAnalysis?.reasoning || ''}</p>
        </div>

        <!-- Technical Verdict -->
        <div class="glass-card">
            <div class="flex items-center gap-4 mb-8">
                <div class="bg-blue-50 p-3 rounded-2xl text-blue-600">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <h2 class="text-xl font-black uppercase tracking-tight text-slate-900">Технический вердикт</h2>
            </div>
            <div class="text-slate-700 text-sm leading-loose whitespace-pre-line text-justify">${analysis.detailedIssues}</div>
            
            ${sourcesHtml ? `
            <div class="mt-10 pt-8 border-t border-slate-100">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Найдено на форумах и авто-сайтах:</p>
                <div class="flex flex-wrap">${sourcesHtml}</div>
            </div>
            ` : ''}
        </div>

        <!-- Maintenance Plan -->
        <div class="glass-card">
            <div class="flex items-center gap-4 mb-8">
                <div class="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 class="text-xl font-black uppercase tracking-tight text-slate-900">Рекомендуемое обслуживание</h2>
            </div>
            <div>${upsellsHtml}</div>
        </div>

        <footer class="text-center py-10">
            <div class="inline-flex items-center gap-3 px-6 py-2 bg-slate-200/50 rounded-full border border-slate-200">
                <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Безопасность подтверждена BI-AVTO PRO Diagnostic Engine</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-6 font-medium uppercase tracking-[0.2em]">© 2025 BI-AVTO PRO | AI-DRIVEN PREDICTIVE ANALYTICS</p>
        </footer>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Отчет-BI-AVTO-${carData.make}-${carData.model}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExportingHtml(false);
  };

  if (appError) {
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center p-10 text-center text-slate-200">
        <div className="max-w-md space-y-6">
          <AlertTriangle size={64} className="mx-auto text-red-500" />
          <h1 className="text-2xl font-bold">Ошибка системы</h1>
          <p className="text-slate-400">{appError}</p>
          <button onClick={() => setAppError(null)} className="px-6 py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition-colors">Попробовать снова</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-slate-200 overflow-hidden font-sans">
      <aside className={`no-print w-80 border-r border-white/5 bg-[#0c0c0c] flex flex-col transition-all z-50 fixed md:relative inset-y-0 ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="text-blue-500 fill-blue-500" size={24} />
            <span className="font-black text-xl tracking-tighter uppercase">BI-AVTO</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden text-slate-400"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2">Архив</h3>
          {history.length === 0 && <p className="text-xs text-slate-600 px-2 italic">История пуста</p>}
          {history.map(h => (
            <div key={h.id} onClick={() => {
              const data = localStorage.getItem(`${STORAGE_KEYS.ANALYSIS_PREFIX}${h.id}`);
              if (data) setAnalysis(JSON.parse(data));
              setShowSidebar(false);
            }} className="p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 transition-all">
              <div className="text-sm font-bold truncate">{h.model}</div>
              <div className="text-[10px] text-slate-500">{h.date}</div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-20 border-b border-white/10 bg-[#080808]/80 backdrop-blur-xl px-6 flex items-center justify-between z-40 no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden text-slate-200"><Menu size={24} /></button>
            <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <Activity size={18} className="text-blue-500" />
              <span className="text-sm font-bold truncate max-w-[150px]">{carData.make ? `${carData.make} ${carData.model}` : 'Новая диагностика'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {analysis && (
              <>
                <button 
                  onClick={handleShare} 
                  title="Копировать ссылку"
                  className={`p-2 rounded-lg transition-all duration-300 flex items-center gap-2 ${shareSuccess ? 'bg-emerald-600/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                >
                  {shareSuccess ? <ClipboardCheck size={20} /> : <Share2 size={20} />}
                </button>
                <button 
                  onClick={handleExportHtml} 
                  disabled={isExportingHtml}
                  title="Экспорт в интерактивный HTML"
                  className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                >
                   {isExportingHtml ? <Loader2 className="animate-spin" size={20} /> : <FileCode size={20} />}
                   <span className="text-xs font-bold hidden sm:inline uppercase tracking-tighter">HTML Отчет</span>
                </button>
                <button 
                  onClick={handleDownloadPdf} 
                  disabled={isExporting}
                  title="Скачать PDF"
                  className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isExporting ? <Loader2 className="animate-spin" size={20} /> : <FileDown size={20} />}
                  <span className="text-xs font-bold hidden sm:inline uppercase tracking-tighter">PDF Отчет</span>
                </button>
                <button 
                  onClick={() => window.print()} 
                  title="Печать"
                  className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <Printer size={20} />
                </button>
              </>
            )}
            <button onClick={() => setShowChat(!showChat)} className={`p-2 rounded-lg transition-colors ${showChat ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>
              <MessageSquare size={20} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-12 no-print">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-6 no-print">
              <div className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[32px] space-y-8 shadow-2xl">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">VIN-КОД</label>
                    {scanLoading && <div className="flex items-center gap-2 text-[9px] text-blue-500 font-bold uppercase animate-pulse"><Loader2 size={10} className="animate-spin" /> Сканирую фото...</div>}
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2 text-sm uppercase text-slate-100 font-mono tracking-widest focus:border-blue-500 outline-none transition-colors" value={carData.vin} onChange={e => setCarData({...carData, vin: e.target.value.toUpperCase()})} placeholder="WBA..." />
                    <button onClick={() => handleVinLookup()} disabled={vinLoading} className="p-2 bg-blue-600 rounded-lg disabled:opacity-50 hover:bg-blue-500 transition-colors">
                      {vinLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Марка</label>
                    <input className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none transition-colors" placeholder="Toyota" value={carData.make} onChange={e => setCarData({...carData, make: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Модель</label>
                    <input className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none transition-colors" placeholder="Camry" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Год</label>
                    <input type="number" className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none transition-colors" placeholder="2020" value={carData.year || ''} onChange={e => setCarData({...carData, year: parseInt(e.target.value) || undefined})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Пробег</label>
                    <input type="number" className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-blue-500 outline-none transition-colors" placeholder="85000" value={carData.mileage || ''} onChange={e => setCarData({...carData, mileage: parseInt(e.target.value) || 0})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Жалоба</label>
                  <textarea rows={4} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 resize-none focus:border-blue-500 outline-none transition-colors" value={carData.complaint} onChange={e => setCarData({...carData, complaint: e.target.value})} placeholder="Опишите проблему..." />
                </div>

                <div className="space-y-4">
                  <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-blue-500 transition-all bg-white/[0.01]">
                    <div className="flex gap-2 mb-2">
                       <UploadCloud size={24} className="text-slate-500" />
                       <Camera size={24} className="text-blue-500" />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500">Загрузите СТС или фото VIN</span>
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.txt" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {carData.attachedFiles.map((f, i) => (
                      <div key={i} className="px-2 py-1 bg-white/5 rounded text-[10px] truncate max-w-[100px] border border-white/10">{f.name}</div>
                    ))}
                  </div>
                </div>

                <button onClick={handleRunAnalysis} disabled={loading} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 disabled:bg-slate-800 shadow-xl shadow-blue-600/20">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                  {loading ? 'Анализ...' : 'Запустить анализ'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-12">
              {loading ? (
                <SkeletonLoader />
              ) : !analysis ? (
                <div className="h-[600px] border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center bg-white/[0.01] no-print">
                  <Database size={48} className="text-slate-800 mb-6" />
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Ожидание данных для аналитики</p>
                </div>
              ) : (
                <div ref={reportRef} className="space-y-12 animate-in fade-in slide-in-from-bottom-10 duration-700 p-4 md:p-0">
                  <div className="hidden export-mode:block print:block mb-12 border-b-2 border-blue-600 pb-8">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                         <div className="bg-blue-600 p-3 rounded-2xl">
                           <Zap className="text-white" size={32} />
                         </div>
                         <div>
                            <h1 className="text-3xl font-black tracking-tighter uppercase">BI-AVTO PRO</h1>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Интеллектуальный диагностический отчет</p>
                         </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ID Отчета</div>
                        <div className="text-sm font-mono font-bold">{analysis.id}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3 mb-1">Дата формирования</div>
                        <div className="text-sm font-bold">{new Date().toLocaleDateString('ru-RU')}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-6 mt-12 bg-slate-50 border border-slate-200 p-6 rounded-[24px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400"><Car size={14}/><span className="text-[9px] font-black uppercase">Автомобиль</span></div>
                        <div className="font-bold text-sm">{carData.make} {carData.model}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400"><Calendar size={14}/><span className="text-[9px] font-black uppercase">Год выпуска</span></div>
                        <div className="font-bold text-sm">{carData.year || 'н/д'}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400"><Gauge size={14}/><span className="text-[9px] font-black uppercase">Пробег</span></div>
                        <div className="font-bold text-sm">{carData.mileage.toLocaleString()} км</div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400"><Fingerprint size={14}/><span className="text-[9px] font-black uppercase">VIN-Код</span></div>
                        <div className="font-bold text-sm font-mono">{carData.vin || 'НЕТ ДАННЫХ'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 report-section">
                    <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                    <MermaidViewer chart={analysis.mermaidGantt} id="gantt" />
                  </div>

                  <div className="report-section">
                    <InteractiveDashboard analysis={analysis} />
                  </div>
                  
                  <div className="report-section">
                    <PredictiveAnalysisModule data={analysis.predictiveAnalysis!} />
                  </div>

                  {analysis.sources && analysis.sources.length > 0 && (
                    <div className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[32px] shadow-2xl report-section report-card no-print">
                      <div className="flex items-center gap-4 mb-8">
                        <Search size={24} className="text-blue-500" />
                        <h2 className="text-md font-black uppercase tracking-widest text-white">Источники (RU)</h2>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {analysis.sources.map((s, i) => (
                          <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-blue-400 transition-all font-medium flex items-center gap-2 truncate max-w-[250px]">
                            <ExternalLink size={12} /> {s.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-[#0c0c0c] border border-white/5 p-10 rounded-[40px] shadow-2xl report-section report-card">
                    <div className="flex items-center gap-4 text-blue-500 mb-8">
                      <FileText size={24} />
                      <h2 className="text-lg font-black uppercase tracking-widest text-white">Вердикт системы</h2>
                    </div>
                    <div className="text-slate-300 text-[15px] leading-relaxed whitespace-pre-line font-medium text-justify">
                      {analysis.detailedIssues}
                    </div>
                  </div>

                  <div className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[32px] shadow-2xl report-section report-card">
                    <div className="flex items-center gap-4 mb-8">
                      <TrendingUp className="text-emerald-500" size={24} />
                      <h2 className="text-md font-black uppercase tracking-widest text-white">Рекомендации</h2>
                    </div>
                    <div className="space-y-4">
                      {analysis.upsells.map((u, i) => (
                        <div key={i} className={`p-6 rounded-2xl border ${u.critical ? 'bg-red-500/5 border-red-500/20' : 'bg-black/40 border-white/5'}`}>
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-bold text-slate-200">{u.name}</span>
                            {u.critical && <span className="text-[9px] font-black text-red-500 border border-red-500/30 px-2 py-1 rounded-md uppercase tracking-tighter bg-red-500/10">Критично</span>}
                          </div>
                          <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">{u.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="hidden export-mode:flex print:flex justify-between items-center mt-20 pt-8 border-t border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <div>© BI-AVTO PRO Diagnostic Engine</div>
                    <div>Сформировано автоматически AI-системой</div>
                    <div>Стр. 1 из 1</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showChat && (
          <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-[#080808] border-l border-white/10 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-500 no-print">
            <div className="p-8 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Bot size={24} className="text-blue-500" />
                <span className="font-black uppercase text-[11px] tracking-widest">AI Мастер</span>
              </div>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300 border border-white/10'}`}>
                    {m.text}
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 max-w-[85%]">
                      {m.sources.map((s, si) => (
                        <a key={si} href={s.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:underline bg-white/5 px-2 py-1 rounded border border-white/5 transition-colors">
                          {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl animate-pulse">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-8 border-t border-white/10 flex gap-4">
              <input className="flex-1 bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm text-slate-200 outline-none focus:border-blue-500 transition-all" placeholder="Спросить ассистента..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
              <button onClick={handleSendMessage} disabled={!chatInput.trim() || isChatLoading} className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all disabled:opacity-50">
                <Send size={20} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
