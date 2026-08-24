import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// The Remotion engine source (remotion/src) lives two levels up from apps/web, at the
// monorepo root. The webapp imports the spec-driven template + shared engine libs
// (spec-renderer, shorts captions, brand, fonts) directly for the in-browser Player.
const remotionSrc = path.join(here, '..', '..', '..', 'remotion', 'src');
// Force a single `remotion` module instance. The engine files under @engine import
// `remotion` directly; @remotion/player also depends on `remotion`. If webpack bundles
// two copies (which happens when @engine lives outside the app root), the Player's
// context (useCurrentFrame etc.) is invisible to the engine and rendering crashes.
const remotionPkg = path.dirname(fileURLToPath(import.meta.resolve('remotion/package.json')));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @shorts/db and @shorts/spec are workspace packages (TypeScript sources compiled
  // by Next's SWC at build time) — they must be transpiled here.
  transpilePackages: ['@shorts/db', '@shorts/spec'],
  // Keep Node-only CJS deps out of the webpack bundle so they're require()'d natively.
  // - pg: the Postgres driver (Node sockets)
  // - nodemailer: Auth.js Email provider transport (CJS default-export interop breaks
  //   under webpack bundling: "createTransport is not a function")
  serverExternalPackages: ['pg', 'nodemailer'],
  // Multiple lockfiles exist up-tree (the shorts-factory repo root) — pin tracing to the
  // webapp so Next doesn't pick the wrong workspace root.
  outputFileTracingRoot: path.join(here, '..', '..'),
  webpack: (config) => {
    // Let the web app import the spec-driven template and the shared engine libs
    // (spec-renderer / shorts captions / brand / fonts) from the Remotion project.
    config.resolve.alias['@engine'] = remotionSrc;
    config.resolve.alias['remotion'] = remotionPkg;
    return config;
  },
};

export default nextConfig;
