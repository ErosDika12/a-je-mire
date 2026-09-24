import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Pas build-it, ndërtojmë service worker-in me listën e saktë të fajllave të guaskës.
// Çdo build jep një version tjetër, dhe kjo është ajo që shfaq njoftimin "Ka një version të ri".
function serviceWorker() {
  return {
    name: 'ajm-service-worker',
    apply: 'build',
    generateBundle(options, bundle) {
      const built = Object.keys(bundle).filter(name => /\.(js|css|html)$/.test(name)).map(name => `/${name}`);
      const shell = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png',
        ...built.filter(name => name !== '/index.html')];
      const version = createHash('sha256').update(built.sort().join('|')).digest('hex').slice(0, 12);
      const source = readFileSync('pwa/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__SHELL__', JSON.stringify([...new Set(shell)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    }
  };
}

export default defineConfig({
  build: {
    outDir: 'dist', sourcemap: false, target: 'es2020',
    // Libraria e Supabase në pjesë të veçantë: ndryshon rrallë, prandaj mbetet në cache mes versioneve.
    rollupOptions: { output: { manualChunks: id => (id.includes('node_modules') ? 'vendor' : undefined) } }
  },
  server: { port: 5173 },
  plugins: [serviceWorker()]
});
