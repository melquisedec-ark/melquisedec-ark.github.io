/* ═══════════════════════════════════════════
   Melquisedec — Landing Page Scripts
   ═══════════════════════════════════════════ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ─── Config ─── */
  const REPO_OWNER = 'moy385';
  const REPO_NAME = 'HimnarioID_2.0';
  const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const CACHE_KEY = 'melquisedec_release_cache';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  /* ═══════════════════════════════════════════
     1. Fetch latest version from GitHub Releases
     ═══════════════════════════════════════════ */
  async function fetchLatestRelease() {
    // Try cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          return data;
        }
      } catch { /* ignore */ }
    }

    try {
      const res = await fetch(GITHUB_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Cache it
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      return data;
    } catch (err) {
      console.warn('Failed to fetch release:', err);
      return null;
    }
  }

  function updateDownloadLinks(release) {
    if (!release) return;

    console.log(`Latest release: ${release.tag_name}`);

    // Helper to find asset by name
    const getAsset = (pattern) =>
      release.assets?.find(a => a.name.toLowerCase().includes(pattern));

    // Map platforms to asset patterns
    const platformMap = {
      windows: { pattern: 'windows', fallback: '.exe' },
      linux: { pattern: 'linux', fallback: '.AppImage' },
      mac: { pattern: 'mac', fallback: '.dmg' },
      'android-arm64': { pattern: 'arm64-v8a', fallback: '.apk' },
      'android-armeabi': { pattern: 'armeabi-v7a', fallback: '.apk' },
      'android-x86': { pattern: 'x86_64', fallback: '.apk' },
    };

    // Update download links
    for (const [platform, cfg] of Object.entries(platformMap)) {
      const asset = getAsset(cfg.pattern);
      const card = document.querySelector(`[data-platform="${platform}"]`);
      if (card && asset) {
        card.href = asset.browser_download_url;
      } else if (card) {
        // If no matching asset, link to releases page
        card.href = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
      }
    }

    // Also update quick links in footer
    document.querySelectorAll('[data-platform]').forEach(el => {
      const platform = el.dataset.platform;
      const asset = getAsset(platformMap[platform]?.pattern || platform);
      if (asset) {
        el.href = asset.browser_download_url;
      }
    });

    // Note: version badge (hero) and statVersion (about) are static
    // They show "MQ App v2.0" and "2.0" respectively from the HTML
  }

  // Fetch and update
  fetchLatestRelease().then(updateDownloadLinks);

  /* ═══════════════════════════════════════════
     2. Mobile Nav Toggle
     ═══════════════════════════════════════════ */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('active');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    // Close menu on link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ═══════════════════════════════════════════
     3. Navbar scroll effect
     ═══════════════════════════════════════════ */
  const navbar = document.getElementById('navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  }, { passive: true });

  /* ═══════════════════════════════════════════
     4. Intersection Observer (fade-in animations)
     ═══════════════════════════════════════════ */
  const fadeElements = document.querySelectorAll('.fade-in');

  if (fadeElements.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Optionally unobserve after first reveal
            // observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    fadeElements.forEach(el => observer.observe(el));
  }

  /* ═══════════════════════════════════════════
     5. Footer year
     ═══════════════════════════════════════════ */
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* ═══════════════════════════════════════════
     6. Keyboard support for nav toggle
     ═══════════════════════════════════════════ */
  if (navToggle) {
    navToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navToggle.click();
      }
    });
  }

  console.log('🔶 Melquisedec — Landing page loaded');
});
