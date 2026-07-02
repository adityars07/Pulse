'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Activity,
  DollarSign,
  Clock,
  TrendingUp,
  AlertCircle,
  Loader2,
  Cpu,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

interface SpendHistory {
  date: string;
  spend: number;
}

export default function ObservabilityPage() {
  const [latency, setLatency] = useState<LatencyPercentiles | null>(null);
  const [history, setHistory] = useState<SpendHistory[]>([]);
  const [totalSpend, setTotalSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError('');
        
        const latencyData = await apiRequest('/observability/latency-percentiles');
        const historyData = await apiRequest('/observability/spend-history?days=30');
        const statsData = await apiRequest('/observability/stats');

        setLatency(latencyData);
        setHistory(historyData);
        setTotalSpend(statsData.totalSpend || 0);
      } catch (err: any) {
        setError(err.message || 'Failed to load observability charts.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm">Loading charts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-sm">Error Loading Observability</h3>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const latencyBarData = [
    { name: 'p50 (Median)', value: latency?.p50 ? latency.p50 / 1000 : 0, color: '#6366f1' },
    { name: 'p95 (Slowest 5%)', value: latency?.p95 ? latency.p95 / 1000 : 0, color: '#a855f7' },
    { name: 'p99 (Slowest 1%)', value: latency?.p99 ? latency.p99 / 1000 : 0, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Observability</h1>
          <p className="text-sm text-slate-400 mt-1">Detailed tracing spend, response speeds, and system latency</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#7C3AED] font-semibold uppercase tracking-wider bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>Active tracing</span>
        </div>
      </div>

      {/* Latency percentiles display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {latencyBarData.map((item, i) => (
          <div
            key={item.name}
            className="p-6 rounded-2xl bg-white border border-slate-200 backdrop-blur-sm"
          >
            <span className="text-xs text-slate-500 font-semibold">{item.name}</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold text-slate-800">{item.value.toFixed(2)}</span>
              <span className="text-xs text-slate-500 font-medium">seconds</span>
            </div>
            <div className="w-full h-1 bg-slate-200 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (item.value / 10) * 100)}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Observability charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost aggregation area chart */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm text-slate-800">Daily Cost Aggregation</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Total spend is ${(totalSpend || 0).toFixed(4)}</p>
            </div>
            <div className="flex items-center gap-0.5 text-xs text-emerald-400 font-bold uppercase tracking-wider">
              <DollarSign className="w-4 h-4" />
              <span>Billing</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpendObs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val.toFixed(3)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    formatter={(value: any) => [`$${parseFloat(value).toFixed(5)}`, 'Spend']}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSpendObs)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl bg-[#f4f2ff]/20">
                No billing history recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Latency percentiles distribution chart */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm text-slate-800">Latency Percentiles Distribution</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Response latency in seconds</p>
            </div>
            <div className="flex items-center gap-0.5 text-xs text-[#7C3AED] font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
              <span>Response times</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {latency?.p50 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyBarData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}s`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    formatter={(value: any) => [`${parseFloat(value).toFixed(2)}s`, 'Latency']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {latencyBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl bg-[#f4f2ff]/20">
                No latency records logged yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
