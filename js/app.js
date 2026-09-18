/* =====================================================================
 * CodeVault - C++ 题解站 核心逻辑
 * 功能：文件夹扫描 / Markdown 解析 / 全文检索 / 标签筛选 /
 *       目录导航 / 代码复制 / 收藏 / 阅读进度 / 主题切换 / 统计
 * ===================================================================== */

(function () {
  'use strict';

  /* ---------------- 状态 ---------------- */
  const state = {
    solutions: [],        // {id, title, difficulty, tags, content, raw}
    currentId: null,
    view: 'all',          // all | fav | unread
    activeTag: null,
    searchQuery: '',
    read: new Set(),      // 已读 id
    fav: new Set(),       // 收藏 id
  };

  const STORAGE_KEY = 'codevault_state_v1';

  /* ---------------- 工具函数 ---------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  };

  function uid() { return 'id_' + Math.random().toString(36).slice(2, 10); }

  function toast(msg, dur = 2000) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), dur);
  }

  /* ---------------- 持久化 ---------------- */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        read: [...state.read],
        fav: [...state.fav],
        theme: document.documentElement.dataset.theme,
        currentId: state.currentId,
      }));
    } catch (e) {}
  }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.read = new Set(s.read || []);
      state.fav = new Set(s.fav || []);
      if (s.theme) document.documentElement.dataset.theme = s.theme;
      state.currentId = s.currentId || null;
    } catch (e) {}
  }

  /* ---------------- 主题切换 ---------------- */
  function initTheme() {
    $('#themeToggle').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme;
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      // 切换 highlight.js 主题
      const hl = $('#hljs-theme');
      if (hl) hl.href = next === 'dark'
        ? 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css'
        : 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-light.min.css';
      saveState();
    });
  }

  /* ---------------- Markdown 元信息解析 ---------------- */
  function parseMeta(md) {
    const meta = { title: '', difficulty: '', tags: [] };
    const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (m) {
      const block = m[1];
      const titleM = block.match(/^title:\s*(.+)$/m);
      const diffM = block.match(/^difficulty:\s*(.+)$/m);
      const tagsM = block.match(/^tags:\s*\[([^\]]*)\]/m);
      if (titleM) meta.title = titleM[1].trim().replace(/^["']|["']$/g, '');
      if (diffM) meta.difficulty = diffM[1].trim();
      if (tagsM) meta.tags = tagsM[1].split(',').map(s => s.trim()).filter(Boolean);
      meta.content = md.slice(m[0].length);
    } else {
      meta.content = md;
      // 尝试从第一个 # 标题提取
      const h1 = md.match(/^#\s+(.+)$/m);
      if (h1) meta.title = h1[1].trim();
    }
    return meta;
  }

  /* ---------------- Markdown 渲染 ---------------- */
  function setupMarked() {
    if (typeof marked === 'undefined') return;
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function (code, lang) {
        if (typeof hljs !== 'undefined') {
          try { return hljs.highlight(code, { language: lang || 'plaintext' }).value; }
          catch (e) { return code; }
        }
        return code;
      }
    });
  }

  function renderMarkdown(md) {
    if (typeof marked !== 'undefined') {
      return marked.parse(md);
    }
    // 极简 fallback：仅保证可读
    return '<pre style="white-space:pre-wrap">' + escapeHtml(md) + '</pre>';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ---------------- 后处理：行号 / 复制按钮 / 目录 ---------------- */
  function postProcessDoc(docEl) {
    // 代码块：行号 + 复制按钮
    docEl.querySelectorAll('pre').forEach((pre, idx) => {
      const code = pre.querySelector('code');
      const lang = code ? (code.className.match(/language-(\w+)/) || [])[1] : '';
      const text = code ? code.textContent : pre.textContent;
      const lines = text.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();

      // 行号
      const ln = el('div', { class: 'line-numbers' });
      ln.innerHTML = lines.map((_, i) => i + 1).join('<br>');
      pre.insertBefore(ln, pre.firstChild);

      // 工具栏
      const bar = el('div', { class: 'code-toolbar' });
      if (lang) {
        bar.appendChild(el('span', { class: 'code-btn', style: 'cursor:default' }, lang));
      }
      const copyBtn = el('button', { class: 'code-btn', onclick: (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = '复制'; copyBtn.classList.remove('copied'); }, 1500);
        }).catch(() => toast('复制失败，请手动选择'));
      }}, '复制');
      bar.appendChild(copyBtn);
      pre.appendChild(bar);

      // 高亮
      if (typeof hljs !== 'undefined' && code) {
        try { hljs.highlightElement(code); } catch (e) {}
      }
    });

    // 标题加 id（用于目录锚点）
    let idx = 0;
    docEl.querySelectorAll('h1, h2, h3, h4').forEach(h => {
      if (!h.id) {
        h.id = 'heading-' + (idx++);
      }
    });
  }

  /* ---------------- 目录生成 ---------------- */
  function buildTOC(docEl) {
    const tocList = $('#tocList');
    tocList.innerHTML = '';
    const headings = docEl.querySelectorAll('h2, h3');
    headings.forEach(h => {
      const level = h.tagName === 'H2' ? 2 : 3;
      const li = el('li');
      const a = el('a', {
        class: 'toc-link' + (level === 3 ? ' toc-level-3' : ''),
        href: '#' + h.id,
        onclick: (e) => {
          e.preventDefault();
          h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, h.textContent);
      li.appendChild(a);
      tocList.appendChild(li);
    });
  }

  /* ---------------- 滚动联动目录高亮 ---------------- */
  function setupScrollSpy() {
    const reader = $('.reader');
    reader.addEventListener('scroll', () => {
      const headings = $$('.doc h2, .doc h3');
      let activeId = null;
      for (const h of headings) {
        const rect = h.getBoundingClientRect();
        if (rect.top <= 120) activeId = h.id;
      }
      $$('.toc-link').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
      });
    });
  }

  /* ---------------- 渲染题解列表 ---------------- */
  function getFiltered() {
    let list = state.solutions.slice();
    if (state.view === 'fav') list = list.filter(s => state.fav.has(s.id));
    else if (state.view === 'unread') list = list.filter(s => !state.read.has(s.id));
    if (state.activeTag) list = list.filter(s => s.tags.includes(state.activeTag));
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.raw.toLowerCase().includes(q)
      );
    }
    return list;
  }

  function diffClass(d) {
    d = (d || '').toLowerCase();
    if (d === 'easy' || d === '简单') return 'diff-easy';
    if (d === 'hard' || d === '困难') return 'diff-hard';
    return 'diff-medium';
  }
  function diffLabel(d) {
    const map = { easy: '简单', medium: '中等', hard: '困难', '简单': '简单', '中等': '中等', '困难': '困难' };
    return map[(d || '').toLowerCase()] || d || '中等';
  }

  function renderList() {
    const listEl = $('#solutionList');
    const list = getFiltered();
    listEl.innerHTML = '';

    if (list.length === 0) {
      listEl.style.display = 'none';
      $('#emptyHint').style.display = 'flex';
    } else {
      listEl.style.display = '';
      $('#emptyHint').style.display = 'none';
    }

    list.forEach((s, i) => {
      const item = el('div', {
        class: 'solution-item' + (s.id === state.currentId ? ' active' : ''),
        style: 'animation-delay:' + (i * 0.03) + 's',
        role: 'button',
        tabindex: '0',
        onclick: () => openSolution(s.id),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSolution(s.id); } }
      });

      const titleRow = el('div', { class: 'si-title' });
      if (state.fav.has(s.id)) titleRow.appendChild(el('span', { class: 'si-fav' }, '★'));
      titleRow.appendChild(document.createTextNode(s.title || '无标题'));
      item.appendChild(titleRow);

      const meta = el('div', { class: 'si-meta' });
      const diff = el('span', { class: 'si-diff ' + diffClass(s.difficulty) }, diffLabel(s.difficulty));
      const readIcon = state.read.has(s.id) ? '✓ 已读' : '○ 未读';
      meta.appendChild(diff);
      meta.appendChild(el('span', {}, readIcon));
      item.appendChild(meta);

      if (s.tags && s.tags.length) {
        const tags = el('div', { class: 'si-tags' });
        s.tags.slice(0, 3).forEach(t => tags.appendChild(el('span', { class: 'si-tag' }, t)));
        item.appendChild(tags);
      }

      listEl.appendChild(item);
    });

    updateStats();
  }

  /* ---------------- 统计 ---------------- */
  function updateStats() {
    $('#totalCount').textContent = state.solutions.length;
    $('#readCount').textContent = state.read.size;
    $('#favCount').textContent = state.fav.size;
  }

  /* ---------------- 标签云 ---------------- */
  function renderTagCloud() {
    const cloud = $('#tagCloud');
    const tagCount = {};
    state.solutions.forEach(s => s.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);

    cloud.innerHTML = '';
    const all = el('span', {
      class: 'tag-chip' + (!state.activeTag ? ' active' : ''),
      onclick: () => { state.activeTag = null; renderList(); renderTagCloud(); }
    }, '全部');
    cloud.appendChild(all);
    tags.forEach(([t, n]) => {
      const chip = el('span', {
        class: 'tag-chip' + (state.activeTag === t ? ' active' : ''),
        onclick: () => { state.activeTag = state.activeTag === t ? null : t; renderList(); renderTagCloud(); }
      }, t + ' · ' + n);
      cloud.appendChild(chip);
    });
  }

  /* ---------------- 打开题解 ---------------- */
  function openSolution(id) {
    const s = state.solutions.find(x => x.id === id);
    if (!s) return;
    state.currentId = id;
    state.read.add(id);
    saveState();

    const docArea = $('#docArea');
    docArea.innerHTML = '';

    // 头部
    const header = el('div', { class: 'doc-header' });
    header.appendChild(el('h1', {}, s.title || '无标题'));

    const meta = el('div', { class: 'doc-meta' });
    meta.appendChild(el('span', { class: 'chip si-diff ' + diffClass(s.difficulty) }, diffLabel(s.difficulty)));
    s.tags.forEach(t => meta.appendChild(el('span', { class: 'chip' }, '# ' + t)));
    header.appendChild(meta);

    const actions = el('div', { class: 'doc-actions' });
    const favBtn = el('button', {
      class: 'btn ' + (state.fav.has(id) ? 'btn-primary' : 'btn-ghost'),
      onclick: () => toggleFav(id)
    }, state.fav.has(id) ? '★ 已收藏' : '☆ 收藏');
    const markBtn = el('button', {
      class: 'btn btn-ghost',
      onclick: () => {
        if (state.read.has(id)) state.read.delete(id); else state.read.add(id);
        saveState(); renderList(); openSolution(id);
      }
    }, state.read.has(id) ? '标记为未读' : '标记为已读');
    actions.appendChild(favBtn);
    actions.appendChild(markBtn);
    header.appendChild(actions);
    docArea.appendChild(header);

    // 正文
    const body = el('div', { class: 'md', html: renderMarkdown(s.content) });
    docArea.appendChild(body);

    postProcessDoc(docArea);
    buildTOC(docArea);

    // 搜索高亮
    if (state.searchQuery) highlightSearch(body);

    $('.reader').scrollTop = 0;
    renderList();
  }

  function toggleFav(id) {
    if (state.fav.has(id)) state.fav.delete(id);
    else state.fav.add(id);
    saveState();
    renderList();
    renderTagCloud();
    if (state.currentId === id) openSolution(id);
  }

  /* ---------------- 搜索高亮 ---------------- */
  function highlightSearch(root) {
    const q = state.searchQuery.trim();
    if (!q) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const reg = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    nodes.forEach(n => {
      if (!n.nodeValue.match(reg)) return;
      const span = document.createElement('span');
      span.innerHTML = n.nodeValue.replace(reg, '<mark>$1</mark>');
      n.parentNode.replaceChild(span, n);
    });
  }

  /* ---------------- 文件夹扫描 ---------------- */
  function loadFromSamples() {
    if (window.SAMPLE_SOLUTIONS) {
      addSolutions(window.SAMPLE_SOLUTIONS.map(s => ({ id: s.id, raw: s.content })));
      toast('已加载 ' + window.SAMPLE_SOLUTIONS.length + ' 篇内置题解');
    }
  }

  function addSolutions(items) {
    items.forEach(item => {
      const meta = parseMeta(item.raw);
      const id = item.id || uid();
      // 避免重复：同标题覆盖
      const existIdx = state.solutions.findIndex(s => s.id === id || s.title === meta.title);
      const sol = {
        id,
        title: meta.title || '无标题',
        difficulty: meta.difficulty,
        tags: meta.tags,
        content: meta.content,
        raw: item.raw,
      };
      if (existIdx >= 0) state.solutions[existIdx] = sol;
      else state.solutions.push(sol);
    });
    renderList();
    renderTagCloud();
    // 恢复上次阅读的题解，若不存在则打开第一篇
    if (state.solutions.length) {
      const currentExists = state.solutions.some(s => s.id === state.currentId);
      openSolution(currentExists ? state.currentId : state.solutions[0].id);
    }
  }

  /* ---------------- 搜索 ---------------- */
  function setupSearch() {
    const input = $('#searchInput');
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.searchQuery = input.value.trim();
        renderList();
        if (state.currentId) openSolution(state.currentId);
      }, 200);
    });
    // 快捷键 /
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === 'Escape') { input.value = ''; state.searchQuery = ''; renderList(); }
    });
  }

  /* ---------------- 视图切换 ---------------- */
  function setupTabs() {
    $$('#viewTabs .tab').forEach(t => {
      t.addEventListener('click', () => {
        $$('#viewTabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        state.view = t.dataset.view;
        renderList();
      });
    });
  }

  /* ---------------- 从静态目录加载题解（适合部署到静态托管） ---------------- */
  // 在站点根目录放置 solutions/manifest.json，内容为 { "files": ["a.md", "b.md"] }
  // 站点会自动 fetch 这些 .md 文件并加载，访问者无需手动上传
  async function loadFromManifest() {
    try {
      const resp = await fetch('solutions/manifest.json', { cache: 'no-store' });
      if (!resp.ok) return false;
      const manifest = await resp.json();
      if (!manifest || !Array.isArray(manifest.files)) return false;

      const items = [];
      for (const file of manifest.files) {
        try {
          const r = await fetch('solutions/' + file, { cache: 'no-store' });
          if (r.ok) {
            const text = await r.text();
            items.push({ id: file.replace(/\.md$/i, ''), raw: text });
          }
        } catch (e) {}
      }
      if (items.length) {
        addSolutions(items);
        toast('已从 solutions/ 目录加载 ' + items.length + ' 篇题解');
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---------------- 初始化 ---------------- */
  async function init() {
    loadState();
    setupMarked();
    initTheme();
    setupSearch();
    setupTabs();
    setupScrollSpy();

    // 题解固定从 solutions/ 目录加载（访客只能查看，不能上传）
    // 若 solutions/ 目录加载失败，则回退到内置示例
    const loaded = await loadFromManifest();
    if (!loaded && state.solutions.length === 0) {
      loadFromSamples();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
