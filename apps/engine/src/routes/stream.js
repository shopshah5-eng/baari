'use strict';
/* SSE: desk, cabin and TV subscribe instead of polling every 5s. */
const S = require('../store');
const RT = require('../realtime');
const Q = require('../queue');

module.exports = function mount(app, buildState) {
  app.get('/api/:slug/stream', (req, res) => {
    const o = S.org(req.params.slug);
    if (!o) return res.status(404).json({ error: 'no tenant' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
    });
    const send = (event, data) => { try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {} };
    send('state', buildState(o));
    if (!res.locals) res.locals = {};
    const { subscribe } = RT;
    const wrapper = { write: (frame) => { try { res.write(frame); } catch {} } };
    // reuse the hub but bind writes to this response
    subscribe(o.id, wrapper, 'state');
    const tick = setInterval(() => { Q.recalc(o); send('state', buildState(o)); }, 10000);
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
    req.on('close', () => { clearInterval(tick); clearInterval(ping); });
  });
};
