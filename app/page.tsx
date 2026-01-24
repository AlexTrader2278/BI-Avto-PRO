'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Car,
  Search,
  Upload,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import MermaidViewer from '@/components/MermaidViewer';
import { analyzeCar, lookupVin, chatWithAI } from '@/lib/ai';
import { CarData, AttachedFile, AnalysisResult, ChatMessage } from '@/lib/types';

export default function Home() {
  // State управление
  const [carData, setCarData] = useState<CarData>({
    make: '',
    model: '',
    year: undefined,
    mileage: 0,
    complaint: '',
    vin: '',
    attachedFiles: [],
  });

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isVinLookup, setIsVinLookup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll чата
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // VIN поиск
  const handleVinLookup = async () => {
    if (!carData.vin || carData.vin.length < 10) {
      setError('Введите корректный VIN номер (минимум 10 символов)');
      return;
    }

    setIsVinLookup(true);
    setError(null);

    try {
      const vinData = await lookupVin(carData.vin);
      setCarData((prev) => ({
        ...prev,
        make: vinData.make || prev.make,
        model: vinData.model || prev.model,
        year: vinData.year || prev.year,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка поиска VIN');
    } finally {
      setIsVinLookup(false);
    }
  };

  // Загрузка файлов
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const attachedFile: AttachedFile = {
          name: file.name,
          type: file.type,
          data: reader.result as string,
        };
        setCarData((prev) => ({
          ...prev,
          attachedFiles: [...prev.attachedFiles, attachedFile],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  // Удаление файла
  const removeFile = (index: number) => {
    setCarData((prev) => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((_, i) => i !== index),
    }));
  };

  // Анализ автомобиля
  const handleAnalyze = async () => {
    if (!carData.make || !carData.model || !carData.complaint) {
      setError('Заполните марку, модель и описание проблемы');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeCar(carData);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка анализа');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Чат
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsChatting(true);

    try {
      const response = await chatWithAI([...chatMessages, userMessage], carData);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка чата');
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Car className="w-12 h-12 text-blue-600" />
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800">
              BI-AVTO PRO
            </h1>
          </div>
          <p className="text-lg text-slate-600">
            Интеллектуальная диагностика и рекомендации по обслуживанию
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-5 h-5 text-red-600" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                Данные автомобиля
              </h2>

              {/* VIN Lookup */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  VIN номер
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={carData.vin}
                    onChange={(e) => setCarData({ ...carData, vin: e.target.value.toUpperCase() })}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1HGBH41JXMN109186"
                  />
                  <button
                    onClick={handleVinLookup}
                    disabled={isVinLookup}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isVinLookup ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Search className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Make */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Марка *
                </label>
                <input
                  type="text"
                  value={carData.make}
                  onChange={(e) => setCarData({ ...carData, make: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Toyota"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Модель *
                </label>
                <input
                  type="text"
                  value={carData.model}
                  onChange={(e) => setCarData({ ...carData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Camry"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Год выпуска
                </label>
                <input
                  type="number"
                  value={carData.year || ''}
                  onChange={(e) => setCarData({ ...carData, year: parseInt(e.target.value) || undefined })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2020"
                />
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Пробег (км)
                </label>
                <input
                  type="number"
                  value={carData.mileage || ''}
                  onChange={(e) => setCarData({ ...carData, mileage: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="50000"
                />
              </div>

              {/* Complaint */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Описание проблемы *
                </label>
                <textarea
                  value={carData.complaint}
                  onChange={(e) => setCarData({ ...carData, complaint: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Опишите симптомы и проблемы..."
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Загрузить файлы
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-slate-600"
                >
                  <Upload className="w-5 h-5" />
                  Выбрать файлы
                </button>

                {/* Files List */}
                {carData.attachedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {carData.attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                      >
                        <span className="text-sm text-slate-700 truncate">{file.name}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 font-semibold flex items-center justify-center gap-2 shadow-lg"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Анализирую...
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-5 h-5" />
                    Анализировать
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2 space-y-6">
            {analysis ? (
              <>
                {/* Detailed Issues */}
                <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                    Анализ проблем
                  </h2>
                  <div className="prose max-w-none text-slate-700 leading-relaxed">
                    {analysis.detailedIssues}
                  </div>
                </div>

                {/* Upsells */}
                {analysis.upsells && analysis.upsells.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Wrench className="w-6 h-6 text-blue-600" />
                      Рекомендуемые услуги
                    </h2>
                    <div className="space-y-3">
                      {analysis.upsells.map((upsell, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border-2 ${
                            upsell.critical
                              ? 'border-red-300 bg-red-50'
                              : 'border-blue-300 bg-blue-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {upsell.critical ? (
                              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                            )}
                            <div>
                              <h3 className="font-semibold text-slate-800">{upsell.name}</h3>
                              <p className="text-sm text-slate-600 mt-1">{upsell.reason}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Predictive Analysis */}
                {analysis.predictiveAnalysis && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                      Прогнозируемый анализ
                    </h2>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-700 font-medium">
                          Вероятность поломки
                        </span>
                        <span className="text-2xl font-bold text-purple-600">
                          {analysis.predictiveAnalysis.failureProbability}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${analysis.predictiveAnalysis.failureProbability}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-slate-700">{analysis.predictiveAnalysis.reasoning}</p>
                  </div>
                )}

                {/* Mermaid Charts */}
                {analysis.mermaidPie && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">
                      Распределение работ
                    </h2>
                    <MermaidViewer chart={analysis.mermaidPie} id="pie" />
                  </div>
                )}

                {analysis.mermaidGantt && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">
                      План выполнения работ
                    </h2>
                    <MermaidViewer chart={analysis.mermaidGantt} id="gantt" />
                  </div>
                )}

                {/* Chat */}
                <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                    Чат с AI
                  </h2>

                  {/* Messages */}
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <p className="text-slate-500 text-center py-8">
                        Задайте вопрос об автомобиле или ремонте
                      </p>
                    ) : (
                      chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl ${
                            msg.role === 'user'
                              ? 'bg-blue-50 ml-auto max-w-[80%]'
                              : 'bg-slate-50 mr-auto max-w-[80%]'
                          }`}
                        >
                          <p className="text-slate-800 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isChatting && handleSendMessage()}
                      placeholder="Задайте вопрос..."
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isChatting}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isChatting || !chatInput.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isChatting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <Car className="w-20 h-20 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  Готовы к анализу
                </h3>
                <p className="text-slate-500">
                  Заполните данные автомобиля и нажмите "Анализировать"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}