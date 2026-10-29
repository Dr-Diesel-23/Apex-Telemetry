import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { Series } from '@prisma/client';
import { env } from '../config/env';
import { prisma, safeQuery } from '../config/prisma';
import { REFERENCE_DRIVERS, referenceIds } from '../config/referenceData';
import { parseSeriesParam, SERIES_LABELS } from '../config/series';
import { teamColor } from '../config/teamColors';
import { getLiveTelemetryFrames } from '../services/liveSession.service';
import { simulateFrame } from '../services/simulation.service';
import { logger } from '../utils/logger';

interface RosterDriver {
  driverId: string;
  driverNumber: number;
  code: string;
  fullName: string;
  teamName: string;
  teamColor: string;
  series: Series;
}

interface ClientMeta {
  id: string;
  series: Series | null;
  isAlive: boolean;
}

interface TelemetryFrame {
  driverId: string;
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  teamColor: string;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
  timestamp: string;
  /** Race position when the frame comes from a real timing feed. */
  position?: number;
  /** Compound fitted when the frame comes from a real timing feed. */
  tyre?: {
    compound: string;
    compoundLabel: string;
    colorHex: string;
    textColor: string;
    laps: number;
  };
}

export interface TelemetrySocketHandle {
  wss: WebSocketServer;
  close: () => Promise<void>;
  clientCount: () => number;
}

const ROSTER_TTL_MS = 60_000;

let roster: Record<Series, RosterDriver[]> = buildReferenceRoster();
let rosterLoadedAt = 0;
let defaultSeries: Series = Series.F1;
let sequence = 0;
let handle: TelemetrySocketHandle | null = null;

function buildReferenceRoster(): Record<Series, RosterDriver[]> {
  const grouped: Record<Series, RosterDriver[]> = { F1: [], F2: [], MOTOGP: [] };

  for (const driver of REFERENCE_DRIVERS) {
    grouped[driver.series].push({
      driverId: referenceIds.driver(driver.code),
      driverNumber: driver.driverNumber,
      code: driver.code,
      fullName: driver.fullName,
      teamName: driver.teamName,
      teamColor: teamColor(driver.teamName),
      series: driver.series,
    });
  }

  return grouped;
}

function groupDrivers(
  rows: Array<{
    id: string;
    driverNumber: number;
    code: string;
    fullName: string;
    teamName: string;
    series: Series;
  }>,
): Record<Series, RosterDriver[]> {
  const grouped: Record<Series, RosterDriver[]> = { F1: [], F2: [], MOTOGP: [] };

  for (const row of rows) {
    grouped[row.series].push({
      driverId: row.id,
      driverNumber: row.driverNumber,
      code: row.code,
      fullName: row.fullName,
      teamName: row.teamName,
      teamColor: teamColor(row.teamName),
      series: row.series,
    });
  }

  return grouped;
}

async function refreshRoster(force = false): Promise<void> {
  if (!force && Date.now() - rosterLoadedAt < ROSTER_TTL_MS) return;

  const { data } = await safeQuery(
    'ws.roster',
    async () => {
      const [drivers, activeSession] = await Promise.all([
        prisma.driver.findMany({ orderBy: [{ series: 'asc' }, { points: 'desc' }] }),
        prisma.session.findFirst({
          where: { isActive: true },
          orderBy: { startTime: 'desc' },
          select: { series: true },
        }),
      ]);
      return { drivers, activeSeries: activeSession?.series ?? null };
    },
    () => ({ drivers: [], activeSeries: null as Series | null }),
  );

  if (data.drivers.length > 0) {
    roster = groupDrivers(data.drivers);
    defaultSeries = data.activeSeries ?? Series.F1;
  } else {
    roster = buildReferenceRoster();
    defaultSeries = Series.F1;
  }

  rosterLoadedAt = Date.now();
}

function buildFrames(series: Series, at: number): TelemetryFrame[] {
  return roster[series].map((driver) => {
    const frame = simulateFrame(driver.code, series, at);
    return {
      driverId: driver.driverId,
      code: driver.code,
      driverNumber: driver.driverNumber,
      fullName: driver.fullName,
      teamName: driver.teamName,
      teamColor: driver.teamColor,
      speed: frame.speed,
      rpm: frame.rpm,
      gear: frame.gear,
      throttle: frame.throttle,
      brake: frame.brake,
      drs: frame.drs,
      timestamp: frame.timestamp,
    };
  });
}

function seriesFromRequest(req: IncomingMessage): Series | null {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return parseSeriesParam(url.searchParams.get('series') ?? undefined);
}

export function attachTelemetryWebSocket(server: Server): TelemetrySocketHandle {
  if (handle) return handle;

  const wss = new WebSocketServer({
    server,
    path: env.WS_PATH,
    clientTracking: true,
    maxPayload: 16 * 1024,
  });

  const meta = new WeakMap<WebSocket, ClientMeta>();

  wss.on('connection', (socket, req) => {
    const clientId = `ws_${Math.random().toString(36).slice(2, 10)}`;
    const requestedSeries = seriesFromRequest(req);
    const series = requestedSeries ?? defaultSeries;

    meta.set(socket, { id: clientId, series: requestedSeries, isAlive: true });

    socket.send(
      JSON.stringify({
        type: 'connected',
        clientId,
        series,
        seriesLabel: SERIES_LABELS[series],
        sampleRateHz: env.wsBroadcastHz,
        availableSeries: Object.keys(SERIES_LABELS),
        message:
          'Send {"type":"subscribe","series":"f1|f2|motogp"} to switch feeds, or {"type":"ping"}.',
        timestamp: new Date().toISOString(),
      }),
    );

    socket.on('pong', () => {
      const state = meta.get(socket);
      if (state) state.isAlive = true;
    });

    socket.on('message', (raw) => {
      const state = meta.get(socket);
      if (!state) return;

      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Messages must be valid JSON.' }));
        return;
      }

      const message = payload as { type?: string; series?: string };

      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        return;
      }

      if (message.type === 'subscribe') {
        const parsed = parseSeriesParam(message.series);
        if (!parsed) {
          socket.send(
            JSON.stringify({
              type: 'error',
              message: `Unknown series '${message.series ?? ''}'. Use f1, f2 or motogp.`,
            }),
          );
          return;
        }
        state.series = parsed;
        socket.send(
          JSON.stringify({
            type: 'subscribed',
            series: parsed,
            seriesLabel: SERIES_LABELS[parsed],
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'error',
          message: 'Unsupported message type. Use "subscribe" or "ping".',
        }),
      );
    });

    socket.on('close', () => {
      meta.delete(socket);
    });

    socket.on('error', (error) => {
      logger.warn('ws.client_error', { clientId, message: error.message });
    });

    logger.info('ws.client_connected', {
      clientId,
      series,
      clients: wss.clients.size,
    });
  });

  void refreshRoster(true);
  const rosterTimer = setInterval(() => {
    void refreshRoster();
  }, ROSTER_TTL_MS);
  rosterTimer.unref();

  let broadcasting = false;

  const broadcastTimer = setInterval(() => {
    if (wss.clients.size === 0 || broadcasting) return;

    broadcasting = true;

    void (async () => {
      try {
        const at = Date.now();
        const seq = (sequence += 1);
        const cacheBySeries = new Map<Series, TelemetryFrame[]>();
        const sourceBySeries = new Map<Series, 'openf1' | 'simulation' | 'idle'>();

        for (const socket of wss.clients) {
          if (socket.readyState !== WebSocket.OPEN) continue;

          const state = meta.get(socket);
          const series = state?.series ?? defaultSeries;

          let frames = cacheBySeries.get(series);
          if (!frames) {
            // Real timing only while the session is actually running. With no
            // live session the feed is empty and the dashboard says so.
            const live = series === Series.F1 ? await getLiveTelemetryFrames(series) : null;
            frames = live ?? (env.SIMULATED_TELEMETRY ? buildFrames(series, at) : []);
            cacheBySeries.set(series, frames);
            sourceBySeries.set(series, live ? 'openf1' : frames.length ? 'simulation' : 'idle');
          }

          socket.send(
            JSON.stringify({
              type: 'telemetry.snapshot',
              seq,
              series,
              seriesLabel: SERIES_LABELS[series],
              sampleRateHz: env.wsBroadcastHz,
              source: sourceBySeries.get(series),
              /** True only when these frames came from a running session. */
              live: sourceBySeries.get(series) === 'openf1',
              timestamp: new Date(at).toISOString(),
              frames,
            }),
          );
        }
      } finally {
        broadcasting = false;
      }
    })();
  }, env.WS_BROADCAST_INTERVAL_MS);
  broadcastTimer.unref();

  const heartbeatTimer = setInterval(() => {
    for (const socket of wss.clients) {
      const state = meta.get(socket);
      if (!state) continue;
      if (!state.isAlive) {
        logger.warn('ws.client_terminated', { clientId: state.id, reason: 'heartbeat_timeout' });
        socket.terminate();
        continue;
      }
      state.isAlive = false;
      socket.ping();
    }
  }, 30_000);
  heartbeatTimer.unref();

  wss.on('error', (error) => {
    logger.error('ws.server_error', { message: error.message });
  });

  handle = {
    wss,
    clientCount: () => wss.clients.size,
    close: async () => {
      clearInterval(broadcastTimer);
      clearInterval(heartbeatTimer);
      clearInterval(rosterTimer);

      for (const socket of wss.clients) socket.close(1001, 'server shutting down');

      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
        setTimeout(resolve, 2_000).unref();
      });

      handle = null;
    },
  };

  logger.info('ws.server_ready', {
    path: env.WS_PATH,
    broadcastIntervalMs: env.WS_BROADCAST_INTERVAL_MS,
    sampleRateHz: env.wsBroadcastHz,
  });

  return handle;
}

export function telemetrySocketStats(): {
  path: string;
  clients: number;
  sampleRateHz: number;
  defaultSeries: Series;
} {
  return {
    path: env.WS_PATH,
    clients: handle?.clientCount() ?? 0,
    sampleRateHz: env.wsBroadcastHz,
    defaultSeries,
  };
}
