import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The TTF files live outside the bundle and are read with `fs` at runtime, so
  // the file tracer has to be told about them explicitly.
  outputFileTracingIncludes: {
    '/api/**': ['./fonts/**'],
  },
};

export default nextConfig;
