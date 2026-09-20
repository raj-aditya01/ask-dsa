/**
 * ASK-DSA Web Dashboard Client
 * Production-ready SSE streaming and hybrid retrieval integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const queryInput = document.getElementById('query-input');
  const searchBtn = document.getElementById('search-btn');
  const retrieveOnlyBtn = document.getElementById('retrieve-only-btn');
  const clearBtn = document.getElementById('clear-btn');
  const cardsContainer = document.getElementById('cards-container');
  const solutionBody = document.getElementById('solution-body');
  const solutionTitle = document.getElementById('solution-title');
  const streamIndicator = document.getElementById('stream-indicator');
  const genStatusText = document.getElementById('gen-status-text');
  const genLatency = document.getElementById('gen-latency');
  const resultsCount = document.getElementById('results-count');
  const routingStrategy = document.getElementById('routing-strategy');
  const diagStrategy = document.getElementById('diag-strategy');
  const diagTopic = document.getElementById('diag-topic');
  const diagQuery = document.getElementById('diag-query');
  const diagTime = document.getElementById('diag-time');
  const statRetrieval = document.getElementById('stat-retrieval');
  const statGen = document.getElementById('stat-gen');
  const statTotal = document.getElementById('stat-total');
  const timeBadge = document.getElementById('time-badge');
  const spaceBadge = document.getElementById('space-badge');

  let activeTopicFilter = '';

  // 1. Initial Health Check
  async function checkHealth() {
    const healthText = document.getElementById('health-text');
    const healthDot = document.getElementById('health-dot');
    const healthPing = document.getElementById('health-ping');

    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        const data = await res.json();
        healthText.textContent = `API Online • ${data.model.split('/')[1] || data.model}`;
        healthDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
        healthPing.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
      } else {
        throw new Error('Unhealthy');
      }
    } catch (e) {
      healthText.textContent = 'API Offline';
      healthDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-rose-500';
      healthPing.className = 'hidden';
    }
  }
  checkHealth();

  // 2. Keyboard Hotkey (Cmd+K / Ctrl+K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      queryInput.focus();
      queryInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === queryInput) {
      queryInput.value = '';
    }
  });

  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSolveAndStream();
    }
  });

  clearBtn.addEventListener('click', () => {
    queryInput.value = '';
    queryInput.focus();
  });

  // 3. Quick Example Buttons
  document.querySelectorAll('.example-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      queryInput.value = btn.getAttribute('data-query');
      executeSolveAndStream();
    });
  });

  // 4. Topic Filter Chips
  document.querySelectorAll('.topic-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.topic-chip').forEach((c) => {
        c.className = 'topic-chip px-3 py-1 rounded-full bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors';
      });
      chip.className = 'topic-chip px-3 py-1 rounded-full bg-indigo-600 text-white font-medium shadow-sm transition-colors';

      activeTopicFilter = chip.getAttribute('data-topic');
      document.getElementById('current-filter-name').textContent = activeTopicFilter || 'All';

      if (activeTopicFilter && !queryInput.value.toLowerCase().includes(activeTopicFilter.toLowerCase())) {
        queryInput.value = `${queryInput.value.trim()} (${activeTopicFilter})`;
      }
    });
  });

  // 5. Render Problem Cards
  function renderProblemCards(sources) {
    if (!sources || sources.length === 0) {
      cardsContainer.innerHTML = `
        <div class="p-6 rounded-xl bg-white border border-slate-200 text-center text-slate-400 text-xs">
          No matching problems found.
        </div>`;
      resultsCount.textContent = '0';
      return;
    }

    resultsCount.textContent = sources.length;
    cardsContainer.innerHTML = '';

    sources.forEach((item, index) => {
      const isTop = index === 0;
      const difficulty = item.difficulty || 'Medium';

      let diffColor = 'bg-amber-50 text-amber-700 border-amber-200';
      if (difficulty.toLowerCase() === 'easy') {
        diffColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      } else if (difficulty.toLowerCase() === 'hard') {
        diffColor = 'bg-rose-50 text-rose-700 border-rose-200';
      }

      const scoreValue = item.rerank_score !== null && item.rerank_score !== undefined
        ? `Rerank: ${item.rerank_score.toFixed(2)}`
        : `Score: ${(item.score || 0).toFixed(4)}`;

      const topics = Array.isArray(item.topics) ? item.topics : [];
      const topicsHtml = topics.slice(0, 3).map((t) =>
        `<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-mono">${t}</span>`
      ).join('');

      const card = document.createElement('article');
      card.className = `p-4 rounded-xl bg-white border ${
        isTop ? 'border-indigo-400 ring-1 ring-indigo-400/20 shadow-sm' : 'border-slate-200 hover:border-slate-300'
      } transition-all cursor-pointer flex flex-col gap-2.5`;

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs font-bold text-indigo-600">#${item.problem_id}</span>
            <h3 class="text-sm font-semibold text-slate-900">${item.title}</h3>
          </div>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${diffColor}">
            ${difficulty}
          </span>
        </div>
        <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          ${item.text ? item.text.replace(/Problem ID:.*?\n/g, '').slice(0, 160) + '...' : ''}
        </p>
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          ${topicsHtml}
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-400">
          <span class="text-indigo-600 font-medium">${scoreValue}</span>
          <span>Click to view details</span>
        </div>
      `;

      card.addEventListener('click', () => {
        solutionTitle.textContent = `#${item.problem_id} - ${item.title}`;
        document.querySelectorAll('#cards-container article').forEach((c) => {
          c.classList.remove('border-indigo-500', 'ring-2', 'ring-indigo-100');
        });
        card.classList.add('border-indigo-500', 'ring-2', 'ring-indigo-100');
      });

      cardsContainer.appendChild(card);
    });
  }

  // 6. Post-process Code Blocks with Copy Button & Syntax Highlighting
  function enhanceCodeBlocks() {
    document.querySelectorAll('#solution-body pre code').forEach((block) => {
      hljs.highlightElement(block);

      const pre = block.parentElement;
      if (pre.parentElement && pre.parentElement.classList.contains('code-wrapper')) {
        return;
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'code-wrapper rounded-xl overflow-hidden bg-[#0B1220] my-4 shadow-sm border border-slate-800';

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between px-3.5 py-1.5 bg-[#070D18] border-b border-slate-800 text-xs font-mono text-slate-400';
      header.innerHTML = `
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500/70"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500/70"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/70"></span>
          <span class="ml-2 text-slate-300">solution.py</span>
        </div>
        <button class="copy-btn flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
          <span class="material-symbols-outlined text-[13px]">content_copy</span>
          <span>Copy</span>
        </button>
      `;

      const copyBtn = header.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(block.innerText);
        copyBtn.innerHTML = `<span class="material-symbols-outlined text-[13px] text-emerald-400">check</span><span class="text-emerald-400">Copied!</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `<span class="material-symbols-outlined text-[13px]">content_copy</span><span>Copy</span>`;
        }, 2000);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
      pre.className = 'p-4 text-xs font-mono overflow-x-auto text-slate-200';
    });
  }

  // 7. Parse Complexities from Streamed Markdown
  function extractComplexities(text) {
    const timeMatch = text.match(/Time Complexity[:\s*]+([^\n.,]+)/i);
    const spaceMatch = text.match(/Space Complexity[:\s*]+([^\n.,]+)/i);

    if (timeMatch && timeMatch[1]) {
      timeBadge.textContent = `Time: ${timeMatch[1].replace(/[*_`]/g, '').trim()}`;
    }
    if (spaceMatch && spaceMatch[1]) {
      spaceBadge.textContent = `Space: ${spaceMatch[1].replace(/[*_`]/g, '').trim()}`;
    }
  }

  // 8. Execute Solution with Real-Time SSE Streaming
  async function executeSolveAndStream() {
    const query = queryInput.value.trim();
    if (!query) return;

    searchBtn.disabled = true;
    searchBtn.classList.add('opacity-70', 'cursor-not-allowed');
    streamIndicator.className = 'w-2 h-2 rounded-full bg-indigo-600 animate-ping';
    genStatusText.textContent = 'Searching & Streaming Solution...';
    solutionBody.innerHTML = '';
    solutionBody.classList.add('typing-cursor');

    cardsContainer.innerHTML = `
      <div class="p-6 rounded-xl bg-white border border-slate-200 flex flex-col items-center gap-2 text-slate-400 text-xs">
        <span class="material-symbols-outlined text-[24px] animate-spin text-indigo-600">progress_activity</span>
        <p>Executing hybrid search (Dense + BM25 + Cross-Encoder)...</p>
      </div>`;

    const startTimestamp = performance.now();
    let accumulatedMarkdown = '';

    try {
      const response = await fetch('/api/v1/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          top_k: 5,
          include_sources: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // keep partial chunk

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'metadata') {
              // Populate routing diagnostics & candidate problem cards
              diagStrategy.textContent = event.routing.strategy || 'specific_qa';
              diagTopic.textContent = event.routing.topic || 'General DSA';
              diagQuery.textContent = event.routing.cleaned_query || query;
              routingStrategy.textContent = `Routing: ${event.routing.strategy}`;
              statRetrieval.textContent = `${event.retrieval_ms || 0}ms`;

              renderProblemCards(event.sources || []);
            } else if (event.type === 'token') {
              accumulatedMarkdown += event.content;
              solutionBody.innerHTML = marked.parse(accumulatedMarkdown);
              extractComplexities(accumulatedMarkdown);
            } else if (event.type === 'done') {
              const totalElapsed = (performance.now() - startTimestamp).toFixed(0);
              statTotal.textContent = `${event.total_ms || totalElapsed}ms`;
              genLatency.textContent = `${event.total_ms || totalElapsed}ms`;
              const genOnly = Math.max(0, (event.total_ms || totalElapsed) - (parseFloat(statRetrieval.textContent) || 0));
              statGen.textContent = `${genOnly.toFixed(0)}ms`;
            } else if (event.type === 'error') {
              solutionBody.innerHTML += `<div class="p-3 my-2 rounded bg-rose-50 text-rose-700 text-xs border border-rose-200">${event.message}</div>`;
            }
          } catch (err) {
            console.error('Error parsing SSE event:', err, jsonStr);
          }
        }
      }

      // Final styling & highlighting pass
      enhanceCodeBlocks();

      // Set clean title
      const headingMatch = accumulatedMarkdown.match(/^(?:#|\*\*Problem Identification\*\*|# LeetCode)[\s\S]*?(?:LeetCode\s*#?\d+|"[^"]+"|[\w\s]+)/i);
      if (headingMatch) {
        solutionTitle.textContent = query;
      }
    } catch (e) {
      solutionBody.innerHTML = `
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <strong>Error connecting to ASK-DSA Engine:</strong> ${e.message}
        </div>`;
    } finally {
      searchBtn.disabled = false;
      searchBtn.classList.remove('opacity-70', 'cursor-not-allowed');
      solutionBody.classList.remove('typing-cursor');
      streamIndicator.className = 'w-2 h-2 rounded-full bg-emerald-500';
      genStatusText.textContent = 'Ready';
    }
  }

  // 9. Pure Retrieval Only
  async function executeRetrieveOnly() {
    const query = queryInput.value.trim();
    if (!query) return;

    retrieveOnlyBtn.disabled = true;
    cardsContainer.innerHTML = `
      <div class="p-6 rounded-xl bg-white border border-slate-200 flex flex-col items-center gap-2 text-slate-400 text-xs">
        <span class="material-symbols-outlined text-[24px] animate-spin text-indigo-600">progress_activity</span>
        <p>Retrieving & Reranking candidates...</p>
      </div>`;

    try {
      const res = await fetch('/api/v1/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query, top_k: 5 }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      diagStrategy.textContent = data.routing.strategy;
      diagTopic.textContent = data.routing.topic || 'General DSA';
      diagQuery.textContent = data.routing.cleaned_query;
      statRetrieval.textContent = `${data.metrics.retrieval_ms}ms`;
      diagTime.textContent = `${data.metrics.retrieval_ms}ms`;

      renderProblemCards(data.results);
      solutionTitle.textContent = `Retrieved ${data.total_results} Problems for: ${query}`;
      solutionBody.innerHTML = `
        <p class="text-slate-600 text-sm">
          Pure retrieval complete in <strong>${data.metrics.retrieval_ms}ms</strong> without LLM token generation.
          Select any problem card on the left or click <strong>Solve & Stream</strong> to generate an optimal solution.
        </p>`;
    } catch (e) {
      cardsContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          Retrieval failed: ${e.message}
        </div>`;
    } finally {
      retrieveOnlyBtn.disabled = false;
    }
  }

  searchBtn.addEventListener('click', executeSolveAndStream);
  retrieveOnlyBtn.addEventListener('click', executeRetrieveOnly);
});
