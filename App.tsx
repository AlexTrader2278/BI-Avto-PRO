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
      theme: 'neutral', // Светлая тема для диаграмм
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
            if (ref.current) ref.current.innerHTML = `<p class="text-[10px] text-slate-400">Ошибка отрисовки графика</p>`;
          });
        } else {
          if (ref.current) ref.current.innerHTML = `<p class="text-[10px] text-slate-400 italic">Визуализация недоступна</p>`;
        }
      } catch (e) {
        console.error("Mermaid block failed:", e);
      }
    }
  }, [chart, id]);

  return return <div style={{padding:'40px',textAlign:'center',minHeight:'100vh',backgroundColor:'#f8fafc',fontFamily:'Inter'}}><h1 style={{fontSize:'48px',color:'#0f172a'}}>BI-Avto PRO</h1><p style={{fontSize:'18px',color:'#64748b'}}>Workspace for Service Advisors</p><div style={{backgroundColor:'white',padding:'30px',borderRadius:'8px',maxWidth:'600px',margin:'0 auto',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}><h2 style={{color:'#0f172a'}}>Welcome!</h2><p style={{fontSize:'16px',color:'#475569'}}>Application successfully deployed on Vercel</p><ul style={{textAlign:'left',color:'#475569'}}><li>Analyze vehicle VIN data</li><li>Car diagnostic</li><li>Interactive chat with AI</li></ul></div></div>;
