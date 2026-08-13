/* ==========================================================================
   OpenNur Project — SPA logic
   Fetches the live README, renders it as Markdown, and caches it locally
   for offline fallback.
   ========================================================================== */
(function () {
  'use strict';

  const README_URL = 'https://raw.githubusercontent.com/opennur/opennur/refs/heads/main/README.md';
  const REPO_URL = 'https://github.com/opennur/opennur';
  const BLOB_BASE = 'https://github.com/opennur/opennur/blob/main/';
  const CACHE_KEY = 'opennur-readme';
  const FETCH_TIMEOUT_MS = 10000;

  const errorEl = document.getElementById('error');
  const retryBtn = document.getElementById('retry');
  const offlineNoticeEl = document.getElementById('offline-notice');
  const contentEl = document.getElementById('content');

  function show(el) {
    el.classList.remove('hidden');
  }

  function hide(el) {
    el.classList.add('hidden');
  }

  /* Fetch with an explicit timeout (AbortController). */
  async function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(function () {
      controller.abort();
    }, ms);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  /* ----- Local cache (offline fallback) ----- */
  function cacheGet() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) {
        return null;
      }
      const data = JSON.parse(raw);
      if (data && typeof data.md === 'string') {
        return data;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  function cacheSet(md) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ md: md, at: Date.now() }));
    } catch (err) {
      /* Ignore quota / privacy-mode errors. */
    }
  }

  /* ----- Link rewriting: resolve relative links + external links in new tab ----- */
  function rewriteLinks(root) {
    const anchors = root.querySelectorAll('a');
    anchors.forEach(function (a) {
      const href = a.getAttribute('href');
      if (!href) {
        return;
      }

      // In-page anchors (e.g. "#section") stay as-is.
      if (href.charAt(0) === '#') {
        return;
      }

      // Absolute / protocol / mailto links open in a new tab.
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        return;
      }

      // Relative links (e.g. "CONTRIBUTING.md") resolve against the repo blob URL.
      try {
        a.setAttribute('href', new URL(href, BLOB_BASE).href);
      } catch (err) {
        /* Leave the original href untouched if resolution fails. */
      }
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  /* ----- Render markdown -> sanitized HTML ----- */
  function render(md, isCached) {
    let html;
    try {
      const parsed = marked.parse(md);
      html = DOMPurify.sanitize(parsed);
    } catch (err) {
      html = '<p>Terjadi kesalahan saat merender konten.</p>';
    }
    contentEl.innerHTML = html;
    rewriteLinks(contentEl);
    hide(errorEl);

    if (isCached) {
      show(offlineNoticeEl);
    } else {
      hide(offlineNoticeEl);
    }
  }

  /* ----- Main load flow ----- */
  async function load() {
    hide(errorEl);
    hide(offlineNoticeEl);
    contentEl.innerHTML = '';

    try {
      const md = await fetchWithTimeout(README_URL, FETCH_TIMEOUT_MS);
      cacheSet(md);
      render(md, false);
    } catch (err) {
      const cached = cacheGet();
      if (cached) {
        render(cached.md, true);
      } else {
        show(errorEl);
      }
    }
  }

  retryBtn.addEventListener('click', load);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
