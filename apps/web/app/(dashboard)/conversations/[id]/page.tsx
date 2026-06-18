'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import {
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  ArrowLeft,
  Calendar,
  DollarSign,
  Cpu,
  Bookmark,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  citations: Array<{
    chunkId: string;
    sourceId: string;
    sourceName: string;
    content: string;
    relevanceScore: number;
  }>;
  confidence: number | null;
  tokenCost: number | null;
  latencyMs: number | null;
  createdAt: string;
}

interface Conversation {
  id: string;
  sessionId: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ESCALATED';
  visitorInfo: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ConversationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const convData = await apiRequest(`/conversations/${id}`);
      const msgData = await apiRequest(`/conversations/${id}/messages`);
      setConversation(convData);
      setMessages(msgData);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStatusChange = async (status: Conversation['status']) => {
    if (!conversation) return;
    
    setUpdatingStatus(true);
    try {
      const updated = await apiRequest(`/conversations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setConversation(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="space-y-4">
        <Link href="/conversations" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to conversations</span>
        </Link>
        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Error Loading Chat</h3>
            <p className="text-xs text-red-400 mt-1">{error || 'Conversation not found.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCost = messages.reduce((sum, msg) => sum + (msg.tokenCost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/conversations"
            className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Conversation Logs</h1>
            <p className="text-xs text-slate-500 mt-0.5">ID: {conversation.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {updatingStatus && <Loader2 className="w-4 h-4 text-slate-500 animate-spin mr-1" />}
          {['ACTIVE', 'RESOLVED', 'ESCALATED'].map((status) => (
            <button
              key={status}
              disabled={updatingStatus}
              onClick={() => handleStatusChange(status as Conversation['status'])}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold border tracking-wide uppercase transition-all ${
                conversation.status === status
                  ? status === 'RESOLVED'
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                    : status === 'ESCALATED'
                    ? 'bg-amber-500/15 border-amber-500/35 text-amber-400'
                    : 'bg-indigo-500/15 border-indigo-500/35 text-indigo-400'
                  : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Chat Log + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Chat History Column */}
        <div className="lg:col-span-2 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {messages.map((message) => {
            const isAssistant = message.role === 'ASSISTANT';
            return (
              <div
                key={message.id}
                className={`flex flex-col ${isAssistant ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble card */}
                <div
                  className={`max-w-[85%] p-4 rounded-2xl border ${
                    isAssistant
                      ? 'bg-slate-900/50 border-slate-800/80 text-slate-100 rounded-tr-none'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-slate-100 rounded-tl-none'
                  }`}
                >
                  {/* Speaker Label */}
                  <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isAssistant ? 'text-indigo-400' : 'text-slate-400'}`}>
                    {isAssistant ? 'AI Assistant' : 'User'}
                  </span>
                  
                  {/* Text Content */}
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>

                  {/* Assistant Stats (Confidence/Latency/Cost) */}
                  {isAssistant && (message.confidence !== null || message.latencyMs !== null || message.tokenCost !== null) && (
                    <div className="mt-4 pt-3 border-t border-slate-800/40 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-slate-500">
                      {message.confidence !== null && (
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-slate-600" />
                          <span>Confidence: <b>{Math.round(message.confidence * 100)}%</b></span>
                        </span>
                      )}
                      {message.latencyMs !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span>Latency: <b>{(message.latencyMs / 1000).toFixed(2)}s</b></span>
                        </span>
                      )}
                      {message.tokenCost !== null && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-slate-600" />
                          <span>Cost: <b>${message.tokenCost.toFixed(5)}</b></span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Citations block */}
                  {isAssistant && message.citations && message.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/40 space-y-2">
                      <span className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        <Bookmark className="w-3 h-3 text-slate-500" />
                        <span>Sources Referenced</span>
                      </span>
                      <div className="grid grid-cols-1 gap-2 mt-1">
                        {message.citations.map((cite, i) => (
                          <div key={cite.chunkId} className="p-2 bg-slate-950/60 border border-slate-850 rounded-lg text-[10px]">
                            <div className="flex justify-between items-center text-[9px] text-slate-500 font-semibold mb-1">
                              <span>Source: {cite.sourceName}</span>
                              <span className="text-indigo-400">Relevance: {Math.round(cite.relevanceScore * 100)}%</span>
                            </div>
                            <p className="text-slate-400 leading-normal line-clamp-2 italic">&quot;{cite.content}&quot;</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Timestamp */}
                <span className="text-[9px] text-slate-500 mt-1.5 mx-2 font-medium">
                  {new Date(message.createdAt).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })}
        </div>

        {/* Conversation Sidebar Info */}
        <div className="p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm space-y-6">
          <h3 className="font-semibold text-sm text-white">Conversation Meta</h3>

          <div className="space-y-4 divide-y divide-slate-800/60">
            {/* Meta values */}
            <div className="flex items-center justify-between py-2 first:pt-0 text-xs">
              <span className="text-slate-400">Total Tokens Cost</span>
              <span className="font-bold text-white flex items-center gap-0.5 text-indigo-400">
                <DollarSign className="w-3.5 h-3.5" />
                <span>${totalCost.toFixed(5)}</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-3 text-xs">
              <span className="text-slate-400">Visitor IP</span>
              <span className="font-semibold text-slate-200">{conversation.visitorInfo?.ip || 'Local IP'}</span>
            </div>

            <div className="flex flex-col gap-1.5 py-3 text-xs">
              <span className="text-slate-400">User Agent</span>
              <span className="font-medium text-slate-400 text-[10px] break-all leading-normal">
                {conversation.visitorInfo?.userAgent || 'Unknown System Details'}
              </span>
            </div>

            <div className="flex items-center justify-between py-3 text-xs">
              <span className="text-slate-400">Session Started</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {new Date(conversation.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
