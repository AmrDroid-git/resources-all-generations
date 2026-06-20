
/*
  Main app script for the static resources website.
  - No framework and no build step.
  - UI text is translated from data/i18n.json.
  - Resource JSON files are auto-discovered from /data/ directory listing.
  - TXT downloads are generated in the browser and ignore the optional `color` field.
*/
(function () {
  'use strict';

  const FALLBACK_DEFAULTS = {
    language: 'fr',
    theme: 'light',
    style: 'classic',
    default_university: 'ensi'
  };

  const FALLBACK_STYLES = [
    { id: 'normal', label: 'Normal' },
    { id: 'classic', label: 'Classic' },
    { id: 'bold', label: 'Bold' },
    { id: 'hacking', label: 'Hacking' },
    { id: 'modern', label: 'Modern' },
    { id: 'academic', label: 'Academic' },
    { id: 'minimal', label: 'Minimal' },
    { id: 'glass', label: 'Glass' }
  ];

  const state = {
    lang: FALLBACK_DEFAULTS.language,
    theme: FALLBACK_DEFAULTS.theme,
    style: FALLBACK_DEFAULTS.style,
    i18n: {},
    config: {},
    manifest: [],
    cache: new Map(),
    currentResources: []
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const escapeHTML = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[char]));

  const getNested = (obj, path) => path.split('.').reduce((acc, key) => acc && acc[key], obj);
  const t = (path, fallback = '') => getNested(state.i18n[state.lang], path) ?? getNested(state.i18n.fr, path) ?? fallback;

  async function fetchJSON(path) {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Cannot load ${path}`);
    return response.json();
  }

  function getDefaults() {
    return { ...FALLBACK_DEFAULTS, ...(state.config.defaults || {}) };
  }

  function getThemeIds() {
    const themes = state.config.appearance?.themes;
    return (Array.isArray(themes) && themes.length ? themes : [{ id: 'light' }, { id: 'dark' }]).map((theme) => theme.id);
  }

  function getStylePresets() {
    const styles = state.config.appearance?.styles;
    return Array.isArray(styles) && styles.length ? styles : FALLBACK_STYLES;
  }

  function initializeSettings() {
    const defaults = getDefaults();

    const storedLang = localStorage.getItem('siteLang');
    const preferredLang = storedLang || defaults.language;
    state.lang = state.i18n[preferredLang] ? preferredLang : (state.i18n[defaults.language] ? defaults.language : 'fr');

    const storedTheme = localStorage.getItem('siteTheme');
    const preferredTheme = storedTheme || defaults.theme;
    state.theme = getThemeIds().includes(preferredTheme) ? preferredTheme : FALLBACK_DEFAULTS.theme;

    const storedStyle = localStorage.getItem('siteStyle');
    const preferredStyle = storedStyle || defaults.style;
    const styleIds = getStylePresets().map((style) => style.id);
    state.style = styleIds.includes(preferredStyle) ? preferredStyle : FALLBACK_DEFAULTS.style;
  }

  async function boot() {
    try {
      const [i18n, config] = await Promise.all([
        fetchJSON('/data/i18n.json'),
        fetchJSON('/data/config.json')
      ]);
      state.i18n = i18n;
      state.config = config;
      initializeSettings();
      state.manifest = await discoverResourceEntries();
      await hydrateResourceMetadata();

      applyLanguage();
      applyTheme();
      applyStyle();
      translateStaticShell();
      renderChrome();
      await routeInit(document.body.dataset.page || 'home');
    } catch (error) {
      console.error(error);
      document.body.innerHTML = `<main class="container"><section class="panel page-hero"><h1>Loading error</h1><p>${escapeHTML(error.message)}</p></section></main>`;
    }
  }

  function applyLanguage() {
    const langData = state.i18n[state.lang] || state.i18n.fr;
    document.documentElement.lang = state.lang;
    document.body.dir = langData.dir || 'ltr';
    document.title = langData.seoTitle || 'Resources';
    const metaDescription = $('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', langData.seoDescription || '');
    localStorage.setItem('siteLang', state.lang);
  }

  function applyTheme() {
    document.body.dataset.theme = state.theme;
    localStorage.setItem('siteTheme', state.theme);
  }

  function applyStyle() {
    document.body.dataset.style = state.style;
    localStorage.setItem('siteStyle', state.style);
  }

  function translateStaticShell() {
    const skipLink = $('.skip-link');
    if (skipLink) skipLink.textContent = t('common.skipContent', 'Skip to content');
  }

  function renderChrome() {
    renderHeader();
    renderFooter();
  }

  function renderHeader() {
    const header = $('#site-header');
    if (!header) return;
    const page = document.body.dataset.page || 'home';
    const navItems = [
      ['home', '/home/'],
      ['resources', '/resources/'],
      ['download', '/download/'],
      ['collaborate', '/collaborate/'],
      ['about', '/about/']
    ];
    const themeLabel = state.theme === 'dark' ? t('common.lightMode') : t('common.darkMode');
    const themeIcon = state.theme === 'dark' ? '☀️' : '🌙';
    const styleOptions = getStylePresets().map((style) =>
      `<option value="${escapeHTML(style.id)}" ${style.id === state.style ? 'selected' : ''}>${escapeHTML(style.label || style.id)}</option>`
    ).join('');

    header.innerHTML = `
      <header class="site-header">
        <div class="container nav-shell">
          <div class="last-update" aria-label="${escapeHTML(t('common.lastUpdate'))}">
            <span>🕒</span>
            <span>${escapeHTML(t('common.lastUpdate'))}: <strong>${escapeHTML(state.config.last_modification_date || '-')}</strong></span>
          </div>

          <a class="brand" href="/home/" aria-label="Resources home">
            <span class="brand-mark">R</span>
            <span class="brand-text"><span>${escapeHTML(t('brand', 'Resources'))}</span><small>El Mostahlek</small></span>
          </a>

          <div class="nav-right">
            <nav class="nav-links" id="navLinks" aria-label="Main navigation">
              ${navItems.map(([key, href]) => `<a class="nav-link ${page === key ? 'active' : ''}" href="${href}">${escapeHTML(t(`nav.${key}`))}</a>`).join('')}
            </nav>
            <select class="lang-select" id="langSelect" aria-label="Language">
              ${Object.entries(state.i18n).map(([code, data]) => `<option value="${code}" ${code === state.lang ? 'selected' : ''}>${escapeHTML(data.langName || code)}</option>`).join('')}
            </select>
            <select class="style-select" id="styleSelect" aria-label="${escapeHTML(t('common.style', 'Style'))}" title="${escapeHTML(t('common.style', 'Style'))}">${styleOptions}</select>
            <button class="icon-button" id="themeToggle" type="button" aria-label="${escapeHTML(themeLabel)}" title="${escapeHTML(themeLabel)}">${themeIcon}</button>
            <button class="icon-button menu-toggle" id="menuToggle" type="button" aria-expanded="false" aria-controls="navLinks">☰</button>
          </div>
        </div>
      </header>`;

    $('#langSelect')?.addEventListener('change', async (event) => {
      state.lang = event.target.value;
      applyLanguage();
      translateStaticShell();
      renderChrome();
      await routeInit(document.body.dataset.page || 'home');
    });

    $('#styleSelect')?.addEventListener('change', (event) => {
      state.style = event.target.value;
      applyStyle();
    });

    $('#themeToggle')?.addEventListener('click', async () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      applyStyle();
      renderChrome();
      await routeInit(document.body.dataset.page || 'home');
    });

    $('#menuToggle')?.addEventListener('click', () => {
      const nav = $('#navLinks');
      const isOpen = nav?.classList.toggle('open');
      $('#menuToggle')?.setAttribute('aria-expanded', String(Boolean(isOpen)));
    });
  }

  function renderFooter() {
    const footer = $('#site-footer');
    if (!footer) return;
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-content">
          <span>${escapeHTML(t('footer.line'))}</span>
          <a class="small-link" href="/collaborate/">${escapeHTML(t('nav.collaborate'))}</a>
        </div>
      </footer>`;
  }

  async function routeInit(page) {
    if (page === 'home') return renderHome();
    if (page === 'resources') return renderResourcesPage();
    if (page === 'download') return renderDownloadPage();
    if (page === 'collaborate') return renderCollaboratePage();
    if (page === 'about') return renderAboutPage();
    if (page === '404') return render404Page();
  }

  function resourceDirectory() {
    const configured = state.config.resources_directory || '/data/';
    return String(configured).endsWith('/') ? String(configured) : `${configured}/`;
  }

  function isResourceJsonFile(fileName) {
    const lower = String(fileName || '').toLowerCase();
    return lower.endsWith('.json')
      && !['about.json', 'config.json', 'i18n.json', 'index.json'].includes(lower)
      && !lower.startsWith('_')
      && !lower.startsWith('.');
  }

  function fileNameFromHref(href) {
    try {
      const clean = decodeURIComponent(String(href).split('#')[0].split('?')[0]);
      return clean.split('/').filter(Boolean).pop() || '';
    } catch {
      return '';
    }
  }

  function extractJsonFilesFromDirectoryHTML(html) {
    const files = new Set();
    const matches = String(html || '').matchAll(/href=["']([^"']+\.json(?:[?#][^"']*)?)["']/gi);
    for (const match of matches) {
      const fileName = fileNameFromHref(match[1]);
      if (isResourceJsonFile(fileName)) files.add(fileName);
    }
    return [...files].sort((a, b) => a.localeCompare(b));
  }

  function formatUniversityLabelFromFile(fileName) {
    return String(fileName || '')
      .replace(/\.json$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function buildEntriesFromFiles(files) {
    const directory = resourceDirectory();
    return [...new Set(files)]
      .filter(isResourceJsonFile)
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => {
        const id = fileName.replace(/\.json$/i, '');
        return {
          id,
          label: formatUniversityLabelFromFile(fileName),
          file: `${directory}${fileName}`,
          count: 0,
          types: [],
          ownersCount: 0
        };
      });
  }


  async function discoverFilesFromGeneratedIndex() {
    const indexFile = state.config.resources_index_file || `${resourceDirectory()}_files.json`;
    try {
      const response = await fetch(indexFile, { cache: 'no-cache' });
      if (!response.ok) return [];
      const payload = await response.json();
      const rawFiles = Array.isArray(payload) ? payload : (payload.files || []);
      return rawFiles.map(fileNameFromHref).filter(isResourceJsonFile);
    } catch (error) {
      console.warn('Generated resource index failed, trying fallback discovery.', error);
      return [];
    }
  }

  async function discoverFilesFromEndpoint() {
    const endpoint = state.config.resources_discovery_endpoint;
    if (!endpoint) return [];

    try {
      const response = await fetch(endpoint, { cache: 'no-cache' });
      if (!response.ok) return [];
      const payload = await response.json();
      const rawFiles = Array.isArray(payload) ? payload : (payload.files || []);
      return rawFiles.map(fileNameFromHref).filter(isResourceJsonFile);
    } catch (error) {
      console.warn('Resource discovery endpoint failed, falling back to directory listing.', error);
      return [];
    }
  }

  async function discoverFilesFromDirectoryListing() {
    const directory = resourceDirectory();
    const response = await fetch(directory, { cache: 'no-cache' });
    if (!response.ok) return [];
    const html = await response.text();
    return extractJsonFilesFromDirectoryHTML(html);
  }

  async function discoverResourceEntries() {
    const directory = resourceDirectory();
    const filesFromIndex = await discoverFilesFromGeneratedIndex();
    const filesFromEndpoint = filesFromIndex.length ? [] : await discoverFilesFromEndpoint();
    const files = filesFromIndex.length
      ? filesFromIndex
      : (filesFromEndpoint.length ? filesFromEndpoint : await discoverFilesFromDirectoryListing());

    if (!files.length) {
      throw new Error(`No university JSON files were discovered. Check ${state.config.resources_index_file || `${directory}_files.json`} and data/link/*.json.`);
    }

    return buildEntriesFromFiles(files);
  }

  async function hydrateResourceMetadata() {
    await Promise.all(state.manifest.map(async (entry) => {
      const resources = await loadResourceFile(entry);
      entry.count = resources.length;
      entry.types = [...new Set(resources.map((item) => normalize(item.type) || 'unknown'))].sort();
      entry.ownersCount = new Set(resources.map((item) => normalize(item.owner)).filter(Boolean)).size;
    }));
  }

  function defaultUniversityId() {
    const configured = getDefaults().default_university;
    return state.manifest.some((entry) => entry.id === configured) ? configured : (state.manifest[0]?.id || 'all');
  }

  async function loadResourceFile(entry) {
    if (state.cache.has(entry.id)) return state.cache.get(entry.id);
    const data = await fetchJSON(entry.file);
    const prepared = (Array.isArray(data) ? data : []).map((item, index) => ({
      ...item,
      university: entry.id,
      universityLabel: entry.label,
      _index: index
    }));
    state.cache.set(entry.id, prepared);
    return prepared;
  }

  async function loadAllResources(selectedIds) {
    const ids = selectedIds && selectedIds.length ? selectedIds : state.manifest.map((entry) => entry.id);
    const entries = state.manifest.filter((entry) => ids.includes(entry.id));
    const groups = await Promise.all(entries.map(loadResourceFile));
    return groups.flat();
  }

  function typeOptions() {
    const types = ['folder', 'file', 'website'];
    return `
      <option value="all">${escapeHTML(t('common.all'))}</option>
      ${types.map((type) => `<option value="${type}">${escapeHTML(typeLabel(type))}</option>`).join('')}`;
  }

  function universityOptions() {
    return `
      <option value="all">${escapeHTML(t('common.allUniversities'))}</option>
      ${state.manifest.map((entry) => `<option value="${entry.id}">${escapeHTML(entry.label)} (${entry.count})</option>`).join('')}`;
  }

  function typeLabel(type) {
    const clean = normalize(type) || 'resource';
    return t(`common.${clean}`, type || 'Resource');
  }

  function typeIcon(type) {
    const clean = normalize(type);
    if (clean === 'folder') return '📁';
    if (clean === 'file') return '📄';
    if (clean === 'website') return '🌐';
    return '🔗';
  }

  function linkHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function matchesFilters(item, filters) {
    const haystack = normalize([item.name, item.description, item.link, item.universityLabel].join(' '));
    const type = normalize(item.type);
    return (!filters.search || haystack.includes(filters.search))
      && (filters.type === 'all' || type === filters.type)
      && (!filters.university || filters.university === 'all' || item.university === filters.university);
  }

  function renderResourceCard(item) {
    const name = item.name || item.description || item.link || 'Resource';
    const colorStyle = item.color ? ` style="--resource-color:${escapeHTML(item.color)}"` : '';
    const colorClass = item.color ? ' colored' : '';
    const host = linkHost(item.link);
    return `
      <article class="resource-card${colorClass}"${colorStyle}>
        <div class="resource-meta">
          <span class="pill">${escapeHTML(item.universityLabel)}</span>
          <span class="pill pill-neutral">${typeIcon(item.type)} ${escapeHTML(typeLabel(item.type))}</span>
        </div>
        <div class="resource-title">${escapeHTML(name)}</div>
        <div class="owner-line"><strong>${escapeHTML(t('common.owner'))}:</strong> ${escapeHTML(item.owner || 'community')}</div>
        <p class="resource-description">${escapeHTML(item.description || '')}</p>
        <div class="resource-footer">
          <span class="pill pill-neutral">${host ? escapeHTML(host) : `#${escapeHTML(String(item._index + 1))}`}</span>
          <a class="btn btn-primary" href="${escapeHTML(item.link)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(t('common.openResource'))}">${escapeHTML(t('common.open'))} ↗</a>
        </div>
      </article>`;
  }

  function renderCards(container, resources) {
    if (!container) return;
    if (!resources.length) {
      container.innerHTML = `<div class="panel empty-state"><h3>${escapeHTML(t('common.noResults'))}</h3></div>`;
      return;
    }
    container.innerHTML = resources.map(renderResourceCard).join('');
  }

  async function renderHome() {
    const root = $('#page-root');
    if (!root) return;
    const totalResources = state.manifest.reduce((sum, item) => sum + Number(item.count || 0), 0);
    const allTypes = new Set(state.manifest.flatMap((item) => item.types || []));
    const cards = t('home.cards', []);
    root.innerHTML = `
      <section class="hero">
        <div class="panel hero-copy">
          <span class="badge">✨ ${escapeHTML(t('home.badge'))}</span>
          <h1>${escapeHTML(t('home.title'))}</h1>
          <p class="lead">${escapeHTML(t('home.subtitle'))}</p>
          <div class="actions">
            <a class="btn btn-primary" href="/resources/">${escapeHTML(t('home.ctaResources'))}</a>
            <a class="btn btn-secondary" href="/collaborate/">${escapeHTML(t('home.ctaCollaborate'))}</a>
          </div>
        </div>
        <aside class="panel stats-grid" aria-label="${escapeHTML(t('home.statsTitle'))}">
          <div class="stat-card"><div class="stat-value">${state.manifest.length}</div><div class="stat-label">${escapeHTML(t('home.statUniversities'))}</div></div>
          <div class="stat-card"><div class="stat-value">${totalResources}</div><div class="stat-label">${escapeHTML(t('home.statResources'))}</div></div>
          <div class="stat-card"><div class="stat-value">${allTypes.size}</div><div class="stat-label">${escapeHTML(t('home.statTypes'))}</div></div>
        </aside>
      </section>
      <section class="section panel page-hero">
        <h2>${escapeHTML(t('home.ideaTitle'))}</h2>
        <p>${escapeHTML(t('home.ideaText'))}</p>
      </section>
      <section class="section grid-3">
        ${cards.map((card) => `<article class="info-card"><h3>${escapeHTML(card.title)}</h3><p>${escapeHTML(card.text)}</p></article>`).join('')}
      </section>
      <section class="section panel dua-card">
        <h2>${escapeHTML(t('home.duaTitle'))}</h2>
        <p class="dua-arabic" dir="rtl">${escapeHTML(t('home.duaArabic'))}</p>
        <p>${escapeHTML(t('home.duaTranslation'))}</p>
      </section>`;
  }

  async function renderResourcesPage() {
    const root = $('#page-root');
    if (!root) return;
    root.innerHTML = `
      <section class="panel page-hero compact-hero">
        <h1>${escapeHTML(t('resourcesPage.title'))}</h1>
        <p>${escapeHTML(t('resourcesPage.subtitle'))}</p>
      </section>
      <section class="filter-panel">
        <div class="filters-grid resources-filters">
          <label class="field"><span class="label">${escapeHTML(t('common.search'))}</span><input class="input" id="resourceSearch" placeholder="${escapeHTML(t('resourcesPage.searchPlaceholder'))}"></label>
          <label class="field"><span class="label">${escapeHTML(t('common.university'))}</span><select class="select" id="resourceUniversity">${universityOptions()}</select></label>
          <label class="field"><span class="label">${escapeHTML(t('common.type'))}</span><select class="select" id="resourceType">${typeOptions()}</select></label>
          <button class="btn btn-secondary" id="resourceReset" type="button">${escapeHTML(t('common.reset'))}</button>
        </div>
      </section>
      <div class="status-line">
        <div id="resourceNotice" class="notice"></div>
        <strong id="resourceCount">0 ${escapeHTML(t('common.results'))}</strong>
      </div>
      <section class="resource-grid" id="resourceGrid" aria-live="polite"></section>`;

    const controls = {
      search: $('#resourceSearch'), university: $('#resourceUniversity'), type: $('#resourceType'),
      reset: $('#resourceReset'), grid: $('#resourceGrid'), count: $('#resourceCount'), notice: $('#resourceNotice')
    };
    controls.university.value = defaultUniversityId();

    const update = async () => {
      controls.grid.innerHTML = `<div class="panel empty-state">${escapeHTML(t('common.loading'))}</div>`;
      const filters = {
        search: normalize(controls.search.value),
        university: controls.university.value,
        type: controls.type.value
      };
      const selected = filters.university && filters.university !== 'all' ? [filters.university] : undefined;
      const source = await loadAllResources(selected);
      const filtered = source.filter((item) => matchesFilters(item, filters));
      state.currentResources = filtered;
      controls.notice.textContent = filters.university === 'all' ? t('resourcesPage.fullNotice') : t('resourcesPage.defaultNotice');
      controls.count.textContent = `${filtered.length} ${filtered.length === 1 ? t('common.result') : t('common.results')}`;
      renderCards(controls.grid, filtered);
    };

    [controls.search, controls.university, controls.type].forEach((control) => control.addEventListener('input', update));
    controls.reset.addEventListener('click', () => {
      controls.search.value = '';
      controls.university.value = defaultUniversityId();
      controls.type.value = 'all';
      update();
    });
    await update();
  }

  function getSelectedUniversityIds() {
    return $$('.university-check:checked').map((input) => input.value);
  }

  function resourceToText(item, number) {
    const lines = [
      `${number}. ${item.name || item.description || item.link || 'Resource'}`,
      `${t('common.university')}: ${item.universityLabel}`,
      `${t('common.type')}: ${typeLabel(item.type)}`,
      `${t('common.owner')}: ${item.owner || ''}`,
      `${t('common.description')}: ${item.description || ''}`,
      `${t('common.link')}: ${item.link || ''}`
    ];
    return lines.join('\n');
  }

  function buildTxt(resources) {
    const date = new Date().toLocaleString();
    const header = [
      'Student Resources',
      `${t('common.generatedFrom')}: ${location.origin}`,
      `${t('common.lastUpdate')}: ${state.config.last_modification_date || '-'}`,
      `${t('common.generatedAt')}: ${date}`,
      `${t('common.total')}: ${resources.length}`,
      ''.padEnd(48, '=')
    ].join('\n');
    return `${header}\n\n${resources.map(resourceToText).join('\n\n' + ''.padEnd(48, '-') + '\n\n')}\n`;
  }

  function downloadTextFile(content, fileName) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function renderDownloadPage() {
    const root = $('#page-root');
    if (!root) return;
    root.innerHTML = `
      <section class="panel page-hero compact-hero">
        <h1>${escapeHTML(t('downloadPage.title'))}</h1>
        <p>${escapeHTML(t('downloadPage.subtitle'))}</p>
      </section>
      <section class="download-layout">
        <aside class="download-card">
          <h2>${escapeHTML(t('downloadPage.chooseUniversities'))}</h2>
          <div class="actions compact-actions">
            <button class="btn btn-ghost" type="button" id="selectAllUniversities">${escapeHTML(t('common.selectAll'))}</button>
            <button class="btn btn-secondary" type="button" id="clearUniversities">${escapeHTML(t('common.clear'))}</button>
          </div>
          <div class="checkbox-grid" id="universityChecks">
            ${state.manifest.map((entry) => `
              <label class="check-card"><input class="university-check" type="checkbox" value="${entry.id}" checked> <span>${escapeHTML(entry.label)} (${entry.count})</span></label>
            `).join('')}
          </div>
        </aside>
        <section class="download-card">
          <h2>${escapeHTML(t('downloadPage.filtersTitle'))}</h2>
          <div class="filters-grid download-filters">
            <label class="field"><span class="label">${escapeHTML(t('common.search'))}</span><input class="input" id="downloadSearch" placeholder="${escapeHTML(t('downloadPage.searchPlaceholder'))}"></label>
            <label class="field"><span class="label">${escapeHTML(t('common.type'))}</span><select class="select" id="downloadType">${typeOptions()}</select></label>
            <button class="btn btn-primary" id="downloadTxt" type="button">${escapeHTML(t('downloadPage.downloadButton'))}</button>
          </div>
          <div class="status-line"><strong id="downloadCount">0 ${escapeHTML(t('common.results'))}</strong></div>
          <pre class="preview-box" id="downloadPreview">${escapeHTML(t('common.loading'))}</pre>
        </section>
      </section>`;

    const controls = {
      search: $('#downloadSearch'), type: $('#downloadType'),
      count: $('#downloadCount'), preview: $('#downloadPreview'), download: $('#downloadTxt')
    };

    const calculate = async () => {
      const ids = getSelectedUniversityIds();
      if (!ids.length) {
        controls.count.textContent = `0 ${t('common.results')}`;
        controls.preview.textContent = t('downloadPage.emptySelection');
        controls.download.disabled = true;
        state.currentResources = [];
        return;
      }
      const source = await loadAllResources(ids);
      const filters = { search: normalize(controls.search.value), type: controls.type.value, university: 'all' };
      const filtered = source.filter((item) => matchesFilters(item, filters));
      state.currentResources = filtered;
      controls.count.textContent = `${filtered.length} ${filtered.length === 1 ? t('common.result') : t('common.results')}`;
      controls.download.disabled = filtered.length === 0;
      controls.preview.textContent = filtered.length ? buildTxt(filtered.slice(0, 6)) + (filtered.length > 6 ? `\n... (${filtered.length - 6} more)` : '') : t('downloadPage.emptyDownload');
    };

    $('#selectAllUniversities').addEventListener('click', () => { $$('.university-check').forEach((input) => input.checked = true); calculate(); });
    $('#clearUniversities').addEventListener('click', () => { $$('.university-check').forEach((input) => input.checked = false); calculate(); });
    $$('.university-check').forEach((input) => input.addEventListener('change', calculate));
    [controls.search, controls.type].forEach((control) => control.addEventListener('input', calculate));
    controls.download.addEventListener('click', () => {
      if (!state.currentResources.length) return;
      const selected = getSelectedUniversityIds();
      const type = controls.type.value === 'all' ? 'all-types' : controls.type.value;
      const fileName = `${t('downloadPage.fileName')}-${selected.length === state.manifest.length ? 'all' : selected.join('-')}-${type}.txt`.replace(/[^\w\-\.]+/g, '-');
      downloadTextFile(buildTxt(state.currentResources), fileName);
    });
    await calculate();
  }

  async function renderCollaboratePage() {
    const root = $('#page-root');
    if (!root) return;
    root.innerHTML = `
      <section class="panel page-hero collaborate-hero">
        <h1>${escapeHTML(t('collaboratePage.title'))}</h1>
        <p>${escapeHTML(t('collaboratePage.subtitle'))}</p>
        <div class="actions">
          <a class="btn btn-primary" href="${escapeHTML(state.config.share_resources_link || '#')}" target="_blank" rel="noopener noreferrer">${escapeHTML(t('collaboratePage.button'))}</a>
        </div>
      </section>
      <section class="section grid-3">
        ${(t('collaboratePage.steps', []) || []).map((step, index) => `<article class="info-card"><span class="badge">${index + 1}</span><p>${escapeHTML(step)}</p></article>`).join('')}
      </section>
      <section class="section panel page-hero compact-hero"><h2>${escapeHTML(t('collaboratePage.stepsTitle'))}</h2><p>${escapeHTML(t('collaboratePage.thanks'))}</p></section>`;
  }

  function renderLinks(links) {
    if (!links) return '';
    return `<div class="link-list">${Object.entries(links).filter(([, url]) => Boolean(url)).map(([name, url]) => `<a class="small-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(name)}</a>`).join('')}</div>`;
  }

  async function renderAboutPage() {
    const root = $('#page-root');
    if (!root) return;
    const about = await fetchJSON('/data/about.json');
    const developers = about.developers || [];
    const websiteInfo = about.website_info || [];
    root.innerHTML = `
      <section class="panel page-hero compact-hero">
        <h1>${escapeHTML(t('aboutPage.title'))}</h1>
        <p>${escapeHTML(t('aboutPage.subtitle'))}</p>
      </section>
      <section class="about-grid">
        <article class="about-card">
          <h2>${escapeHTML(t('aboutPage.developers'))}</h2>
          ${developers.map((dev) => `<div class="section"><h3>${escapeHTML(dev.name)}</h3><p><strong>${escapeHTML(dev.role || '')}</strong></p><p>${escapeHTML(dev.description || '')}</p>${renderLinks(dev.links)}</div>`).join('')}
        </article>
        <article class="about-card">
          <h2>${escapeHTML(t('aboutPage.community'))}</h2>
          <div class="section"><h3>${escapeHTML(about.community?.name || '')}</h3><p>${escapeHTML(about.community?.description || '')}</p>${renderLinks(about.community?.links)}</div>
        </article>
        <article class="about-card">
          <h2>${escapeHTML(t('aboutPage.projectInfo'))}</h2>
          ${websiteInfo.map((info) => `<p><strong>${escapeHTML(t('aboutPage.owner'))}:</strong> ${escapeHTML(info.owner || '')}</p><p><a class="small-link" href="${escapeHTML(info.repo_github || '#')}" target="_blank" rel="noopener noreferrer">${escapeHTML(t('aboutPage.repo'))}</a></p>`).join('')}
        </article>
        <article class="about-card">
          <h2>${escapeHTML(t('aboutPage.thanks'))}</h2>
          <ul class="list-clean">${(about.thanks || []).map((line) => `<li>${escapeHTML(line)}</li>`).join('')}</ul>
        </article>
      </section>`;
  }

  async function render404Page() {
    const root = $('#page-root');
    if (!root) return;
    root.innerHTML = `<section class="panel page-hero compact-hero"><h1>${escapeHTML(t('notFound.title'))}</h1><p>${escapeHTML(t('notFound.subtitle'))}</p><a class="btn btn-primary" href="/home/">${escapeHTML(t('common.backHome'))}</a></section>`;
  }

  document.addEventListener('DOMContentLoaded', boot);
}());
