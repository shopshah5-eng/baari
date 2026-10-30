'use strict';
/* Server-Sent Events hub: desk, cabin, TV subscribe instead of polling. */
const clients = new Map(); // orgId -> Set(res)

function subscribe(orgId, res, event = 'state') {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  if (!clients.has(orgId)) clients.set(orgId, new Set());
  clients.get(orgId).add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  res.on('close', () => { clearInterval(ping); clients.get(orgId)?.delete(res); });
}

function publish(orgId, event, payload) {
  const set = clients.get(orgId);
  if (!set) return 0;
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  let n = 0;
  for (const res of set) { try { res.write(frame); n++; } catch { set.delete(res); } }
  return n;
}

const count = orgId => (clients.get(orgId) || new Set()).size;

module.exports = { subscribe, publish, count };
