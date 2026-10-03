/* =====================================================================
 * 墨语 - 个人博客核心逻辑
 * 功能：Markdown 解析 / 全文检索 / 标签分类 /
 *       目录导航 / 代码复制 / 收藏 / 阅读进度 / 主题切换 / 统计
 * ===================================================================== */

(function () {
  'use strict';

  /* ---------------- 状态 ---------------- */
  const state = {
    posts: [],            // {id, title, category, tags, content, raw, date}
    currentId: null,
    view: 'all',          // all | fav | unread
    activeTag: null,
    searchQuery: '',
    read: new Set(),      // 已读 id
    fav: new Set(),       // 收藏 id
    githubNetworkError: false,  // GitHub API 网络请求是否失败
  };

  const STORAGE_KEY = 'codevault_state_v1';

  /* ---------------- Twikoo 评论系统配置 ---------------- */
  // 数据存储于 EdgeOne Makers 部署的 Twikoo 服务端
  // 访客无需注册即可评论，支持匿名 / 邮箱通知
  const TWIKOO = {
    envId: 'https://twikoo.2020-6.cn',   // EdgeOne Makers 绑定的自定义域名
    lang: 'zh-CN',
  };

  /* ---------------- GitHub Issues 文章源配置 ---------------- */
  // 文章以 GitHub Issue 的形式存储：发 Issue = 发布文章
  // 带 ARTICLE_LABEL 标签的 Issue 会被当作文章展示
  const GITHUB = {
    repo: 'wuzhidemao/cccccc',
    articleLabel: '文章',     // 标记为文章的 Issue 标签
    cacheKey: 'moyu_issues_cache',
    cacheTTL: 5 * 60 * 1000,  // 本地缓存 5 分钟，减少 API 调用
  };

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
      // 同步 Twikoo 评论主题
      syncTwikooTheme();
      saveState();
    });
  }

  /* ---------------- Markdown 元信息解析 ---------------- */
  function parseMeta(md) {
    const meta = { title: '', category: '', tags: [] };
    const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (m) {
      const block = m[1];
      const titleM = block.match(/^title:\s*(.+)$/m);
      const catM = block.match(/^category:\s*(.+)$/m) || block.match(/^difficulty:\s*(.+)$/m);
      // 支持两种 tags 格式：内联 [a, b] 和 YAML 列表
      const tagsInline = block.match(/^tags:\s*\[([^\]]*)\]/m);
      const tagsList = block.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
      if (titleM) meta.title = titleM[1].trim().replace(/^["']|["']$/g, '');
      if (catM) meta.category = catM[1].trim();
      if (tagsInline) {
        meta.tags = tagsInline[1].split(',').map(s => s.trim()).filter(Boolean);
      } else if (tagsList) {
        meta.tags = tagsList[1].split('\n').map(s => s.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
      }
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

  /* ---------------- 渲染文章列表 ---------------- */
  function getFiltered() {
    let list = state.posts.slice();
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
    return 'cat-badge';
  }
  function diffLabel(d) {
    return d || '未分类';
  }

  function renderList() {
    const listEl = $('#solutionList');
    const list = getFiltered();
    listEl.innerHTML = '';

    if (list.length === 0) {
      listEl.style.display = 'none';
      const hint = $('#emptyHint');
      hint.style.display = 'flex';
      // 根据是否为网络错误显示不同提示
      if (state.githubNetworkError) {
        hint.querySelector('p').textContent = '加载失败';
        hint.querySelector('.hint-sub').textContent = '请检查 GitHub 网络连接是否正常';
      } else {
        hint.querySelector('p').textContent = '暂无文章';
        hint.querySelector('.hint-sub').textContent = '文章由站长维护，敬请期待';
      }
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
        onclick: () => openPost(s.id),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(s.id); } }
      });

      const titleRow = el('div', { class: 'si-title' });
      if (state.fav.has(s.id)) titleRow.appendChild(el('span', { class: 'si-fav' }, '★'));
      titleRow.appendChild(document.createTextNode(s.title || '无标题'));
      item.appendChild(titleRow);

      const meta = el('div', { class: 'si-meta' });
      const diff = el('span', { class: 'si-diff ' + diffClass(s.category) }, diffLabel(s.category));
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
    $('#totalCount').textContent = state.posts.length;
    $('#readCount').textContent = state.read.size;
    $('#favCount').textContent = state.fav.size;
  }

  /* ---------------- 标签云 ---------------- */
  function renderTagCloud() {
    const cloud = $('#tagCloud');
    const tagCount = {};
    state.posts.forEach(s => s.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
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

  /* ---------------- Twikoo 评论加载 ---------------- */
  let twikooScriptLoaded = false;
  function loadTwikoo(container, path) {
    if (!TWIKOO.envId) {
      container.innerHTML = '<div class="comments-hint">💬 评论系统暂未配置，请在 <code>js/app.js</code> 的 <code>TWIKOO</code> 对象中填入 <code>envId</code>（前往 <a href="https://twikoo.js.org/" target="_blank" rel="noopener">twikoo.js.org</a> 查看部署方式）。</div>';
      return;
    }
    container.innerHTML = '';
    container.id = 'twikoo-container';
    const doInit = () => {
      if (typeof twikoo === 'undefined') return;
      twikoo.init({
        envId: TWIKOO.envId,
        el: container,
        lang: TWIKOO.lang,
        path: path,            // 每篇文章的唯一标识，确保评论独立
        theme: getTwikooTheme(),
      });
    };
    if (twikooScriptLoaded) {
      doInit();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.36/dist/twikoo.all.min.js';
      script.async = true;
      script.onload = () => { twikooScriptLoaded = true; doInit(); };
      document.head.appendChild(script);
    }
  }

  function getTwikooTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  // 切换主题时重新初始化 Twikoo 以同步主题
  function syncTwikooTheme() {
    const container = document.getElementById('twikoo-container');
    if (!container || typeof twikoo === 'undefined') return;
    loadTwikoo(container, getPostIdFromUrl() || state.currentId);
  }

  /* ---------------- 打开文章 ---------------- */
  function openPost(id, pushState) {
    const s = state.posts.find(x => x.id === id);
    if (!s) return;
    state.currentId = id;
    state.read.add(id);
    saveState();

    // 移动端：选中文章后自动收起侧边栏
    if (typeof state._closeSidebar === 'function') state._closeSidebar();

    // 更新地址栏，每篇文章拥有独立 URL（?post=文章ID）
    if (pushState !== false) {
      const url = new URL(window.location);
      url.searchParams.set('post', id);
      window.history.pushState({ post: id }, '', url.toString());
    }

    const docArea = $('#docArea');
    docArea.innerHTML = '';

    // 头部
    const header = el('div', { class: 'doc-header' });
    header.appendChild(el('h1', {}, s.title || '无标题'));

    const meta = el('div', { class: 'doc-meta' });
    if (s.date) meta.appendChild(el('span', { class: 'chip doc-date' }, '📅 ' + formatDate(s.date)));
    meta.appendChild(el('span', { class: 'chip si-diff ' + diffClass(s.category) }, diffLabel(s.category)));
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
        saveState(); renderList(); openPost(id);
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

    // 评论区
    const commentsSection = el('section', { class: 'comments' });
    commentsSection.appendChild(el('h3', { class: 'comments-title' }, '💬 评论'));
    const twikooContainer = el('div', { class: 'twikoo' });
    commentsSection.appendChild(twikooContainer);
    docArea.appendChild(commentsSection);
    loadTwikoo(twikooContainer, s.id);

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
    if (state.currentId === id) openPost(id);
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
    if (window.SAMPLE_POSTS) {
      addPosts(window.SAMPLE_POSTS.map(s => ({ id: s.id, raw: s.content })));
      toast('已加载 ' + window.SAMPLE_POSTS.length + ' 篇示例文章');
    }
  }

  function addPosts(items) {
    items.forEach(item => {
      const meta = parseMeta(item.raw);
      const id = item.id || uid();
      // 避免重复：同 id 或同标题覆盖
      const existIdx = state.posts.findIndex(s => s.id === id || s.title === meta.title);
      const sol = {
        id,
        title: meta.title || item.title || '无标题',
        category: meta.category,
        tags: meta.tags,
        content: meta.content,
        raw: item.raw,
        date: item.date || null,  // ISO 字符串，发布日期
      };
      if (existIdx >= 0) state.posts[existIdx] = sol;
      else state.posts.push(sol);
    });
    renderList();
    renderTagCloud();
    // 恢复上次阅读的文章，若不存在则打开第一篇（不更新 URL，由 init 统一处理）
    if (state.posts.length) {
      const currentExists = state.posts.some(s => s.id === state.currentId);
      openPost(currentExists ? state.currentId : state.posts[0].id, false);
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
        if (state.currentId) openPost(state.currentId);
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

  /* ---------------- 移动端侧边栏切换 ---------------- */
  function setupSidebar() {
    const sidebar = $('.sidebar');
    const backdrop = $('#sidebarBackdrop');
    const toggleBtn = $('#sidebarToggle');

    function openSidebar() {
      sidebar.classList.add('open');
      backdrop.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      document.body.style.overflow = '';
    }

    toggleBtn.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    });
    backdrop.addEventListener('click', closeSidebar);

    // 窗口变大到桌面端时，自动关闭侧边栏并清除遮罩
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeSidebar();
    });

    // 暴露给 openPost 使用
    state._closeSidebar = closeSidebar;
  }

  /* ---------------- 从静态目录加载文章（适合部署到静态托管） ---------------- */
  // 在站点根目录放置 posts/manifest.json，内容为 { "files": ["a.md", "b.md"] }
  // 站点会自动 fetch 这些 .md 文件并加载，访问者无需手动上传
  async function loadFromManifest() {
    try {
      const resp = await fetch('posts/manifest.json', { cache: 'no-store' });
      if (!resp.ok) return false;
      const manifest = await resp.json();
      if (!manifest || !Array.isArray(manifest.files)) return false;

      const items = [];
      for (const file of manifest.files) {
        try {
          const r = await fetch('posts/' + file, { cache: 'no-store' });
          if (r.ok) {
            const text = await r.text();
            items.push({ id: file.replace(/\.md$/i, ''), raw: text });
          }
        } catch (e) {}
      }
      if (items.length) {
        addPosts(items);
        toast('已从 posts/ 目录加载 ' + items.length + ' 篇文章');
        return true;
      }
    } catch (e) {}
    return false;
  }

  /* ---------------- 从 GitHub Issues 加载文章 ---------------- */
  // 文章以 Issue 形式存储：带「文章」标签的 Issue 即为一篇文章
  // Issue 标题 = 文章标题，Issue 正文 = Markdown 内容（支持 frontmatter）
  // 数据缓存在 localStorage 中，减少 API 调用（GitHub 未授权 60 次/小时）
  function getIssuesCache() {
    try {
      const raw = localStorage.getItem(GITHUB.cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.timestamp < GITHUB.cacheTTL) return cached.data;
      return null;
    } catch (e) { return null; }
  }
  function setIssuesCache(data) {
    try {
      localStorage.setItem(GITHUB.cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (e) {}
  }

  async function loadFromGitHubIssues() {
    // 1. 优先读本地缓存
    const cached = getIssuesCache();
    if (cached) {
      addPosts(cached);
      // 缓存命中仍静默刷新一次（不阻塞）
      refreshIssuesSilently();
      return true;
    }
    return await fetchGitHubIssues();
  }

  async function fetchGitHubIssues() {
    state.githubNetworkError = false;
    try {
      const url = 'https://api.github.com/repos/' + GITHUB.repo + '/issues?state=open&per_page=100';
      const resp = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
      if (!resp.ok) return false;
      const issues = await resp.json();
      if (!Array.isArray(issues)) return false;

      const items = issues
        .filter(issue => !issue.pull_request)  // 排除 PR
        .filter(issue => issue.labels && issue.labels.some(l => l.name === GITHUB.articleLabel))
        .map(issue => ({
          id: 'gh-' + issue.number,
          title: issue.title,
          raw: issue.body || '',
          date: issue.created_at,
        }));

      if (items.length) {
        setIssuesCache(items);
        addPosts(items);
        toast('已从 GitHub Issues 加载 ' + items.length + ' 篇文章');
        return true;
      }
    } catch (e) {
      state.githubNetworkError = true;  // 网络连接失败
    }
    return false;
  }

  // 静默刷新缓存（不更新界面，仅更新 localStorage，下次加载生效）
  function refreshIssuesSilently() {
    fetchGitHubIssues().catch(() => {});
  }

  /* ---------------- 日期格式化 ---------------- */
  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    } catch (e) { return ''; }
  }

  /* ---------------- 初始化 ---------------- */
  function getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('post');
  }

  async function init() {
    loadState();
    setupMarked();
    initTheme();
    setupSearch();
    setupTabs();
    setupSidebar();
    setupScrollSpy();

    // 文章从本地 posts/ 目录加载（manifest.json 清单）
    // 若 posts/ 加载失败，则回退到内置示例
    const loaded = await loadFromManifest();
    if (!loaded && state.posts.length === 0) {
      loadFromSamples();
    }

    // 若 URL 中指定了文章（?post=xxx），则打开该文章
    const urlPostId = getPostIdFromUrl();
    if (urlPostId && state.posts.some(s => s.id === urlPostId)) {
      openPost(urlPostId, false);  // URL 已正确，不重复 pushState
    } else if (state.currentId) {
      // URL 未指定文章，为当前文章设置 URL
      openPost(state.currentId, true);
    }

    // 监听浏览器前进/后退，同步打开对应文章
    window.addEventListener('popstate', () => {
      const id = getPostIdFromUrl();
      if (id && state.posts.some(s => s.id === id)) {
        openPost(id, false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
