'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import {
  MessageSquare,
  DollarSign,
  Clock,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Loader2,
  AlertCircle,
  Database,
  Code,
} from 'lucide-react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface Stats {
  totalConversations: number;
  totalMessages: number;
  totalSpend: number;
  avgLatencyMs: number;
}

interface SpendHistory {
  date: string;
  spend: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<SpendHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const statsData = await apiRequest('/observability/stats');
        const historyData = await apiRequest('/observability/spend-history?days=7');
        setStats(statsData);
        setHistory(historyData);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard statistics.');
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
          <p className="text-sm">Loading stats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-sm">Error Loading Stats</h3>
          <p className="text-xs text-red-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Conversations',
      value: stats?.totalConversations ?? 0,
      icon: MessageSquare,
      iconColor: 'text-blue-500',
    },
    {
      name: 'Total Messages',
      value: stats?.totalMessages ?? 0,
      icon: Layers,
      iconColor: 'text-emerald-500',
    },
    {
      name: 'Model Spend',
      value: `$${(stats?.totalSpend ?? 0).toFixed(4)}`,
      icon: DollarSign,
      iconColor: 'text-[#7C3AED]',
    },
    {
      name: 'Avg Response Latency',
      value: stats?.avgLatencyMs ? `${(stats.avgLatencyMs / 1000).toFixed(2)}s` : '0.0s',
      icon: Clock,
      iconColor: 'text-amber-500',
    },
  ];

  return (
    <div className="space-y-8 text-left">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time statistics and usage spend history</p>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.name}
              className="p-6 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between shadow-sm"
            >
              <div>
                <span className="text-xs text-slate-500 font-medium">{card.name}</span>
                <span className="block text-2xl font-bold text-slate-800 mt-1.5">{card.value}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-sm text-slate-800">Spend History</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Token spend over the last 7 days</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#7C3AED] font-bold uppercase tracking-wider bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Cost Trend</span>
            </div>
          </div>

          <div className="h-64 w-full">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val.toFixed(3)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ color: '#64748b', fontSize: '11px', fontWeight: 600 }}
                    itemStyle={{ color: '#1e293b', fontSize: '12px' }}
                    formatter={(value: any) => [`$${parseFloat(value).toFixed(5)}`, 'Spend']}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="#7C3AED"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSpend)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                No billing history recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions Guide */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-800 mb-4">Quick Setup Guide</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 shrink-0 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">Load Knowledge Base</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Upload PDFs, docs, or crawl urls to ingest knowledge</p>
                  <Link
                    href="/sources"
                    className="inline-flex items-center gap-1 text-[11px] text-[#7C3AED] hover:text-[#6D28D9] font-bold mt-1.5"
                  >
                    <span>Upload sources</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 shrink-0 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">Embed Chat Widget</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Add the standalone script to your web page body</p>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-800 font-bold mt-1.5"
                  >
                    <span>Get embed script</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Widget status</span>
            <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
