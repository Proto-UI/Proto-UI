import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

const SPEC_SOURCE_PATTERN = /\.ya?ml$/i;
const WATCH_DEBOUNCE_MS = 100;
const appDir = fileURLToPath(new URL('.', import.meta.url));
const specDir = path.resolve(appDir, '../../spec');
const generatorPath = path.join(appDir, 'scripts/generate-spec-dataset.ts');
const execFileAsync = promisify(execFile);

function isSpecSource(filePath: string) {
  const relativePath = path.relative(specDir, filePath);
  return (
    relativePath !== '' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    relativePath !== '..' &&
    !path.isAbsolute(relativePath) &&
    SPEC_SOURCE_PATTERN.test(relativePath)
  );
}

function specDatasetPlugin(): Plugin {
  return {
    name: 'proto-ui-spec-dataset',
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let regeneration = Promise.resolve();

      server.watcher.add(specDir);

      const scheduleRegeneration = (event: string, filePath: string) => {
        if (!['add', 'change', 'unlink'].includes(event) || !isSpecSource(filePath)) return;

        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          regeneration = regeneration.then(async () => {
            try {
              const { stdout, stderr } = await execFileAsync(
                process.execPath,
                ['--import', 'tsx', generatorPath],
                { cwd: appDir }
              );
              if (stdout.trim()) server.config.logger.info(stdout.trim());
              if (stderr.trim()) server.config.logger.warn(stderr.trim());
              server.ws.send({ type: 'full-reload', path: '*' });
            } catch (error) {
              const message =
                error instanceof Error ? (error.stack ?? error.message) : String(error);
              server.config.logger.error(
                `[spec] failed to regenerate workspace dataset\n${message}`
              );
            }
          });
        }, WATCH_DEBOUNCE_MS);
      };

      server.watcher.on('all', scheduleRegeneration);
      server.httpServer?.once('close', () => {
        if (timer) clearTimeout(timer);
        server.watcher.off('all', scheduleRegeneration);
      });
    },
  };
}

export default defineConfig({
  plugins: [specDatasetPlugin()],
});
