'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Car, Search, Loader2, AlertCircle, CheckCircle2, ShieldAlert,
  TrendingUp, MessageSquare, Send, ExternalLink, Wrench, Info,
  ChevronRight, Gauge,
} from 'lucide-react';
import MermaidViewer from '@/components/MermaidViewer';
import SkeletonLoader from '@/components/SkeletonLoader';
import { analyzeCar, lookupVin, chatWithAI } from '@/lib/ai';
import { CarInput, AnalysisResult, ChatMessage, ProblemForecast } from '@/lib/types';

const severityConfig = {
  critical: {
    label: 'Критично',
    sublabel: 'Срочно требует внимания',
    bar: 'bg-red-500',
    barGlow: 'shadow-red-200',
    badge: 'bg-red-500 text-white',
    border: 'border-red-300',
    cardBg: 'bg-gradient-to-br from-red-50 to-white',
    light: 'bg-red-500',
    lightGlow: 'shadow-[0_0_20px_rgba(239,68,68,0.6)]',
    icon: ShieldAlert,
  },
  medium: {
    label: 'Внимание',
    sublabel: 'Стоит проверить',
    bar: 'bg-amber-400',
    barGlow: 'shadow-amber-200',
    badge: 'bg-amber-400 text-amber-900',
    border: 'border-amber-300',
    cardBg: 'bg-gradient-to-br from-amber-50 to-white',
    light: 'bg-amber-400',
    lightGlow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]',
    icon: AlertCircle,
  },
  low: {
    label: 'Плановое',
    sublabel: 'Профилактика',
    bar: 'bg-emerald-500',
    barGlow: 'shadow-emerald-200',
    badge: 'bg-emerald-500 text-white',
    border: 'border-emerald-300',
    cardBg: 'bg-gradient-to-br from-emerald-50 to-white',
    light: 'bg-emerald-500',
    lightGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.6)]',
    icon: CheckCircle2,
  },
};

function TrafficLight({ severity }: { severity: 'critical' | 'medium' | 'low' }) {
  const isRed = severity === 'critical';
  const isYellow = severity === 'medium';
  const isGreen = severity === 'low';

  return (
    <div className="flex flex-col items-center gap-1.5 bg-slate-900 rounded-xl p-2.5 shadow-inner">
      <div
        className={`w-5 h-5 rounded-full transition-all ${
          isRed ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]' : 'bg-slate-700'
        }`}
      />
      <div
        className={`w-5 h-5 rounded-full transition-all ${
          isYellow ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]' : 'bg-slate-700'
        }`}
      />
      <div
        className={`w-5 h-5 rounded-full transition-all ${
          isGreen ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]' : 'bg-slate-700'
        }`}
      />
    </div>
  );
}

function ProblemCard({ problem }: { problem: ProblemForecast }) {
  const cfg = severityConfig[problem.severity] ?? severityConfig.medium;
  const Icon = cfg.icon;

  return (
    <div className={`${cfg.cardBg} rounded-2xl border-2 ${cfg.border} p-5 shadow-md hover:shadow-lg transition-shadow`}>
      <div className="flex items-start gap-4 mb-4">
        <TrafficLight severity={problem.severity} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-slate-800 leading-tight text-base">{problem.name}</h3>
            <span className="text-3xl font-black text-slate-800 leading-none">{problem.probability}%</span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            <span className="text-xs text-slate-500">· {cfg.sublabel}</span>
          </div>

          <div className="w-full bg-slate-200/60 rounded-full h-2.5 overflow-hidden">
            <div
              className={`${cfg.bar} h-2.5 rounded-full transition-all duration-1000 shadow-md ${cfg.barGlow}`}
              style={{ width: `${problem.probability}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 text-sm">
        <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1 font-semibold">Пробег проявления</p>
          <p className="text-slate-700 font-medium">{problem.mileageRange}</p>
        </div>
        <div className="bg-white/70 backdrop-blur rounded-xl p-3 border border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1 font-semibold">Причина</p>
          <p className="text-slate-700">{problem.cause}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs text-blue-500 uppercase tracking-wide mb-1 font-semibold">Решение</p>
          <p className="text-blue-900 font-medium">{problem.solution}</p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [carInput, setCarInput] = useState<CarInput>({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    mileage: 0,
    vin: '',
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
    if (!carInput.vin || carInput.vin.length < 10) {
      setError('Введите VIN номер (минимум 10 символов)');
      return;
    }
    setIsVinLookup(true);
    setError(null);
    try {
      const vinData = await lookupVin(carInput.vin);
      setCarInput((prev) => ({
        ...prev,
        make: vinData.make || prev.make,
        model: vinData.model || prev.model,
        year: vinData.year || prev.year,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка VIN декодера');
    } finally {
      setIsVinLookup(false);
    }
  };

  const handleAnalyze = async () => {
    if (!carInput.make || !carInput.model) {
      setError('Введите марку и модель автомобиля');
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeCar(carInput);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка анализа');
    } finally {
      setIsAnalyzing(false);
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка чата');
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">
              BI-Avto<span className="text-blue-400">PRO</span>
            </h1>
            <p className="text-xs text-slate-400">Предиктивная аналитика автомобилей</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-xs text-slate-400">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            AI powered by Perplexity Sonar
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800 text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-xs underline">
              Закрыть
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Input Form */}
          <aside className="lg:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 sticky top-6">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-500" />
                Данные автомобиля
              </h2>

              {/* VIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  VIN (опционально)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={carInput.vin}
                    onChange={(e) => setCarInput({ ...carInput, vin: e.target.value.toUpperCase() })}
                    onKeyDown={(e) => e.key === 'Enter' && handleVinLookup()}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1HGBH41JXMN109186"
                  />
                  <button
                    onClick={handleVinLookup}
                    disabled={isVinLookup}
                    className="px-3 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 flex items-center"
                  >
                    {isVinLookup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Make + Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Марка *
                  </label>
                  <input
                    type="text"
                    value={carInput.make}
                    onChange={(e) => setCarInput({ ...carInput, make: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Toyota"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Модель *
                  </label>
                  <input
                    type="text"
                    value={carInput.model}
                    onChange={(e) => setCarInput({ ...carInput, model: e.target.value })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Camry"
                  />
                </div>
              </div>

              {/* Year + Mileage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Год *
                  </label>
                  <input
                    type="number"
                    value={carInput.year}
                    onChange={(e) => setCarInput({ ...carInput, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="2018"
                    min={1990}
                    max={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Пробег (км) *
                  </label>
                  <input
                    type="number"
                    value={carInput.mileage || ''}
                    onChange={(e) => setCarInput({ ...carInput, mileage: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="120000"
                  />
                </div>
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Анализирую форумы...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Найти проблемы
                  </>
                )}
              </button>

              <p className="text-xs text-slate-400 text-center">
                AI ищет обсуждения на Дром, Drive2, Reddit и анализирует типичные проблемы модели
              </p>
            </div>
          </aside>

          {/* Right: Results */}
          <section className="lg:col-span-8 space-y-6">
            {isAnalyzing && <SkeletonLoader />}

            {!isAnalyzing && !analysis && (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <Car className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Готов к анализу</h3>
                <p className="text-slate-400 text-sm max-w-sm">
                  Введите данные автомобиля и нажмите «Найти проблемы». AI проанализирует тысячи обсуждений на форумах.
                </p>
              </div>
            )}

            {analysis && (
              <>
                {/* Summary Header */}
                <div className="bg-slate-900 text-white rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <Car className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-black">
                      {analysis.make} {analysis.model} · {analysis.year}
                    </h2>
                  </div>
                  <p className="text-slate-400 text-sm pl-11">
                    Пробег {analysis.mileage.toLocaleString('ru-RU')} км · Найдено {analysis.problems.length} характерных проблем
                  </p>
                </div>

                {/* Severity Summary */}
                {(() => {
                  const counts = {
                    critical: analysis.problems.filter((p) => p.severity === 'critical').length,
                    medium: analysis.problems.filter((p) => p.severity === 'medium').length,
                    low: analysis.problems.filter((p) => p.severity === 'low').length,
                  };
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl p-4 shadow-lg shadow-red-200">
                        <div className="flex items-center justify-between mb-1">
                          <ShieldAlert className="w-5 h-5 opacity-90" />
                          <span className="text-3xl font-black">{counts.critical}</span>
                        </div>
                        <p className="text-xs uppercase tracking-wide font-bold opacity-90">Критично</p>
                      </div>
                      <div className="bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950 rounded-2xl p-4 shadow-lg shadow-amber-200">
                        <div className="flex items-center justify-between mb-1">
                          <AlertCircle className="w-5 h-5 opacity-90" />
                          <span className="text-3xl font-black">{counts.medium}</span>
                        </div>
                        <p className="text-xs uppercase tracking-wide font-bold opacity-90">Внимание</p>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-4 shadow-lg shadow-emerald-200">
                        <div className="flex items-center justify-between mb-1">
                          <CheckCircle2 className="w-5 h-5 opacity-90" />
                          <span className="text-3xl font-black">{counts.low}</span>
                        </div>
                        <p className="text-xs uppercase tracking-wide font-bold opacity-90">Плановое</p>
                      </div>
                    </div>
                  );
                })()}

                {/* Problem Cards */}
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Прогноз проблем
                  </h3>
                  <div className="space-y-4">
                    {analysis.problems.map((problem, i) => (
                      <ProblemCard key={i} problem={problem} />
                    ))}
                  </div>
                </div>

                {/* Mermaid Chart */}
                {analysis.mermaidPie && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4">
                      Распределение вероятностей
                    </h3>
                    <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Рекомендации
                    </h3>
                    <ul className="space-y-2">
                      {analysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                          <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Sources */}
                {analysis.sources.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Источники ({analysis.sources.length})
                    </h3>
                    <ul className="space-y-2">
                      {analysis.sources.map((src, i) => (
                        <li key={i}>
                          <a
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 break-all"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {src}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Chat */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Задать вопрос AI
                  </h3>

                  <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                        <Info className="w-4 h-4" />
                        Спросите что-нибудь о {analysis.make} {analysis.model}
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`px-4 py-3 rounded-xl text-sm whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white ml-8'
                              : 'bg-slate-100 text-slate-800 mr-8'
                          }`}
                        >
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
                      className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isChatting}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isChatting || !chatInput.trim()}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isChatting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Disclaimer */}
      <footer className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Дисклеймер:</strong> Все данные и прогнозы носят информационный характер и сформированы автоматически
            на основе анализа открытых источников (форумы, обсуждения, статистика) с использованием передовых AI-моделей.
            Перед принятием решений о ремонте рекомендуем проконсультироваться с квалифицированным механиком и провести
            диагностику на СТО. BI-Avto-PRO не несёт ответственности за решения, принятые на основе данных сервиса.
          </p>
        </div>
      </footer>
    </main>
  );
}
