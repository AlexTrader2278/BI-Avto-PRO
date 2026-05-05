'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Car, Search, Loader2, AlertCircle, CheckCircle2, ShieldAlert,
  TrendingUp, MessageSquare, Send, ExternalLink, Wrench, Info,
  ChevronRight, Gauge, Zap, BarChart3,
} from 'lucide-react';
import SkeletonLoader from '@/components/SkeletonLoader';
import { analyzeCar, lookupVin, chatWithAI } from '@/lib/ai';
import { CarInput, AnalysisResult, ChatMessage, ProblemForecast } from '@/lib/types';

const severityConfig = {
  critical: {
    label: 'Критично',
    sublabel: 'Срочно требует внимания',
    bar: 'bg-red-500',
    badge: 'bg-red-500 text-white',
    border: 'border-red-300',
    cardBg: 'bg-gradient-to-br from-red-50 to-white',
    ring: 'ring-red-200',
    icon: ShieldAlert,
    dot: 'bg-red-500',
    score: 3,
  },
  medium: {
    label: 'Внимание',
    sublabel: 'Стоит проверить',
    bar: 'bg-amber-400',
    badge: 'bg-amber-400 text-amber-950',
    border: 'border-amber-300',
    cardBg: 'bg-gradient-to-br from-amber-50 to-white',
    ring: 'ring-amber-200',
    icon: AlertCircle,
    dot: 'bg-amber-400',
    score: 2,
  },
  low: {
    label: 'Плановое',
    sublabel: 'Профилактика',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500 text-white',
    border: 'border-emerald-300',
    cardBg: 'bg-gradient-to-br from-emerald-50 to-white',
    ring: 'ring-emerald-200',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    score: 1,
  },
};

function TrafficLight({ severity }: { severity: 'critical' | 'medium' | 'low' }) {
  return (
    <div className="flex flex-col items-center gap-1.5 bg-slate-900 rounded-xl p-2 shadow-inner flex-shrink-0">
      <div className={`w-4 h-4 rounded-full ${severity === 'critical' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]' : 'bg-slate-700'}`} />
      <div className={`w-4 h-4 rounded-full ${severity === 'medium' ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]' : 'bg-slate-700'}`} />
      <div className={`w-4 h-4 rounded-full ${severity === 'low' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]' : 'bg-slate-700'}`} />
    </div>
  );
}

function ProblemCard({ problem, index }: { problem: ProblemForecast; index: number }) {
  const cfg = severityConfig[problem.severity] ?? severityConfig.medium;
  const Icon = cfg.icon;

  return (
    <div className={`${cfg.cardBg} rounded-2xl border-2 ${cfg.border} p-4 shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="flex items-start gap-3 mb-3">
        <TrafficLight severity={problem.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-slate-400 text-xs font-bold flex-shrink-0">#{index + 1}</span>
              <h3 className="font-bold text-slate-800 text-sm leading-tight">{problem.name}</h3>
            </div>
            <span className="text-2xl font-black text-slate-800 leading-none flex-shrink-0">{problem.probability}%</span>
          </div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400">{cfg.sublabel}</span>
          </div>
          <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
            <div
              className={`${cfg.bar} h-2 rounded-full transition-all duration-1000`}
              style={{ width: `${problem.probability}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm ml-1">
        <div className="flex items-start gap-2 bg-white/70 rounded-xl p-2.5 border border-slate-100">
          <Gauge className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Пробег</p>
            <p className="text-slate-700 font-medium text-xs">{problem.mileageRange}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-white/70 rounded-xl p-2.5 border border-slate-100">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-0.5">Причина</p>
            <p className="text-slate-700 text-xs">{problem.cause}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-2.5 border border-blue-100">
          <Wrench className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-0.5">Решение</p>
            <p className="text-blue-900 font-medium text-xs">{problem.solution}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskOverview({ problems }: { problems: ProblemForecast[] }) {
  const riskScore = Math.round(
    problems.reduce((sum, p) => {
      const w = (severityConfig[p.severity] ?? severityConfig.medium).score;
      return sum + (p.probability * w);
    }, 0) / (problems.length * 3)
  );

  const riskLabel = riskScore >= 70 ? { text: 'Высокий риск', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
    : riskScore >= 40 ? { text: 'Умеренный риск', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
    : { text: 'Низкий риск', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };

  return (
    <div className={`${riskLabel.bg} border-2 ${riskLabel.border} rounded-2xl p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className={`w-4 h-4 ${riskLabel.color}`} />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Сводка рисков</span>
        </div>
        <span className={`text-sm font-black ${riskLabel.color} px-3 py-1 rounded-full ${riskLabel.bg} border ${riskLabel.border}`}>
          {riskLabel.text}
        </span>
      </div>
      <div className="space-y-2">
        {problems.map((p, i) => {
          const cfg = severityConfig[p.severity] ?? severityConfig.medium;
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <span className="text-xs text-slate-600 flex-1 truncate">{p.name}</span>
              <div className="w-24 bg-white/80 rounded-full h-1.5 overflow-hidden flex-shrink-0">
                <div className={`${cfg.bar} h-1.5 rounded-full`} style={{ width: `${p.probability}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-700 w-8 text-right flex-shrink-0">{p.probability}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [carInput, setCarInput] = useState<CarInput>({
    make: '', model: '', year: new Date().getFullYear(), mileage: 0, vin: '',
  });
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVinLookup, setIsVinLookup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleVinLookup = async () => {
    if (!carInput.vin || carInput.vin.length < 10) { setError('Введите VIN номер (минимум 10 символов)'); return; }
    setIsVinLookup(true); setError(null);
    try {
      const vinData = await lookupVin(carInput.vin);
      setCarInput((prev) => ({ ...prev, make: vinData.make || prev.make, model: vinData.model || prev.model, year: vinData.year || prev.year }));
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка VIN декодера'); }
    finally { setIsVinLookup(false); }
  };

  const handleAnalyze = async () => {
    if (!carInput.make || !carInput.model) { setError('Введите марку и модель автомобиля'); return; }
    setIsAnalyzing(true); setError(null); setAnalysis(null); setChatMessages([]);
    try {
      const result = await analyzeCar(carInput);
      setAnalysis(result);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка анализа'); }
    finally { setIsAnalyzing(false); }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatting(true);
    try {
      const reply = await chatWithAI([...chatMessages, userMessage], carInput);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка чата'); }
    finally { setIsChatting(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-4 shadow-xl">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight">
              BI-Avto<span className="text-blue-400">PRO</span>
            </h1>
            <p className="text-xs text-slate-400">Предиктивная аналитика автомобилей</p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            AI + Форумы
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs underline flex-shrink-0">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Input Form */}
          <aside className="lg:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 lg:sticky lg:top-5">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <Gauge className="w-4 h-4 text-blue-500" />
                Данные автомобиля
              </h2>

              {/* VIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  VIN (опционально)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={carInput.vin}
                    onChange={(e) => setCarInput({ ...carInput, vin: e.target.value.toUpperCase() })}
                    onKeyDown={(e) => e.key === 'Enter' && handleVinLookup()}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1HGBH41JXMN109186"
                  />
                  <button
                    onClick={handleVinLookup}
                    disabled={isVinLookup}
                    className="px-3 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50"
                  >
                    {isVinLookup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Make + Model */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Марка *', key: 'make' as const, placeholder: 'Toyota' },
                  { label: 'Модель *', key: 'model' as const, placeholder: 'Camry' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{label}</label>
                    <input
                      type="text"
                      value={carInput[key] as string}
                      onChange={(e) => setCarInput({ ...carInput, [key]: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>

              {/* Year + Mileage */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Год *</label>
                  <input
                    type="number"
                    value={carInput.year}
                    onChange={(e) => setCarInput({ ...carInput, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="2018" min={1990} max={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Пробег км *</label>
                  <input
                    type="number"
                    value={carInput.mileage || ''}
                    onChange={(e) => setCarInput({ ...carInput, mileage: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="120000"
                  />
                </div>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95 text-sm"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Анализирую форумы...</>
                ) : (
                  <><TrendingUp className="w-4 h-4" />Найти проблемы</>
                )}
              </button>

              <p className="text-xs text-slate-400 text-center leading-relaxed">
                AI ищет обсуждения на Дром, Drive2, Reddit и анализирует типичные проблемы модели
              </p>
            </div>
          </aside>

          {/* Results */}
          <section className="lg:col-span-8 space-y-4">
            {isAnalyzing && <SkeletonLoader />}

            {!isAnalyzing && !analysis && (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <Car className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-semibold text-slate-600 mb-2">Готов к анализу</h3>
                <p className="text-slate-400 text-sm max-w-xs">
                  Введите марку, модель и пробег — AI проанализирует тысячи обсуждений на форумах
                </p>
              </div>
            )}

            {analysis && (
              <>
                {/* Header */}
                <div className="bg-slate-900 text-white rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Car className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black truncate">
                        {analysis.make} {analysis.model} · {analysis.year}
                      </h2>
                      <p className="text-slate-400 text-xs">
                        Пробег {analysis.mileage.toLocaleString('ru-RU')} км · {analysis.problems.length} характерных проблем
                      </p>
                    </div>
                  </div>
                </div>

                {/* Severity Summary */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'critical', label: 'Критично', from: 'from-red-500', to: 'to-red-600', shadow: 'shadow-red-200', text: 'text-white', Icon: ShieldAlert },
                    { key: 'medium', label: 'Внимание', from: 'from-amber-400', to: 'to-amber-500', shadow: 'shadow-amber-200', text: 'text-amber-950', Icon: AlertCircle },
                    { key: 'low', label: 'Плановое', from: 'from-emerald-500', to: 'to-emerald-600', shadow: 'shadow-emerald-200', text: 'text-white', Icon: CheckCircle2 },
                  ].map(({ key, label, from, to, shadow, text, Icon }) => (
                    <div key={key} className={`bg-gradient-to-br ${from} ${to} ${text} rounded-2xl p-3 shadow-lg ${shadow}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <Icon className="w-4 h-4 opacity-90" />
                        <span className="text-2xl font-black">
                          {analysis.problems.filter((p) => p.severity === key).length}
                        </span>
                      </div>
                      <p className="text-xs font-bold opacity-90 uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Risk Overview — replaces mermaid chart, mobile-friendly */}
                <RiskOverview problems={analysis.problems} />

                {/* Problem Cards */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Прогноз проблем
                  </h3>
                  <div className="space-y-3">
                    {analysis.problems.map((problem, i) => (
                      <ProblemCard key={i} problem={problem} index={i} />
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5" />
                      Рекомендации
                    </h3>
                    <ul className="space-y-2">
                      {analysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources */}
                {analysis.sources.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Источники ({analysis.sources.length})
                    </h3>
                    <ul className="space-y-2">
                      {analysis.sources.map((src, i) => (
                        <li key={i}>
                          <a href={src} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5 break-all">
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {src}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Chat */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Спросить AI про {analysis.make} {analysis.model}
                  </h3>
                  <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <div className="flex items-center gap-2 text-slate-400 text-xs py-3">
                        <Zap className="w-3.5 h-3.5" />
                        Задайте вопрос — только по автомобилю
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div key={i} className={`px-3 py-2.5 rounded-xl text-sm whitespace-pre-wrap ${
                          msg.role === 'user' ? 'bg-blue-600 text-white ml-6' : 'bg-slate-100 text-slate-800 mr-6'
                        }`}>
                          {msg.content}
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isChatting && handleSendMessage()}
                      placeholder="Ваш вопрос..."
                      className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isChatting}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isChatting || !chatInput.trim()}
                      className="px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Disclaimer */}
      <footer className="max-w-5xl mx-auto px-4 pb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Дисклеймер:</strong> Все данные и прогнозы носят информационный характер и сформированы автоматически
            на основе анализа открытых источников с использованием AI. Перед ремонтом рекомендуем диагностику на СТО.
            BI-Avto-PRO не несёт ответственности за решения, принятые на основе данных сервиса.
          </p>
        </div>
      </footer>
    </main>
  );
}
