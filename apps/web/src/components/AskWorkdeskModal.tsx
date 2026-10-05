import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AskWorkdeskResponseDto } from '@workdesk/shared';
import {
  Sparkles,
  Send,
  X,
  Bot,
  ExternalLink,
  Info,
} from 'lucide-react';

interface AskWorkdeskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AskWorkdeskModal: React.FC<AskWorkdeskModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    { query: string; response: AskWorkdeskResponseDto; timestamp: string }[]
  >([]);

  if (!isOpen) return null;

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/v1/ask-workdesk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: q }),
      });

      if (res.ok) {
        const data: AskWorkdeskResponseDto = await res.json();
        setHistory((prev) => [
          ...prev,
          { query: q, response: data, timestamp: new Date().toLocaleTimeString() },
        ]);
        setQuery('');
      } else {
        const err = await res.json().catch(() => ({}));
        setHistory((prev) => [
          ...prev,
          {
            query: q,
            response: {
              answer: err.message || 'Unable to process query at this time.',
              citations: [],
              confidence: 0,
              isDeterministicFallback: true,
            },
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    } catch (err) {
      console.error('Ask WorkDesk error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    'What is our active sprint progress?',
    'What is blocking our project?',
    'Which tasks are overdue?',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Ask WorkDesk
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  READ-ONLY AI
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Grounded factual queries with verified ticket citations.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-slate-200 font-semibold text-sm">
                  What would you like to know about your work?
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Ask about ticket statuses, sprint progress, active blockers, or deadlines. All
                  responses are grounded strictly in your authorized workspace records.
                </p>
              </div>

              {/* Sample Queries */}
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                {sampleQueries.map((sq) => (
                  <button
                    key={sq}
                    onClick={() => {
                      setQuery(sq);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-colors"
                  >
                    "{sq}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((item, index) => (
              <div key={index} className="space-y-2">
                {/* User Query Bubble */}
                <div className="flex justify-end">
                  <div className="bg-indigo-600 text-white text-xs px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm">
                    {item.query}
                  </div>
                </div>

                {/* Assistant Answer Bubble */}
                <div className="flex justify-start">
                  <div className="bg-slate-950 border border-slate-800 text-slate-200 text-xs p-4 rounded-2xl rounded-tl-sm max-w-[90%] space-y-3">
                    <div className="whitespace-pre-line leading-relaxed">{item.response.answer}</div>

                    {/* Citations List */}
                    {item.response.citations.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Info className="w-3 h-3 text-indigo-400" />
                          Verified Citations ({item.response.citations.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.response.citations.map((c) => (
                            <button
                              key={c.ticketId}
                              onClick={() => {
                                onClose();
                                navigate(c.linkUrl);
                              }}
                              className="text-left p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between group transition-colors"
                            >
                              <div className="truncate">
                                <span className="font-mono font-bold text-indigo-400 mr-1.5 text-xs">
                                  {c.ticketId}
                                </span>
                                <span className="text-[11px] text-slate-300 truncate">
                                  {c.title}
                                </span>
                              </div>
                              <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-1" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></div>
              <span>Searching authorized WorkDesk records...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAsk} className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ask a factual question (e.g. status of DESK-1001, active blockers)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors shadow-md shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
