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
    tyres: null,
    schedule: null,
    live: null,
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
      const html =
        state.live === false
          ? '<div class="idle-feed"><b>NO LIVE SESSION</b><small>Live telemetry starts at lights out. The last session stays available in the standings and tyre strategy panels.</small></div>'
          : '<p class="kicker">Waiting for the 2 Hz feed...</p>';
      // renderStrip runs from the MutationObserver too — never rewrite the same markup.
      if (strip.dataset.stamp !== html) {
        strip.dataset.stamp = html;
        strip.innerHTML = html;
      }
      return;
    }

    strip.dataset.stamp = '';

    const rows = [...state.frames].sort((a, b) => b.speed - a.speed);
    strip.innerHTML = rows
      .map((frame) => {
        const throttle = Math.max(0, Math.min(100, Math.round(frame.throttle)));
        const color = /^#[0-9a-f]{6}$/i.test(frame.teamColor || '')
          ? frame.teamColor
          : '#ff3e32';
        const name = String(frame.fullName || frame.code || '').toUpperCase();
        const driverId = frame.code
          ? `(${frame.code}${frame.driverNumber != null ? `-${frame.driverNumber}` : ''})`
          : '';
        const tyre =
          frame.tyre && frame.tyre.compound
            ? `<span class="tyre-pill ${String(frame.tyre.compound).toLowerCase()}" title="${frame.tyre.compoundLabel || ''} · ${frame.tyre.laps || 0} laps">${frame.tyre.compound}</span>`
            : '';
        return (
          '<div class="live-row">' +
          `<span class="initial">${frame.code}</span>` +
          '<div class="live-name">' +
          `<span>${name}${driverId ? ` <em class="driver-id">${driverId}</em>` : ''}</span>` +
          `<div class="bar"><i style="width:${throttle}%;background:${color}"></i></div>` +
          '</div>' +
          `<b>${Math.round(frame.speed)}<small>KPH</small></b>` +
          `<span class="gear">G${frame.gear}</span>` +
          tyre +
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
        driver.code,
        driver.driverNumber,
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

  /**
   * Constructor championship from GET /:series/standings/constructors.
   * Stored in the same shape app.js uses for its offline mock:
   *   [name, points, gapToLeader, colorHex]
   */
  async function loadConstructorStandings() {
    const store = window.apexConstructors;
    if (!store) return;

    const results = await Promise.allSettled(
      SERIES.map((series) => api(`/${series}/standings/constructors`)),
    );

    let loaded = 0;
    results.forEach((result, index) => {
      if (result.status !== 'fulfilled') {
        console.warn(
          `[apex] constructor fallback for ${SERIES[index]}:`,
          result.reason?.message || result.reason,
        );
        return;
      }
      const list = result.value.standings;
      if (!Array.isArray(list) || list.length === 0) return;

      store[SERIES[index]] = list.map((team) => [
        team.name,
        team.points,
        team.gapToLeader ?? 0,
        team.colorHex || '#ff3e32',
      ]);
      loaded += 1;
    });

    if (loaded > 0 && typeof window.apexRender === 'function') window.apexRender();
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

    applyCircuit(circuit);
  }

  /**
   * Paints the real circuit layout (SVG path from `circuits.js`) and sets the
   * signature-corner photograph (from `corners.js`) behind the session card.
   * The circuit profile panel shows the map only.
   */
  function applyCircuit(circuit) {
    if (!circuit) return;

    const resolve = window.apexCircuitFor;
    const resolved = typeof resolve === 'function' ? resolve(circuit.shortName, circuit.name, circuit.id) : null;
    const key = resolved ? resolved.key : 'unknown';

    const panel = document.getElementById('circuit-panel');
    if (panel && panel.dataset.circuit !== key) {
      panel.dataset.circuit = key;
      const path = document.getElementById('circuit-path');
      if (path) path.setAttribute('d', resolved ? resolved.path : '');
      const art = panel.querySelector('.corner-art path');
      if (art) art.setAttribute('d', resolved ? resolved.corner : '');
      const label = document.getElementById('circuit-layout');
      if (label) label.textContent = resolved ? resolved.short : 'LAYOUT N/A';
    }

    const photo =
      resolved && typeof window.apexCornerFor === 'function'
        ? window.apexCornerFor(resolved.key)
        : null;

    const credit = photo
      ? `PHOTO — ${String(photo.corner || '').toUpperCase()} · ${photo.license || 'CC'} · ${photo.credit || ''}`.trim()
      : '';

    if (panel) panel.classList.toggle('has-photo', Boolean(photo));

    const paintEventPhoto = () => {
      const node = document.getElementById('event-photo');
      if (!node) return;
      if (photo) {
        if (node.getAttribute('src') !== photo.url) node.setAttribute('src', photo.url);
        const alt = `${photo.corner || 'Circuit corner'} — ${resolved.name}`;
        if (node.alt !== alt) node.alt = alt;
        if (node.hidden) node.hidden = false;
      } else if (!node.hidden) {
        node.hidden = true;
      }
    };


    paintEventPhoto();
    const setCredit = (id) => {
      const node = document.getElementById(id);
      if (node && node.textContent !== credit) node.textContent = credit;
    };

    setCredit('event-credit');
  }

  /** Stint history + pit stops from GET /f1/tyres. */
  function renderTyres(result) {
    const rows = document.getElementById('tyre-rows');
    if (!rows) return;

    if (!result || !Array.isArray(result.drivers) || result.drivers.length === 0) {
      if (rows.dataset.stamp === 'empty') return;
      rows.dataset.stamp = 'empty';
      rows.innerHTML = '<p class="kicker">Tyre data unavailable for this session.</p>';
      return;
    }

    // The MutationObserver calls this on every re-render; without a stamp the
    // innerHTML write below would retrigger the observer forever.
    const stamp = `${result.updatedAt}:${result.drivers.length}:${result.sessionKey}`;
    if (rows.dataset.stamp === stamp) return;
    rows.dataset.stamp = stamp;

    const row = window.apexTyreRow;
    rows.innerHTML = result.drivers
      .map((driver) => (typeof row === 'function' ? row(driver) : ''))
      .join('');

    const circuit = document.getElementById('tyre-circuit');
    if (circuit) circuit.textContent = String(result.circuit || '—').toUpperCase();

    const meta = document.getElementById('tyre-meta');
    if (meta) {
      meta.textContent = `SESSION ${result.sessionKey} — ${result.totalLaps} LAPS — ${
        result.source === 'openf1' ? 'OPENF1' : 'OFFLINE'
      }`;
    }
  }

  /** Next Grand Prix / MotoGP round from GET /:series/schedule. */
  function applySchedule(schedule) {
    const bar = document.getElementById('next-race');
    if (!bar) return;

    const next = schedule && schedule.next;
    if (!next) {
      if (bar.style.display !== 'none') bar.style.display = 'none';
      return;
    }

    if (bar.style.display === 'none') bar.style.display = '';
    const set = (id, text) => {
      const node = document.getElementById(id);
      if (node && node.textContent !== text) node.textContent = text;
    };

    set('next-name', String(next.name || 'NEXT RACE').toUpperCase());
    const where = [next.circuit, next.locality || next.country].filter(Boolean).join(' — ');
    set('next-circuit', where.toUpperCase());

    const start = next.startsAt
      ? new Date(next.startsAt)
      : next.date
        ? new Date(`${next.date}T00:00:00Z`)
        : null;
    const valid = start && !Number.isNaN(start.getTime());

    set(
      'next-date',
      valid
        ? start
            .toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              timeZone: 'UTC',
            })
            .toUpperCase()
        : String(next.date || 'TBC'),
    );

    let countdown = 'TBC';
    if (next.status === 'live') {
      countdown = 'LIVE NOW';
    } else if (valid) {
      const diff = start.getTime() - Date.now();
      if (diff <= 0) {
        countdown = 'COMPLETED';
      } else {
        const days = Math.floor(diff / 86_400_000);
        const hours = Math.floor((diff % 86_400_000) / 3_600_000);
        const minutes = Math.floor((diff % 3_600_000) / 60_000);
        countdown =
          days > 0
            ? `IN ${days}D ${String(hours).padStart(2, '0')}H`
            : `IN ${hours}H ${String(minutes).padStart(2, '0')}M`;
      }
    }
    set('next-countdown', countdown);

    // Country flag next to the race name (flagcdn.com, no key required).
    const flag = document.getElementById('next-flag');
    if (flag) {
      const code = next.countryCode ? String(next.countryCode).toLowerCase() : '';
      if (code) {
        const src = `https://flagcdn.com/w40/${code}.png`;
        if (flag.getAttribute('src') !== src) flag.setAttribute('src', src);
        const alt = next.country || 'Race country';
        if (flag.alt !== alt) flag.alt = alt;
        if (flag.hidden) flag.hidden = false;
      } else if (!flag.hidden) {
        flag.hidden = true;
      }
    }

    // Every write here re-triggers the MutationObserver, which calls this
    // function again — so the label must only change when it really differs.
    const label = bar.querySelector('.kicker');
    const labelText = next.status === 'live' ? 'RACE WEEKEND — LIVE' : 'NEXT RACE';
    if (label && label.textContent !== labelText) label.textContent = labelText;
  }

  async function loadSeriesExtras(seriesKey) {
    const series = String(seriesKey || 'f1').toLowerCase();

    const [overview, predictions, schedule] = await Promise.allSettled([
      api(`/overview/live?series=${series}`),
      api(`/overview/predictions?series=${series}`),
      api(`/${series}/schedule`),
    ]);

    if (schedule.status === 'fulfilled') {
      state.schedule = schedule.value;
      applySchedule(schedule.value);
    } else {
      console.warn('[apex] schedule fallback:', schedule.reason?.message || schedule.reason);
    }

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
          `${entry.code}-${entry.driverNumber}`,
          String(entry.fullName).split(' ').slice(-1)[0],
          Math.round(entry.winProbability),
        ]);
        if (typeof window.apexRender === 'function') window.apexRender();
      }
    } else {
      console.warn('[apex] predictions fallback:', predictions.reason?.message || predictions.reason);
    }

    if (series === 'f1') {
      try {
        const tyres = await api('/f1/tyres');
        state.tyres = tyres;
        renderTyres(tyres);
      } catch (error) {
        console.warn('[apex] tyre fallback:', error?.message || error);
      }
    }
  }

  function connect(seriesKey) {
    const series = String(seriesKey || 'f1').toUpperCase();
    const myGeneration = ++generation;

    state.series = series;
    state.frames = [];
    state.live = null;
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
        // Do not claim "LIVE" before the server has told us a session is on.
        setStatus(`CONNECTED / ${message.series}`, '');
        return;
      }

      if (message.type === 'telemetry.snapshot' && Array.isArray(message.frames)) {
        // The backend only sends frames while a session is actually running.
        const live = message.live === true && message.frames.length > 0;
        state.live = live;
        state.frames = live ? message.frames : [];
        state.connected = true;
        renderStrip();
        setStatus(
          live ? `LIVE / ${message.series} / ${message.sampleRateHz} HZ` : 'NO LIVE SESSION',
          live ? 'ok' : '',
        );
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
    await Promise.all([loadStandings(), loadConstructorStandings(), loadSeriesExtras('f1')]);

    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      loadStandings().catch(() => {});
      loadConstructorStandings().catch(() => {});
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
    renderTyres(state.tyres);
    applySchedule(state.schedule);
  });
  observer.observe(document.getElementById('content') || document.body, {
    childList: true,
    subtree: true,
  });

  document.addEventListener('apex:series', (event) => {
    connect(event.detail);
    loadSeriesExtras(event.detail).catch(() => {});
    loadConstructorStandings().catch(() => {});
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
    loadConstructorStandings().catch(() => {});
    loadSeriesExtras(state.series).catch(() => {});
  }, 2_000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
