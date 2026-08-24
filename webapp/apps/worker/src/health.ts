// Tiny fastify /health server on PORT (default 3100).
import Fastify from 'fastify';

export function startHealthServer(port: number) {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ ok: true, service: 'worker', ts: Date.now() }));

  app.listen({ port, host: '127.0.0.1' }).then(() => {
    console.log(`[worker] health on http://127.0.0.1:${port}/health`);
  });

  return app;
}
