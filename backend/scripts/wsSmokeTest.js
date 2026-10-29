/* eslint-disable no-console */
/**
 * WebSocket smoke test.
 *   node scripts/wsSmokeTest.js [ws://localhost:4000/ws/telemetry]
 *
 * Verifies the feed frequency (2 Hz), frame shape, ping/pong and series
 * subscription switching. Exits non-zero on failure.
 */
const WebSocket = require('ws');

const url = process.argv[2] ?? 'ws://localhost:4000/ws/telemetry?series=f1';
const socket = new WebSocket(url);

const arrivals = [];
let snapshots = 0;
let subscribed = false;
let failed = false;

function fail(message) {
  failed = true;
  console.error(`✖ ${message}`);
  socket.close();
  process.exit(1);
}

socket.on('open', () => console.log(`→ connected to ${url}`));

socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString());

  if (message.type === 'connected') {
    console.log(`✔ handshake: series=${message.series} rate=${message.sampleRateHz}Hz`);
    socket.send(JSON.stringify({ type: 'ping' }));
    return;
  }

  if (message.type === 'pong') {
    console.log('✔ ping/pong');
    return;
  }

  if (message.type === 'subscribed') {
    subscribed = true;
    console.log(`✔ subscribed to ${message.series}`);
    return;
  }

  if (message.type !== 'telemetry.snapshot') return;

  snapshots += 1;
  arrivals.push(Date.now());

  if (snapshots === 1) {
    const frame = message.frames[0];
    if (!frame || typeof frame.speed !== 'number' || typeof frame.gear !== 'number') {
      fail('snapshot frames are malformed');
      return;
    }
    console.log(
      `✔ snapshot #${message.seq}: ${message.frames.length} frames, first=${frame.code} ${frame.speed}kph gear ${frame.gear} thr ${frame.throttle}%`,
    );
    socket.send(JSON.stringify({ type: 'subscribe', series: 'motogp' }));
    return;
  }

  if (!subscribed) {
    fail('subscribe acknowledgement never arrived');
    return;
  }
  if (message.series !== 'MOTOGP') {
    fail(`expected MOTOGP after subscribe, received ${message.series}`);
    return;
  }

  if (snapshots === 5) {
    const deltas = arrivals.slice(1).map((time, index) => time - arrivals[index]);
    const average = deltas.reduce((total, value) => total + value, 0) / deltas.length;
    console.log(`✔ intervals: ${deltas.join('ms, ')}ms (avg ${average.toFixed(0)}ms)`);

    if (average < 350 || average > 700) {
      fail(`broadcast interval out of range: ${average.toFixed(0)}ms`);
      return;
    }

    console.log('✔ WebSocket feed healthy — ~2 snapshots/second');
    socket.close();
    process.exit(failed ? 1 : 0);
  }
});

socket.on('error', (error) => fail(error.message));

setTimeout(() => fail('timed out waiting for telemetry snapshots'), 10_000);
