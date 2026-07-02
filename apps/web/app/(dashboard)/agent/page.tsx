'use client';

import { useState, useEffect } from 'react';
import { apiRequest, getToken } from '../../lib/api';
import AgentView from '../conversations/[id]/agent-view';

interface EscalatedConversation {
  id: string;
  sessionId: string;
  status: string;
  updatedAt: string;
  messageCount?: number;
}

/**
 * Agent Inbox — shows all ESCALATED conversations that need a human agent.
 * Clicking a conversation opens the live AgentView panel.
 */
export default function AgentInboxPage() {
  const [conversations, setConversations] = useState<EscalatedConversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEscalated = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiRequest('/conversations');
      const list = Array.isArray(data) ? data : (data.conversations ?? []);
      const escalated = list.filter((conv: any) => conv.status === 'ESCALATED');
      setConversations(escalated);
    } catch {
      // silently fail — not critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalated();
    // Poll every 15 seconds for new escalations
    const interval = setInterval(fetchEscalated, 15_000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = () => {
    setSelected(null);
    fetchEscalated();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar — escalated list */}
      <aside className="w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-slate-700">Agent Inbox</h1>
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-600 font-bold uppercase tracking-wider">
            {conversations.length} escalated
          </span>
        </div>

        {loading && (
          <div className="text-slate-500 text-sm">Loading conversations…</div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm gap-2">
            <span className="text-3xl">🎉</span>
            <p>No escalated conversations</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            id={`escalated-conv-${conv.id.slice(0, 8)}`}
            onClick={() => setSelected(conv.id)}
            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
              selected === conv.id
                ? 'border-[#7C3AED] bg-purple-50/50 shadow-sm'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-800 truncate">
                  Session: {conv.sessionId.slice(0, 12)}…
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Updated {new Date(conv.updatedAt).toLocaleTimeString()}
                </p>
              </div>
              <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 border border-red-200 text-red-600 tracking-wider">
                LIVE
              </span>
            </div>
          </button>
        ))}
      </aside>

      {/* Main panel — live agent view */}
      <main className="flex-1">
        {selected ? (
          <AgentView conversationId={selected} onResolve={handleResolve} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
            <span className="text-5xl">💬</span>
            <p className="text-base">Select a conversation to join</p>
            <p className="text-sm text-slate-600">
              Click any escalated conversation on the left to take over
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
