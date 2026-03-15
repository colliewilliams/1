import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, User, Sparkles, RefreshCw } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  "What did I eat today and how does it compare to my goals?",
  "I just had a grilled chicken salad for lunch, can you log it?",
  "Suggest a high-protein breakfast under 400 calories",
  "I did 30 minutes of running, please log it",
  "Analyze my nutrition and give me personalized advice",
  "What should I eat for dinner to hit my protein goal?",
  "Give me a meal plan for tomorrow based on my goals",
];

function ToolBadge({ tool }) {
  const labels = {
    search_food: { icon: '🔍', text: 'Searching food database...' },
    log_food: { icon: '✅', text: 'Logging food...' },
    log_exercise: { icon: '💪', text: 'Logging exercise...' },
    get_daily_summary: { icon: '📊', text: 'Getting daily summary...' },
    get_goals: { icon: '🎯', text: 'Checking your goals...' },
  };
  const info = labels[tool] || { icon: '⚙️', text: `Using ${tool}...` };
  return (
    <div className="inline-flex items-center gap-2 text-xs bg-slate-800 text-emerald-400 rounded-lg px-3 py-1.5 border border-slate-700 my-1">
      <span>{info.icon}</span>
      <span>{info.text}</span>
      <Loader2 size={10} className="animate-spin" />
    </div>
  );
}

function DataUpdatedBadge({ kind }) {
  return (
    <div className="inline-flex items-center gap-2 text-xs bg-emerald-900/30 text-emerald-400 rounded-lg px-3 py-1.5 border border-emerald-800/50 my-1">
      ✓ {kind === 'food' ? 'Food logged to diary' : 'Exercise logged'}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 msg-animate ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isUser ? 'bg-emerald-500' : 'bg-slate-700'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} className="text-emerald-400" />}
      </div>
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {msg.toolsUsed?.map((tool, i) => <ToolBadge key={i} tool={tool} />)}
        {msg.dataUpdated?.map((kind, i) => <DataUpdatedBadge key={i} kind={kind} />)}
        {msg.content && (
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-emerald-500 text-white rounded-tr-sm'
              : 'bg-slate-800 text-slate-100 rounded-tl-sm'
          }`}>
            {msg.content}
          </div>
        )}
        {msg.isStreaming && !msg.content && (
          <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIChat({ onDataUpdate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = async (content) => {
    if (!content.trim() || isLoading) return;
    setError(null);

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const assistantMsg = { role: 'assistant', content: '', isStreaming: true, toolsUsed: [], dataUpdated: [] };
    setMessages(prev => [...prev, assistantMsg]);
    const assistantIndex = newMessages.length;

    const updateAssistant = (updater) => {
      setMessages(prev => {
        const next = [...prev];
        next[assistantIndex] = { ...next[assistantIndex], ...updater(next[assistantIndex]) };
        return next;
      });
    };

    try {
      const today = new Date().toISOString().split('T')[0];
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, date: today }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'text') {
              updateAssistant(msg => ({ content: (msg.content || '') + event.content }));
            } else if (event.type === 'tool_use') {
              updateAssistant(msg => ({ toolsUsed: [...(msg.toolsUsed || []), event.tool] }));
            } else if (event.type === 'data_updated') {
              updateAssistant(msg => ({ dataUpdated: [...(msg.dataUpdated || []), event.kind] }));
              onDataUpdate?.();
            } else if (event.type === 'done') {
              updateAssistant(() => ({ isStreaming: false }));
            } else if (event.type === 'error') {
              setError(event.message);
              updateAssistant(() => ({ isStreaming: false, content: '⚠️ Error: ' + event.message }));
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setError(err.message);
      updateAssistant(() => ({ isStreaming: false, content: '⚠️ Failed to connect. Please check that the backend is running and your API key is set.' }));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <Sparkles size={16} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">AI Coach</h2>
            <p className="text-xs text-slate-500">Powered by Claude Opus</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="btn-ghost flex items-center gap-1">
            <RefreshCw size={12} /> New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <Bot size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Hi! I'm your NutriAI Coach</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                I can log your meals, track workouts, analyze your nutrition, and give personalized advice — just like having a personal dietitian in your pocket.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider text-center">Try asking me...</p>
              <div className="grid gap-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-sm text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-emerald-500/30 rounded-xl px-4 py-2.5 transition-all"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {error && (
              <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl p-3">
                ⚠️ {error}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about nutrition, log food, log exercise..."
            className="input flex-1 resize-none min-h-[44px] max-h-32 py-3"
            rows={1}
            disabled={isLoading}
            style={{ height: Math.min(128, Math.max(44, input.split('\n').length * 22 + 22)) + 'px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
