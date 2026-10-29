import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import app from '../src/app';
import {
  attachTelemetryWebSocket,
  type TelemetrySocketHandle,
} from '../src/websocket/telemetry.ws';

let server: http.Server;
let handle: TelemetrySocketHandle;
let baseUrl: string;

interface Envelope {
  type: string;
  [key: string]: unknown;
}

/**
 * Connects and immediately buffers every frame. The listener must be attached
 * before `open` resolves — the server sends its greeting right after the
 * handshake, so a late listener would miss it.
 */
async function connect(query = '') {
  const socket = new WebSocket(`${baseUrl}${query}`);
  const messages: Envelope[] = [];

  socket.on('message', (raw) => {
    messages.push(JSON.parse(raw.toString()) as Envelope);
  });

  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });

  async function waitFor<T extends Envelope>(
    predicate: (message: Envelope) => boolean,
    timeoutMs = 5_000,
  ): Promise<T> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const match = messages.find(predicate);
      if (match) return match as T;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `Timed out waiting for websocket message. Received: ${messages.map((m) => m.type).join(', ')}`,
    );
  }

  return { socket, messages, waitFor };
}

beforeAll(async () => {
  server = http.createServer(app);
  handle = attachTelemetryWebSocket(server);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${port}/ws/telemetry`;
});

afterAll(async () => {
  await handle.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('WebSocket /ws/telemetry', () => {
  it('greets the client with feed metadata', async () => {
    const { socket, waitFor } = await connect('?series=f1');

    const hello = await waitFor<Envelope & { sampleRateHz: number; availableSeries: string[] }>(
      (message) => message.type === 'connected',
    );

    expect(hello.sampleRateHz).toBe(2);
    expect(hello.series).toBe('F1');
    expect(hello.availableSeries).toEqual(['F1', 'F2', 'MOTOGP']);

    socket.close();
  });

  it('broadcasts telemetry snapshots at ~2 Hz with a full grid', async () => {
    const { socket, messages, waitFor } = await connect('?series=f1');

    const first = await waitFor<Envelope & { frames: Array<Record<string, unknown>>; seq: number }>(
      (message) =>
        message.type === 'telemetry.snapshot' && (message.frames as unknown[]).length > 0,
    );

    expect(first.series).toBe('F1');
    expect(first.sampleRateHz).toBe(2);
    expect(first.frames).toHaveLength(6);
    // Simulated frames must never claim to be a live session.
    expect(first.source).toBe('simulation');
    expect(first.live).toBe(false);

    const frame = first.frames[0];
    expect(frame).toMatchObject({
      code: expect.any(String),
      fullName: expect.any(String),
      speed: expect.any(Number),
      rpm: expect.any(Number),
      gear: expect.any(Number),
      throttle: expect.any(Number),
      brake: expect.any(Number),
      drs: expect.any(Boolean),
      timestamp: expect.any(String),
    });
    expect(frame.teamColor).toMatch(/^#[0-9A-F]{6}$/i);

    // Collect three consecutive snapshots and verify the cadence.
    const arrivals: number[] = [];
    const startedAt = Date.now();
    let lastSeq = first.seq;

    while (arrivals.length < 3 && Date.now() - startedAt < 5_000) {
      const newer = messages.filter(
        (message) => message.type === 'telemetry.snapshot' && (message.seq as number) > lastSeq,
      ) as Array<Envelope & { seq: number }>;

      if (newer.length > 0) {
        lastSeq = newer[newer.length - 1].seq;
        arrivals.push(Date.now());
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(arrivals).toHaveLength(3);
    const gaps = arrivals.slice(1).map((time, index) => time - arrivals[index]);
    const average = gaps.reduce((total, gap) => total + gap, 0) / gaps.length;
    expect(average).toBeGreaterThan(350);
    expect(average).toBeLessThan(750);

    socket.close();
  });

  it('switches feeds on subscribe and answers ping', async () => {
    const { socket, waitFor } = await connect('?series=f1');

    await waitFor((message) => message.type === 'connected');

    socket.send(JSON.stringify({ type: 'subscribe', series: 'motogp' }));
    const subscribed = await waitFor<Envelope & { series: string }>(
      (message) => message.type === 'subscribed',
    );
    expect(subscribed.series).toBe('MOTOGP');

    const snapshot = await waitFor<Envelope & { frames: unknown[] }>(
      (message) => message.type === 'telemetry.snapshot' && message.series === 'MOTOGP',
    );
    expect(snapshot.frames).toHaveLength(5);

    socket.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitFor<Envelope>((message) => message.type === 'pong');
    expect(pong.type).toBe('pong');

    socket.close();
  });

  it('rejects an unsupported series', async () => {
    const { socket, waitFor } = await connect();

    socket.send(JSON.stringify({ type: 'subscribe', series: 'nascar' }));
    const error = await waitFor<Envelope & { message: string }>(
      (message) => message.type === 'error',
    );
    expect(error.message).toContain('Unknown series');

    socket.close();
  });
});
