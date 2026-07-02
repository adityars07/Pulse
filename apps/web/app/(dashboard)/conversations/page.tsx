'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Search,
  User,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface Conversation {
  id: string;
  sessionId: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ESCALATED';
  rating: number | null;
  visitorInfo: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadConversations = async () => {
    try {
      const data = await apiRequest('/conversations');
      setConversations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const getStatusIcon = (status: Conversation['status']) => {
    switch (status) {
      case 'RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'ESCALATED':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin" />;
    }
  };

  const getStatusBadgeClass = (status: Conversation['status']) => {
    switch (status) {
      case 'RESOLVED':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      case 'ESCALATED':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      default:
        return 'bg-purple-50 border-purple-100 text-[#7C3AED]';
    }
  };

  const parseBrowser = (userAgent?: string) => {
    if (!userAgent) return 'Unknown Client';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Web Browser';
  };

  const filteredConversations = conversations.filter((c) => {
    // 1. Search Query filter (matches ID or visitor user agent)
    const matchesSearch =
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.visitorInfo?.userAgent || '').toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Status filter
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Conversations</h1>
        <p className="text-sm text-slate-400 mt-1">Monitor user chats, visitor details, and handoff alerts</p>
      </div>

      {/* Filter Options */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-2xl backdrop-blur-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'ACTIVE', 'RESOLVED', 'ESCALATED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === status
                  ? 'bg-purple-50 border-indigo-500/35 text-[#7C3AED]'
                  : 'bg-[#f4f2ff] border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 bg-[#f4f2ff] border border-slate-200 focus:border-[#7C3AED]/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/10 text-slate-800 placeholder-slate-500 transition-all text-xs"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl backdrop-blur-sm">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-500 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
            <span>Loading chats...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-600 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl bg-[#f4f2ff]/20 flex flex-col items-center gap-2">
            <MessageSquare className="w-8 h-8 text-slate-600" />
            <span>No conversations match the selected filter.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="pb-3 pr-4">Visitor</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Rating</th>
                  <th className="pb-3 px-4">Started Date</th>
                  <th className="pb-3 pl-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredConversations.map((c) => (
                  <tr key={c.id} className="border-b border-slate-200/40 last:border-0 hover:bg-slate-100/10 group transition-all">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#f4f2ff]/80 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#7C3AED] transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-slate-800 block">Visitor #{c.id.substring(0, 6)}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-[180px]">
                            {parseBrowser(c.visitorInfo?.userAgent)} · {c.visitorInfo?.ip || 'Local'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${getStatusBadgeClass(c.status)}`}>
                        {getStatusIcon(c.status)}
                        <span>{c.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {c.rating === 5 ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>Good</span>
                        </span>
                      ) : c.rating === 1 ? (
                        <span className="flex items-center gap-1 text-red-400 font-semibold">
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>Bad</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-semibold">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-slate-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pl-4 text-right">
                      <Link
                        href={`/conversations/${c.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-semibold transition-all active:scale-95 text-[11px]"
                      >
                        <span>View Chat</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
