/**
 * ApexTelemetry live adapter.
 *
 * app.js renders from `window.apexData` (mock data) so the dashboard always
 * works offline. This file upgrades it at runtime:
 *
 *   - standings  <- GET {API}/:series/standings/drivers   (all three series)
 *   - telemetry  <- WS  {API}/ws/telemetry?series=...     (2 Hz snapshots)
 *
 * The API base is configurable in the UI (page "API config") and persisted in
 * localStorage under `apex-url`. Changing it is picked up within ~2 seconds.
 */
(() => {
  'use strict';

  const DEFAULT_API = 'http://localhost:4000/api/v1';
  const SERIES = ['f1', 'motogp'];
  const REFRESH_MS = 60_000;

  const normalize = (value) =>
    ((value || '').trim() || DEFAULT_API).replace(/\/+$/, '');

  let apiBase = normalize(localStorage.getItem('apex-url'));
  let generation = 0;
  let socket = null;
  let reconnectTimer = null;
  let retry = 0;
  let refreshTimer = null;

  const state = {
    series: 'F1',
    frames: [],
    weather: null,
    session: null,
    meta: null,
    connected: false,
    source: 'mock',
    error: null,
  };

  const $ = (selector) => document.querySelector(selector);

  async function api(path) {
    const res = await fetch(apiBase + path, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  }

  function setStatus(text, tone) {
    const node = $('#live-status');
    if (!node) return;
    node.textContent = text;
    node.className =
      'kicker' + (tone === 'ok' ? ' live-ok' : tone === 'bad' ? ' live-down' : '');
  }

  function renderStrip() {
    const strip = $('#live-strip');
    const label = $('#live-series');
    if (label) label.textContent = state.series;

    if (!strip) return;

    if (!state.frames.length) {
      strip.innerHTML = '<p class="kicker">Waiting for the 2 Hz feed...</p>';
      return;
    }

    const rows = [...state.frames].sort((a, b) => b.speed - a.speed);
    strip.innerHTML = rows
      .map((frame) => {
        const throttle = Math.max(0, Math.min(100, Math.round(frame.throttle)));
        const color = /^#[0-9a-f]{6}$/i.test(frame.teamColor || '')
          ? frame.teamColor
          : '#ff3e32';
        const name = String(frame.fullName || frame.code || '').toUpperCase();
        return (
          '<div class="live-row">' +
          `<span class="initial">${frame.code}</span>` +
          '<div class="live-name">' +
          `<span>${name}</span>` +
          `<div class="bar"><i style="width:${throttle}%;background:${color}"></i></div>` +
          '</div>' +
          `<b>${Math.round(frame.speed)}<small>KPH</small></b>` +
          `<span class="gear">G${frame.gear}</span>` +
          '</div>'
        );
      })
      .join('');
  }

  async function loadStandings() {
    const data = window.apexData;
    if (!data) return;

    const results = await Promise.allSettled(
      SERIES.map((series) => api(`/${series}/standings/drivers`)),
    );

    let loaded = 0;
    results.forEach((result, index) => {
      if (result.status !== 'fulfilled') {
        console.warn(
          `[apex] standings fallback for ${SERIES[index]}:`,
          result.reason?.message || result.reason,
        );
        return;
      }
      const { standings } = result.value;
      if (!Array.isArray(standings)) return;

      data[SERIES[index]] = standings.map((driver) => [
        driver.fullName,
        driver.teamName,
        driver.points,
        driver.wins,
        driver.podiums,
        driver.gapToLeader === 0 ? 'LEADER' : `+${driver.gapToLeader}`,
      ]);
      loaded += 1;
    });

    if (loaded === 0) {
      state.source = 'mock';
      state.error = 'standings unavailable';
      return;
    }

    state.source = 'api';
    state.error = null;
    if (typeof window.apexRender === 'function') window.apexRender();
    renderStrip();
  }

  function applyWeather() {
    const weather = state.weather;
    if (!weather) return;

    const set = (id, text) => {
      const node = document.getElementById(id);
      if (node && node.textContent !== text) node.textContent = text;
    };

    if (typeof weather.trackTempC === 'number') set('wx-track', `${Math.round(weather.trackTempC)}°`);
    if (typeof weather.airTempC === 'number') set('wx-air', `${Math.round(weather.airTempC)}°`);
    if (typeof weather.rainProbability === 'number') {
      set('wx-rain', `${Math.round(weather.rainProbability)}%`);
    }
  }

  /** Paint the session the API actually has (OpenF1 for F1) onto the overview. */
  function applySession() {
    const session = state.session;
    if (!session) return;

    const circuit = session.circuit || {};
    const meta = state.meta || {};
    const modeLabel =
      meta.mode === 'live' || session.isActive
        ? 'LIVE'
        : meta.mode === 'replay'
          ? 'REPLAY'
          : 'ARCHIVE';

    const setText = (id, text) => {
      const node = document.getElementById(id);
      if (node && node.textContent !== text) node.textContent = text;
    };

    const setHtml = (id, html) => {
      const node = document.getElementById(id);
      if (node && node.innerHTML !== html) node.innerHTML = html;
    };

    const name = String(circuit.name || 'Circuit').toUpperCase();
    const shortName = String(circuit.shortName || circuit.name || 'Circuit').toUpperCase();
    const country = String(circuit.country || '').toUpperCase();
    const sessionType = String(session.sessionTypeLabel || 'Session').toUpperCase();
    const start = new Date(session.startTime);
    const startLabel = Number.isNaN(start.getTime())
      ? 'TBC'
      : `${start.toISOString().slice(11, 16)} UTC`;

    setText('overview-mode', `${modeLabel} — ${String(session.seriesLabel || '').toUpperCase()}`);
    setText('event-title', `${sessionType} — ${name}`);
    setText('event-circuit', country ? `${name} — ${country}` : name);
    setText('event-name', shortName);
    setHtml(
      'event-len',
      `${circuit.lengthKm ? `${circuit.lengthKm.toFixed(3)} km` : '—'}<small>TRACK</small>`,
    );
    setHtml('event-type', `${sessionType}<small>SESSION</small>`);
    setHtml(
      'event-start',
      `${startLabel}<small>${modeLabel === 'LIVE' ? 'IN PROGRESS' : 'STARTED'}</small>`,
    );
    setText('event-label', modeLabel === 'LIVE' ? 'SESSION IN PROGRESS' : 'LAST SESSION');
    setText('countdown', `${Math.round(session.elapsedMinutes || 0)} MIN`);
    setText('event-mode', `SESSION MODE — ${modeLabel}`);

    setText('circuit-name', shortName);
    setText(
      'circuit-len',
      circuit.lengthKm ? `${circuit.lengthKm.toFixed(3)} KM TRACK` : 'TRACK LENGTH N/A',
    );
    setText('circuit-country', country || '—');
  }

  async function loadSeriesExtras(seriesKey) {
    const series = String(seriesKey || 'f1').toLowerCase();

    const [overview, predictions] = await Promise.allSettled([
      api(`/overview/live?series=${series}`),
      api(`/overview/predictions?series=${series}`),
    ]);

    if (overview.status === 'fulfilled') {
      state.weather = overview.value.weather || null;
      state.session = overview.value.session || null;
      state.meta = overview.value.meta || null;
      applyWeather();
      applySession();
    } else {
      console.warn('[apex] weather fallback:', overview.reason?.message || overview.reason);
    }

    if (predictions.status === 'fulfilled') {
      const list = Array.isArray(predictions.value.predictions)
        ? predictions.value.predictions
        : [];
      if (list.length) {
        window.apexPredictions = list.slice(0, 5).map((entry) => [
          entry.code,
          String(entry.fullName).split(' ').slice(-1)[0],
          Math.round(entry.winProbability),
        ]);
        if (typeof window.apexRender === 'function') window.apexRender();
      }
    } else {
      console.warn('[apex] predictions fallback:', predictions.reason?.message || predictions.reason);
    }
  }

  function connect(seriesKey) {
    const series = String(seriesKey || 'f1').toUpperCase();
    const myGeneration = ++generation;

    state.series = series;
    state.frames = [];
    clearTimeout(reconnectTimer);
    renderStrip();

    if (socket) {
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      socket = null;
    }

    const wsBase = apiBase.replace(/^http/i, 'ws').replace(/\/api\/v1$/i, '');
    const url = `${wsBase}/ws/telemetry?series=${series.toLowerCase()}`;

    setStatus('CONNECTING TO FEED...');

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      setStatus('FEED UNAVAILABLE', 'bad');
      return;
    }
    socket = ws;

    ws.onopen = () => {
      if (myGeneration !== generation) return;
      state.connected = true;
      retry = 0;
    };

    ws.onmessage = (event) => {
      if (myGeneration !== generation) return;
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === 'connected') {
        state.connected = true;
        setStatus(`LIVE / ${message.series} / ${message.sampleRateHz} HZ`, 'ok');
        return;
      }

      if (message.type === 'telemetry.snapshot' && Array.isArray(message.frames)) {
        state.frames = message.frames;
        state.connected = true;
        renderStrip();
        setStatus(`LIVE / ${message.series} / ${message.sampleRateHz} HZ`, 'ok');
        return;
      }

      if (message.type === 'error') {
        setStatus('FEED ERROR', 'bad');
      }
    };

    ws.onclose = () => {
      if (myGeneration !== generation) return;
      state.connected = false;
      state.frames = [];
      renderStrip();
      setStatus('RECONNECTING...', 'bad');
      const delay = Math.min(1000 * 2 ** retry, 10_000);
      retry += 1;
      reconnectTimer = setTimeout(() => connect(state.series), delay);
    };

    ws.onerror = () => {
      /* onclose handles recovery */
    };
  }

  async function boot() {
    renderStrip();
    connect('f1');
    await Promise.all([loadStandings(), loadSeriesExtras('f1')]);

    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      loadStandings().catch(() => {});
    }, REFRESH_MS);
  }

  // Keep the strip alive across full re-renders triggered by app.js.
  const observer = new MutationObserver(() => {
    const strip = $('#live-strip');
    if (strip && !strip.dataset.painted) {
      strip.dataset.painted = '1';
      renderStrip();
    }
    applyWeather();
    applySession();
  });
  observer.observe(document.getElementById('content') || document.body, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('apex:series', (event) => {
    connect(event.detail);
    loadSeriesExtras(event.detail).catch(() => {});
  });
  document.addEventListener('apex:page', (event) => {
    const page = event.detail;
    if (page === 'overview') {
      // The overview always shows the F1 desk, so refresh it with F1 data.
      connect('f1');
      loadSeriesExtras('f1').catch(() => {});
    } else if (SERIES.includes(page)) {
      connect(page);
      loadSeriesExtras(page).catch(() => {});
    }
    renderStrip();
  });

  // "API config" page saves `apex-url`; pick up a changed base without a reload.
  setInterval(() => {
    const next = normalize(localStorage.getItem('apex-url'));
    if (next === apiBase) return;
    apiBase = next;
    retry = 0;
    connect(state.series);
    loadStandings().catch(() => {});
    loadSeriesExtras(state.series).catch(() => {});
  }, 2_000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
