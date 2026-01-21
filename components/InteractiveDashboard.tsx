import React, { useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, BarChart, Bar, Brush
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { AnalysisResult } from '../types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a] border border-white/10 p-3 rounded-lg shadow-xl text-[12px]">
        <p className="text-slate-500 mb-1">{label}</p>
        <p className="font-bold text-blue-400">
          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const InteractiveDashboard: React.FC<{ analysis: AnalysisResult }> = ({ analysis }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  // Defensive checks to prevent crashing
  if (!analysis) return null;
  const costData = Array.isArray(analysis.costForecast) ? analysis.costForecast : [];
  const distData = Array.isArray(analysis.categoryDistribution) ? analysis.categoryDistribution : [];

  return (
    <div className="space-y-8">
      {costData.length > 0 && (
        <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-[24px] shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={16} className="text-blue-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Прогноз стоимости владения</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                <XAxis dataKey="mileage" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cost" stroke="#3b82f6" fill="#3b82f633" strokeWidth={3} />
                <Brush dataKey="mileage" height={30} stroke="#1e293b" fill="#0c0c0c" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {distData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-[24px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                >
                  {distData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-[24px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distData}>
                <XAxis dataKey="label" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {distData.map((_, index) => (
                    <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} opacity={activeIndex === index ? 1 : 0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveDashboard;