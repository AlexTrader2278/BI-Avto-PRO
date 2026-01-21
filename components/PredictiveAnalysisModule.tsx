
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
    <div className={`relative overflow-hidden border p-8 rounded-[32px] shadow-2xl transition-all duration-500 ${
      isCritical ? 'border-red-500/30 bg-red-500/5' : 'border-orange-500/20 bg-orange-500/5'
    }`}>
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-current opacity-5 blur-[80px]" />
      
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${isCritical ? 'bg-red-500/20 text-red-500' : 'bg-orange-500/20 text-orange-500'}`}>
            <Activity size={24} />
          </div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-300">
            Предиктивный риск
          </h2>
        </div>
        <div className={`text-4xl font-black font-mono tracking-tighter ${isCritical ? 'text-red-500' : 'text-orange-500'}`}>
          {prob}%
        </div>
      </div>

      <div className="space-y-6">
        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${isCritical ? 'bg-red-500' : 'bg-orange-500'}`}
            style={{ width: `${prob}%` }}
          />
        </div>
        
        <div className="flex gap-4 items-start bg-black/20 p-5 rounded-2xl border border-white/5">
          <AlertTriangle className={`shrink-0 mt-1 ${isCritical ? 'text-red-500' : 'text-orange-500'}`} size={18} />
          <p className="text-[13px] text-slate-400 leading-relaxed font-medium">
            {data.reasoning}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalysisModule;
