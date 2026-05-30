/* ═══════════════════════════════════════════
   Melquisedec — Landing Page Scripts
   ═══════════════════════════════════════════ */

'use strict';

/* ─── Solo log en desarrollo ─── */
const IS_DEV = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
function devLog(...args) { if (IS_DEV) console.log(...args); }
function devWarn(...args) { if (IS_DEV) console.warn(...args); }

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Config ─── */
  const REPO_OWNER = 'moy385';
  const REPO_NAME = 'HimnarioID_2.0';
  const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const CACHE_KEY = 'melquisedec_release_cache';
  const CACHE_TTL = 5 * 60 * 1000;     // 5 min (antes 30 min)
  const API_TIMEOUT = 5000;            // 5 segundos de timeout

  /* ═══════════════════════════════════════════
     1. Fetch latest version from GitHub Releases
     ──
     Estrategia: stale-while-revalidate
     1. Muestra caché instantáneamente (si existe y es reciente)
     2. En background, busca datos frescos de la API
     3. Si la red falla, usa el caché como respaldo (sin importar edad)
     ═══════════════════════════════════════════ */

  let _bgPromise = null; // evita revalidaciones duplicadas

  async function fetchLatestRelease() {
    // ── Leer caché ──────────────────────────────────────────────
    const cached = localStorage.getItem(CACHE_KEY);
    let cachedData = null;
    let cachedTimestamp = 0;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        cachedData = parsed.data;
        cachedTimestamp = parsed.timestamp;
      } catch { /* ignorar */ }
    }

    // ── Revalidación en background ──────────────────────────────
    // Siempre se dispara, incluso si el caché es reciente.
    // Así garantizamos que los datos estén siempre al día.
    const bg = _revalidateInBackground();
    _bgPromise = _bgPromise || bg;
    // No await - corre en background mientras seguimos

    // ── Devolver datos disponibles ──────────────────────────────
    if (cachedData && Date.now() - cachedTimestamp < CACHE_TTL) {
      // Caché reciente → devolverlo mientras se revalida en bg
      return cachedData;
    }

    // Caché vencido o inexistente → esperar la revalidación
    try {
      return await _bgPromise;
    } catch {
      // Revalidación falló → devolver cualquier caché que tengamos
      if (cachedData) return cachedData;
      return null;
    }
  }

  async function _revalidateInBackground() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), API_TIMEOUT);

      const res = await fetch(`${GITHUB_API}?_=${Date.now()}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/vnd.github+json' },
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, timestamp: Date.now() }),
      );
      return data;
    } catch (err) {
      devWarn('Background revalidation failed:', err);
      throw err;
    }
  }

  /* ─── Update download links ─── */
  function updateDownloadLinks(release) {
    if (!release) return;

    devLog(`Latest release: ${release.tag_name}`);

    const getAsset = (pattern) =>
      release.assets?.find(a => a.name.toLowerCase().includes(pattern));

    const platformMap = {
      windows:          { pattern: 'windows',          fallback: '.exe' },
      linux:            { pattern: 'linux',            fallback: '.AppImage' },
      mac:              { pattern: 'mac',              fallback: '.dmg' },
      'android-arm64':  { pattern: 'arm64-v8a',        fallback: '.apk' },
      'android-armeabi':{ pattern: 'armeabi-v7a',      fallback: '.apk' },
      'android-x86':    { pattern: 'x86_64',           fallback: '.apk' },
    };

    for (const [platform, cfg] of Object.entries(platformMap)) {
      const asset = getAsset(cfg.pattern);
      const card = document.querySelector(`[data-platform="${platform}"]`);
      if (card && asset) {
        card.href = asset.browser_download_url;
      } else if (card) {
        card.href = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
      }
    }

    // Quick links en footer
    document.querySelectorAll('[data-platform]').forEach(el => {
      const platform = el.dataset.platform;
      const asset = getAsset(platformMap[platform]?.pattern || platform);
      if (asset) el.href = asset.browser_download_url;
    });
  }

  // Fetch and update
  fetchLatestRelease().then(updateDownloadLinks);

  /* ═══════════════════════════════════════════
     2. Download handler (mobile-safe)
     ═══════════════════════════════════════════ */
  function triggerDownload(url) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 60000);
  }

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.download-card, [data-platform]');
    if (card && card.href && card.href !== '#') {
      e.preventDefault();
      if (card.href.includes('releases/download')) {
        triggerDownload(card.href);
      } else {
        window.open(card.href, '_blank', 'noopener');
      }
    }
  });

  /* ═══════════════════════════════════════════
     3. Mobile Nav Toggle
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
     4. Navbar scroll effect
     ═══════════════════════════════════════════ */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.pageYOffset > 50);
  }, { passive: true });

  /* ═══════════════════════════════════════════
     5. Intersection Observer (fade-in animations)
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
     6. Footer year
     ═══════════════════════════════════════════ */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ═══════════════════════════════════════════
     7. Keyboard support for nav toggle
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
     8. Register Service Worker (PWA)
     ═══════════════════════════════════════════ */
  if ('serviceWorker' in navigator) {
    // Esperar a que la página termine de cargar para registrar el SW
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        devLog('SW registered:', reg.scope);
      }).catch((err) => {
        devWarn('SW registration failed:', err);
      });
    });
  }

  devLog('Melquisedec — Landing page loaded');
});
