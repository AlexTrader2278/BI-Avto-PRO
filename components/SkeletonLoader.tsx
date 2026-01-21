
import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-48 bg-slate-800/50 rounded-xl border border-slate-700"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700"></div>
        <div className="h-64 bg-slate-800/50 rounded-xl border border-slate-700"></div>
      </div>
      <div className="h-32 bg-slate-800/50 rounded-xl border border-slate-700"></div>
    </div>
  );
};

export default SkeletonLoader;
