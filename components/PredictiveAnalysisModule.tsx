import React from 'react';
import { AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface PredictiveAnalysisModuleProps {
  data: {
    failureProbability: number;
    reasoning: string;
  };
}

const PredictiveAnalysisModule: React.FC<PredictiveAnalysisModuleProps> = ({ data }) => {
  const prob = data.failureProbability;
  const isCritical = prob > 60;
  
  return (
    <div className={`relative overflow-hidden border p-8 rounded-[32px] shadow-sm transition-all duration-500 ${
      isCritical ? 'border-red-200 bg-red-50/50' : 'border-orange-200 bg-orange-50/50'
    }`}>
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-current opacity-[0.03] blur-[80px]" />
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${isCritical ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
            <Activity size={24} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
            Предиктивный риск
          </h2>
        </div>
        <div className={`text-4xl font-black font-mono tracking-tighter ${isCritical ? 'text-red-600' : 'text-orange-600'}`}>
          {prob}%
        </div>
      </div>

      <div className="space-y-6">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${isCritical ? 'bg-red-500' : 'bg-orange-500'}`}
            style={{ width: `${prob}%` }}
          />
        </div>
        
        <div className="flex gap-4 items-start bg-white/60 p-5 rounded-2xl border border-slate-100 shadow-sm">
          <AlertTriangle className={`shrink-0 mt-1 ${isCritical ? 'text-red-600' : 'text-orange-600'}`} size={18} />
          <p className="text-[13px] text-slate-700 leading-relaxed font-medium">
            {data.reasoning}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalysisModule;