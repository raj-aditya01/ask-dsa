import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import python from 'highlight.js/lib/languages/python';
hljs.registerLanguage('python', python);

const TOPICS = [
  'All Topics',
  'Two Pointers',
  'Dynamic Programming',
  'Graphs',
  'Binary Search',
  'Trees',
  'Sliding Window',
  'Linked List',
];

const EXAMPLES = [
  { label: 'Floyd Cycle', query: 'How to detect a cycle in a linked list?' },
  { label: 'Two Sum', query: 'How to solve the Two Sum problem?' },
  { label: 'LRU Cache', query: 'Explain the LRU Cache design and implementation' },
  { label: 'Stock III', query: 'Explain Best Time to Buy and Sell Stock III' },
];

export default function App() {
  const [query, setQuery] = useState('How to detect a cycle in a linked list?');
  const [activeTopic, setActiveTopic] = useState('All Topics');
  const [health, setHealth] = useState({ online: false, model: 'Connecting...' });
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [routing, setRouting] = useState({
    strategy: 'specific_qa',
    topic: 'Ready',
    cleaned_query: '-',
  });
  const [solutionMarkdown, setSolutionMarkdown] = useState('');
  const [solutionTitle, setSolutionTitle] = useState('DSA Solution Workspace');
  const [timeComplexity, setTimeComplexity] = useState('O(N)');
  const [spaceComplexity, setSpaceComplexity] = useState('O(1)');
  const [statusText, setStatusText] = useState('Ready');
  const [metrics, setMetrics] = useState({
    retrieval_ms: '--',
    generation_ms: '--',
    total_ms: '--',
  });
  const [copyFeedback, setCopyFeedback] = useState(false);

  const inputRef = useRef(null);
  const markdownRef = useRef(null);

  // 1. Initial Health Check
  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/v1/health');
        if (res.ok) {
          const data = await res.json();
          setHealth({
            online: true,
            model: data.model.includes('/') ? data.model.split('/')[1] : data.model,
          });
        } else {
          setHealth({ online: false, model: 'Offline' });
        }
      } catch {
        setHealth({ online: false, model: 'Offline' });
      }
    }
    checkHealth();
  }, []);

  // 2. Keyboard shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 3. Highlight code blocks inside solution markdown
  useEffect(() => {
    if (markdownRef.current) {
      markdownRef.current.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  }, [solutionMarkdown]);

  // Extract complexity from streamed markdown
  function extractComplexities(text) {
    const timeMatch = text.match(/Time Complexity[:\s*]+([^\n.,]+)/i);
    const spaceMatch = text.match(/Space Complexity[:\s*]+([^\n.,]+)/i);

    if (timeMatch && timeMatch[1]) {
      setTimeComplexity(timeMatch[1].replace(/[*_`]/g, '').trim());
    }
    if (spaceMatch && spaceMatch[1]) {
      setSpaceComplexity(spaceMatch[1].replace(/[*_`]/g, '').trim());
    }
  }

  // 4. Solve & Stream
  async function handleSolveAndStream(targetQuery) {
    const q = (targetQuery || query).trim();
    if (!q) return;

    setIsStreaming(true);
    setIsLoading(true);
    setStatusText('Searching & Streaming Solution...');
    setSolutionMarkdown('');
    setRetrievalResults([]);
    setSelectedProblem(null);

    const startTime = performance.now();
    let accumulated = '';

    try {
      const res = await fetch('/api/v1/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          top_k: 5,
          include_sources: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      setIsLoading(false);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'metadata') {
              setRouting({
                strategy: event.routing.strategy || 'specific_qa',
                topic: event.routing.topic || 'General DSA',
                cleaned_query: event.routing.cleaned_query || q,
              });
              setRetrievalResults(event.sources || []);
              setMetrics((prev) => ({
                ...prev,
                retrieval_ms: `${event.retrieval_ms || 0}ms`,
              }));
            } else if (event.type === 'token') {
              accumulated += event.content;
              setSolutionMarkdown(accumulated);
              extractComplexities(accumulated);
            } else if (event.type === 'done') {
              const totalElapsed = (performance.now() - startTime).toFixed(0);
              const totalVal = event.total_ms || totalElapsed;
              const retVal = parseFloat(metrics.retrieval_ms) || 0;
              const genVal = Math.max(0, totalVal - retVal);

              setMetrics({
                retrieval_ms: `${retVal}ms`,
                generation_ms: `${genVal.toFixed(0)}ms`,
                total_ms: `${totalVal}ms`,
              });
            } else if (event.type === 'error') {
              setSolutionMarkdown((prev) => `${prev}\n\n**Error:** ${event.message}`);
            }
          } catch (err) {
            console.error('SSE JSON error:', err);
          }
        }
      }

      setSolutionTitle(q);
    } catch (err) {
      setSolutionMarkdown(`**Error connecting to ASK-DSA Engine:** ${err.message}`);
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
      setStatusText('Ready');
    }
  }

  // 5. Search Only (Pure retrieval)
  async function handleSearchOnly() {
    const q = query.trim();
    if (!q) return;

    setIsLoading(true);
    setStatusText('Retrieving candidates...');
    try {
      const res = await fetch('/api/v1/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, top_k: 5 }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      setRouting({
        strategy: data.routing.strategy,
        topic: data.routing.topic || 'General DSA',
        cleaned_query: data.routing.cleaned_query,
      });
      setRetrievalResults(data.results || []);
      setMetrics((prev) => ({
        ...prev,
        retrieval_ms: `${data.metrics.retrieval_ms}ms`,
      }));
      setSolutionTitle(`Retrieved ${data.total_results} Problems for: ${q}`);
      setSolutionMarkdown(
        `Pure retrieval complete in **${data.metrics.retrieval_ms}ms** without LLM token generation.\n\nSelect any problem card on the left or click **Solve & Stream** to generate an optimal step-by-step solution.`
      );
    } catch (err) {
      alert(`Retrieval error: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStatusText('Ready');
    }
  }

  // Copy code helper
  const handleCopyCode = () => {
    if (markdownRef.current) {
      const code = markdownRef.current.querySelector('pre code')?.innerText || solutionMarkdown;
      navigator.clipboard.writeText(code);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  return (
    <div className="bg-[#F8F9FF] font-sans text-[#0B1C30] min-h-screen flex flex-col antialiased">
      {/* ==================== HEADER ==================== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="h-14 w-full px-4 sm:px-6 flex items-center justify-between gap-4 max-w-7xl mx-auto">
          {/* Brand & Status */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <span className="material-symbols-outlined text-[18px]">terminal</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-base font-bold tracking-tight text-slate-900">
                  ASK-DSA <span className="text-[10px] text-indigo-600 font-mono font-semibold">MERN</span>
                </span>
                <span className="text-[11px] text-slate-500">DSA Tutor & Semantic Search</span>
              </div>
            </div>

            {/* Health Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-mono">
              <span className="relative flex h-2 w-2">
                {health.online && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    health.online ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </span>
              <span>{health.online ? `API Online • ${health.model}` : 'API Offline'}</span>
            </div>
          </div>

          {/* Quick Examples */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium mr-1">Examples:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => {
                  setQuery(ex.query);
                  handleSolveAndStream(ex.query);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono border border-slate-200 transition-colors"
              >
                {ex.label}
              </button>
            ))}
          </div>

          {/* Navigation & Links */}
          <div className="flex items-center gap-2">
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">api</span>
              <span>API Docs</span>
            </a>
            <div className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs font-mono">
              <span className="text-[10px]">Ctrl+K</span>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="w-full pt-16 flex-1 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col gap-6 pt-4">
          {/* Operational Tag & Stats */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                ASK-DSA MERN PRODUCTION ENGINE
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-mono text-slate-600">Express • MongoDB • React • Groq</span>
            </div>

            <div className="hidden sm:flex items-center gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-1 text-slate-600">
                <span className="material-symbols-outlined text-[14px] text-indigo-600">layers</span>
                BM25 Title-Boosted 3.5x
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="material-symbols-outlined text-[14px]">bolt</span>
                Cross-Encoder Reranker Active
              </span>
            </div>
          </div>

          {/* Omnisearch Bar */}
          <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-200 focus-within:shadow-md focus-within:border-indigo-400">
            <div className="flex items-center h-14 sm:h-16 px-4 gap-3">
              <span className="material-symbols-outlined text-slate-400 text-[22px] flex-shrink-0">
                search
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSolveAndStream();
                  }
                }}
                className="flex-1 bg-transparent text-base sm:text-lg text-slate-900 placeholder:text-slate-400 outline-none border-none font-sans"
                placeholder="Ask any algorithm question or describe a problem concept..."
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="hidden sm:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Clear input"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
                <button
                  onClick={handleSearchOnly}
                  disabled={isLoading || isStreaming}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                  title="Only run retrieval & reranking without LLM"
                >
                  <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                  <span>Search Only</span>
                </button>
                <button
                  onClick={() => handleSolveAndStream()}
                  disabled={isLoading || isStreaming}
                  className="flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  <span>Solve & Stream</span>
                </button>
              </div>
            </div>
          </div>

          {/* Topic Filter Chips */}
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 select-none text-xs">
            <div className="flex items-center gap-1.5">
              {TOPICS.map((topic) => {
                const isSelected = activeTopic === topic;
                return (
                  <button
                    key={topic}
                    onClick={() => {
                      setActiveTopic(topic);
                      if (topic !== 'All Topics' && !query.toLowerCase().includes(topic.toLowerCase())) {
                        setQuery((prev) => `${prev.trim()} (${topic})`);
                      }
                    }}
                    className={`px-3 py-1 rounded-full transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-medium shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
            <div className="hidden sm:flex items-center gap-1 text-slate-400 flex-shrink-0">
              <span className="material-symbols-outlined text-[14px]">filter_list</span>
              <span>
                Showing: <strong className="text-slate-700">{activeTopic}</strong>
              </span>
            </div>
          </div>

          {/* Split-Pane Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: Retrieved Problem Context */}
            <section className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">layers</span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Retrieved Context
                  </h2>
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-slate-700 text-xs font-mono font-medium">
                    {retrievalResults.length}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Routing: {routing.strategy}
                </span>
              </div>

              {/* Strategy & Query Routing Diagnostics Card */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col gap-2 shadow-sm text-xs">
                <div className="flex items-center justify-between text-slate-600 font-mono">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-indigo-600">
                      psychology
                    </span>
                    <span>
                      Strategy: <strong className="text-slate-900">{routing.strategy}</strong>
                    </span>
                  </span>
                  <span className="text-emerald-700 font-semibold">{routing.topic}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 font-mono text-[11px] pt-1 border-t border-slate-100">
                  <span>
                    Cleaned Query: <strong className="text-slate-700">{routing.cleaned_query}</strong>
                  </span>
                  <span className="text-slate-400">{metrics.retrieval_ms}</span>
                </div>
              </div>

              {/* Problem Cards List */}
              <div className="flex flex-col gap-3">
                {retrievalResults.length === 0 ? (
                  <div className="p-8 rounded-xl bg-white border border-dashed border-slate-300 text-center flex flex-col items-center gap-2 text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-[32px] text-slate-300">
                      manage_search
                    </span>
                    <p>Type a question above or click an example to retrieve matching LeetCode problems.</p>
                  </div>
                ) : (
                  retrievalResults.map((item, index) => {
                    const isSelected = selectedProblem?.problem_id === item.problem_id || index === 0;
                    const diff = item.difficulty || 'Medium';
                    const diffColor =
                      diff.toLowerCase() === 'easy'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : diff.toLowerCase() === 'hard'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200';

                    const scoreValue =
                      item.rerank_score !== undefined
                        ? `Rerank: ${item.rerank_score.toFixed(2)}`
                        : `Score: ${(item.score || 0).toFixed(4)}`;

                    const topics = Array.isArray(item.topics) ? item.topics : [];

                    return (
                      <article
                        key={item.problem_id + index}
                        onClick={() => {
                          setSelectedProblem(item);
                          setSolutionTitle(`#${item.problem_id} - ${item.title}`);
                        }}
                        className={`p-4 rounded-xl bg-white border ${
                          isSelected
                            ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        } transition-all cursor-pointer flex flex-col gap-2.5`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-600">
                              #{item.problem_id}
                            </span>
                            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${diffColor}`}
                          >
                            {diff}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {item.text ? item.text.replace(/Problem ID:.*?\n/g, '').slice(0, 160) + '...' : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {topics.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-400">
                          <span className="text-indigo-600 font-medium">{scoreValue}</span>
                          <span>Click to view details</span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>

            {/* RIGHT: Grounded Solution Workspace */}
            <section className="lg:col-span-7 flex flex-col gap-4">
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col gap-5 min-h-[520px]">
                {/* Solution Header & Tags */}
                <div className="flex flex-col gap-3 pb-4 border-b border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-mono font-semibold uppercase tracking-wider border border-indigo-200">
                      Grounded Solution & Explanation
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 font-mono text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Groq LLM
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[11px] font-medium border border-emerald-200">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        Context Verified
                      </span>
                    </div>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{solutionTitle}</h1>

                  {/* Complexity Summary Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">timer</span>
                      <span className="font-semibold">Time: {timeComplexity}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                      <span className="material-symbols-outlined text-[16px] text-indigo-600">memory</span>
                      <span className="font-semibold">Space: {spaceComplexity}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      <span>Grounding: LeetCode Dataset</span>
                    </div>
                    {solutionMarkdown && (
                      <button
                        onClick={handleCopyCode}
                        className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {copyFeedback ? 'check' : 'content_copy'}
                        </span>
                        <span>{copyFeedback ? 'Copied!' : 'Copy Code'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Solution Markdown Body */}
                <div
                  ref={markdownRef}
                  className={`prose-dsa font-sans text-sm text-slate-700 leading-relaxed min-h-[260px] ${
                    isStreaming ? 'typing-cursor' : ''
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: solutionMarkdown
                      ? marked.parse(solutionMarkdown)
                      : '<p class="text-slate-400 italic">Ready. Enter your algorithmic inquiry to generate an optimal step-by-step solution, complexity analysis, and idiomatic Python implementation.</p>',
                  }}
                />

                {/* Footer Generation Status */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-500">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isStreaming ? 'bg-indigo-600 animate-ping' : 'bg-emerald-500'
                      }`}
                    ></span>
                    <span>{statusText}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      Latency: <strong className="text-slate-700">{metrics.total_ms}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* ==================== STICKY TELEMETRY FOOTER ==================== */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-slate-900 font-semibold">
              <span className="material-symbols-outlined text-[14px] text-amber-500">speed</span>
              <span>Pipeline Latency:</span>
            </span>
            <span>
              Retrieval: <strong className="text-slate-800">{metrics.retrieval_ms}</strong>
            </span>
            <span>•</span>
            <span>
              LLM Generation: <strong className="text-slate-800">{metrics.generation_ms}</strong>
            </span>
            <span>•</span>
            <span>
              Total: <strong className="text-indigo-600">{metrics.total_ms}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${health.online ? 'bg-emerald-500' : 'bg-rose-500'}`}
            ></span>
            <span>API:</span>
            <a href="/docs" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              localhost:8000/api/v1
            </a>
            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[10px]">
              v1.0.0 (MERN)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
