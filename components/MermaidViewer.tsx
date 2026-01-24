'use client';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidViewerProps {
  chart: string;
  id: string;
}

export default function MermaidViewer({ chart, id }: MermaidViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (ref.current && chart) {
      mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      });
      
      const renderChart = async () => {
        try {
          const uniqueId = `mermaid-${id}-${Date.now()}`;
          const { svg } = await mermaid.render(uniqueId, chart);
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        } catch (error) {
          console.error('Mermaid render error:', error);
          if (ref.current) {
            ref.current.innerHTML = `<div class="text-red-600 p-4">Ошибка рендера диаграммы</div>`;
          }
        }
      };
      
      renderChart();
    }
  }, [chart, id]);

  return (
    <div className="bg-white border border-slate-300 rounded-2xl p-6 min-h-[200px] flex items-center justify-center">
      <div ref={ref} className="w-full" />
    </div>
  );
}