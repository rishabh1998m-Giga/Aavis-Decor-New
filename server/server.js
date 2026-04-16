#!/usr/bin/env node
// Entry point for PM2 / Passenger — loads the compiled Fastify app.
// dist/index.js is ESM and self-starts (calls main() on load).
import './dist/index.js';
