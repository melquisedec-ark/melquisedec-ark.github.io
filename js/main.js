/* ═══════════════════════════════════════════
   Melquisedec — Landing Page Scripts
   v2.0 — Dual repo (Himnario + App Completa)
   ═══════════════════════════════════════════ */

'use strict';

/* ─── Solo log en desarrollo ─── */
const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
function devLog(...args) { if (IS_DEV) console.log(...args); }
function devWarn(...args) { if (IS_DEV) console.warn(...args); }

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Config: repositorios ─── */
  const REPOS = {
    himnario: { owner: 'moy385',          name: 'HimnarioID_2.0', badgeId: 'badge-himnario' },
    completa: { owner: 'melquisedec-ark',  name: 'MQ-App',         badgeId: 'badge-completa'  },
  };
  const CACHE_KEY_PREFIX = 'melquisedec_release_';
  const CACHE_TTL = 10 * 60 * 1000;    // 10 minutos
  const API_TIMEOUT = 5000;           // 5 segundos

  /* ─── Cache helpers ─── */
  function getCache(repoKey) {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + repoKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch { return null; }
  }

  function cacheIsFresh(cacheEntry) {
    return cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_TTL);
  }

  function setCache(repoKey, data) {
    localStorage.setItem(CACHE_KEY_PREFIX + repoKey, JSON.stringify({ data, timestamp: Date.now() }));
  }

  /* ─── Fetch latest release for one repo ─── */
  async function fetchLatestRelease(owner, name) {
    const GITHUB_API = `https://api.github.com/repos/${owner}/${name}/releases/latest`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
      const res = await fetch(`${GITHUB_API}?_=${Date.now()}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/vnd.github+json' },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      devWarn(`Failed to fetch ${owner}/${name}:`, err);
      return null;
    }
  }

  /* ─── Platform pattern mapping ─── */
  const PLATFORM_MAP = {
    'windows':         { pattern: 'windows',         fallback: '.exe'      },
    'linux':           { pattern: 'linux',           fallback: '.AppImage' },
    'mac':             { pattern: 'mac',             fallback: '.dmg'      },
    'android':         { pattern: 'arm64-v8a',       fallback: '.apk'      },
  };

  /* ─── Update download links for a specific repo ─── */
  function updateDownloadLinks(repoKey, release) {
    const container = document.querySelector(`[data-repo-group="${repoKey}"]`);
    if (!container) return;

    const cards = container.querySelectorAll('[data-platform]');
    if (!cards.length) return;

    const owner = REPOS[repoKey].owner;
    const name = REPOS[repoKey].name;

    if (release && release.assets) {
      for (const card of cards) {
        const platform = card.dataset.platform;
        const cfg = PLATFORM_MAP[platform];
        if (!cfg) continue;
        const asset = release.assets.find(a =>
          a.name.toLowerCase().includes(cfg.pattern)
        );
        if (asset) {
          card.href = asset.browser_download_url;
        } else {
          card.href = `https://github.com/${owner}/${name}/releases`;
        }
      }
    } else {
      // Fallback: no release data
      for (const card of cards) {
        card.href = `https://github.com/${owner}/${name}/releases/latest`;
      }
    }
  }

  /* ─── Update version badge ─── */
  function updateBadge(repoKey, release) {
    const badge = document.getElementById(REPOS[repoKey].badgeId);
    if (badge && release && release.tag_name) {
      badge.textContent = release.tag_name;
    }
  }

  /* ─── Update hero badge (shows latest between both) ─── */
  function updateHeroBadge(releases) {
    const badge = document.getElementById('versionBadge');
    if (!badge) return;
    // Show both versions
    const him = releases.himnario?.tag_name || 'v2.0';
    const com = releases.completa?.tag_name || 'v1.0';
    badge.textContent = `Himnario ${him} · Completa ${com}`;
  }

  /* ─── Update stats ─── */
  function updateStats(releases) {
    const statEl = document.getElementById('statVersion');
    if (statEl && releases.himnario?.tag_name) {
      statEl.textContent = releases.himnario.tag_name.replace(/^v/, '');
    }
  }

  /* ─── Fetch all repos (stale-while-revalidate condicional) ─── */
  async function fetchAll() {
    const releases = {};
    const bgPromises = {};

    const tasks = Object.entries(REPOS).map(async ([key, cfg]) => {
      const cacheEntry = getCache(key);
      const fresh = cacheEntry && cacheIsFresh(cacheEntry);

      if (fresh) {
        // Cache fresco (<10 min) → usarlo SIN revalidar
        devLog(`[${key}] Cache fresco, NO revalidando`);
        releases[key] = cacheEntry.data;
        return;
      }

      // Cache vencido o inexistente
      if (cacheEntry) {
        // Mostrar datos stale inmediatamente
        releases[key] = cacheEntry.data;
      }

      // Revalidar en background (solo si no hay ya una en curso)
      if (!bgPromises[key]) {
        bgPromises[key] = fetchLatestRelease(cfg.owner, cfg.name).then(data => {
          if (data) {
            setCache(key, data);
            releases[key] = data;
          }
          return releases[key];
        }).catch(err => {
          devWarn(`[${key}] Revalidation failed:`, err);
          return releases[key] || null;
        });
      }

      if (cacheEntry) {
        // Cache stale: no esperar la revalidación
        devLog(`[${key}] Cache stale, revalidando en background`);
      } else {
        // Sin cache: esperar la revalidación
        releases[key] = await bgPromises[key];
      }
    });

    await Promise.allSettled(tasks);
    return releases;
  }

  /* ─── Init: fetch and update ─── */
  fetchAll().then(releases => {
    devLog('Releases:', releases);

    // Update each repo's download links and badges
    for (const key of Object.keys(REPOS)) {
      updateDownloadLinks(key, releases[key]);
      updateBadge(key, releases[key]);
    }

    updateHeroBadge(releases);
    updateStats(releases);
  });

  /* ═══════════════════════════════════════════
     Tab switching
     ═══════════════════════════════════════════ */

  const tabNav = document.querySelector('.tabs__nav');
  if (tabNav) {
    tabNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.tabs__btn');
      if (!btn) return;

      const tabId = btn.dataset.tab;
      if (!tabId) return;

      // Deactivate all tabs
      document.querySelectorAll('.tabs__btn').forEach(b => {
        b.classList.remove('tabs__btn--active');
        b.setAttribute('aria-selected', 'false');
      });

      // Activate clicked tab
      btn.classList.add('tabs__btn--active');
      btn.setAttribute('aria-selected', 'true');

      // Deactivate all panels
      document.querySelectorAll('.tabs__panel').forEach(p => {
        p.classList.remove('tabs__panel--active');
      });

      // Activate target panel
      const panel = document.getElementById(`panel-${tabId}`);
      if (panel) {
        panel.classList.add('tabs__panel--active');
      }
    });

    // Keyboard navigation: Enter/Space on tab buttons
    tabNav.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const btn = e.target.closest('.tabs__btn');
        if (btn) {
          e.preventDefault();
          btn.click();
        }
      }
    });
  }

  /* ─── Tab switch from footer links ─── */
  document.querySelectorAll('[data-tab-switch]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = link.dataset.tabSwitch;
      if (!tabId) return;
      const btn = document.querySelector(`.tabs__btn[data-tab="${tabId}"]`);
      if (btn) btn.click();
      // Scroll to downloads section
      document.getElementById('descargas')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ═══════════════════════════════════════════
     Download handler con analytics
     — Híbrido: desktop usa <a> temporal + target=_blank,
       mobile usa toast + location.href
     ═══════════════════════════════════════════ */

  function isMobile() {
    return /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i
      .test(navigator.userAgent);
  }

  function sendAnalytics(url, repoKey) {
    const filename = url.split('/').pop() || 'unknown';
    if (typeof gtag === 'function') {
      gtag('event', 'download', {
        'platform': filename,
        'version': repoKey || 'unknown',
        'download_url': url,
      });
    }
    // sendBeacon como respaldo (sobrevive al unload de la página)
    try {
      navigator.sendBeacon(url, '');
    } catch (_) {}
    devLog(`Download tracked: ${repoKey} → ${filename}`);
  }

  function showToast(msg) {
    const old = document.querySelector('.download-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'download-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML =
      '<div class="download-toast__content">' +
        '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
        '<span>' + msg + '</span>' +
      '</div>';
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('download-toast--visible');
    });

    setTimeout(function () {
      toast.classList.remove('download-toast--visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function triggerDownload(url, repoKey) {
    // 1. Analytics ANTES de navegar
    sendAnalytics(url, repoKey);

    // 2. Estrategia según plataforma
    if (/* mobile */ /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(navigator.userAgent)) {
      // Mobile: toast + navegación directa (único método que activa el motor de descargas)
      showToast('Descarga iniciada — Revisa tus notificaciones');
      setTimeout(function () { window.location.href = url; }, 800);
    } else {
      // Desktop: <a> temporal + target="_blank" (evita popup blockers)
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    devLog('Download: ' + repoKey + ' → ' + url);
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest('.download-card, [data-platform]');
    if (card && card.href && card.href !== '#') {
      e.preventDefault();

      var repoGroup = card.closest('[data-repo-group]');
      var repoKey = repoGroup ? repoGroup.dataset.repoGroup : 'unknown';

      if (card.href.indexOf('releases/download') !== -1) {
        triggerDownload(card.href, repoKey);
      } else if (card.href.indexOf('releases/latest') !== -1) {
        // releases/latest → abrir GitHub
        if (/android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(navigator.userAgent)) {
          window.location.href = card.href;
        } else {
          var a = document.createElement('a');
          a.href = card.href;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        triggerDownload(card.href, repoKey);
      }
    }
  });

  /* ═══════════════════════════════════════════
     Mobile Nav Toggle
     ═══════════════════════════════════════════ */

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('active');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ═══════════════════════════════════════════
     Navbar scroll effect
     ═══════════════════════════════════════════ */

  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.pageYOffset > 50);
  }, { passive: true });

  /* ═══════════════════════════════════════════
     Intersection Observer (fade-in animations)
     ═══════════════════════════════════════════ */

  const fadeElements = document.querySelectorAll('.fade-in');
  if (fadeElements.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    fadeElements.forEach(el => observer.observe(el));
  }

  /* ═══════════════════════════════════════════
     Footer year
     ═══════════════════════════════════════════ */

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ═══════════════════════════════════════════
     Keyboard support for nav toggle
     ═══════════════════════════════════════════ */

  if (navToggle) {
    navToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navToggle.click();
      }
    });
  }

  /* ═══════════════════════════════════════════
     Register Service Worker (PWA)
     ═══════════════════════════════════════════ */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        devLog('SW registered:', reg.scope);
      }).catch((err) => {
        devWarn('SW registration failed:', err);
      });
    });
  }

  devLog('Melquisedec — Landing page loaded v2.0');
});
