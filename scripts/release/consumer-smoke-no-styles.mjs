import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Separate consumer, sharing only the parent's installed tarball dependencies.
// CSS is explicitly supplied by this application from a normal packed-CLI run;
// init/add stay --no-styles throughout. This is not arbitrary replacement-CSS proof.
export function runNoStylesConsumer({ consumerDir, cli, fixtureDir, run }) {
  const root = join(consumerDir, 'no-styles');
  mkdirSync(root);
  const parentPackage = JSON.parse(readFileSync(join(consumerDir, 'package.json'), 'utf8'));
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: 'no-styles-consumer',
        private: true,
        type: 'module',
        dependencies: parentPackage.dependencies,
        devDependencies: parentPackage.devDependencies,
      },
      null,
      2
    )}\n`
  );
  run(process.execPath, [cli, 'init', '--yes', '--no-interactive', '--no-styles'], { cwd: root });
  for (const component of ['base-button', 'base-switch', 'shadcn-switch']) {
    run(process.execPath, [cli, 'add', 'react', component, '--no-install', '--no-interactive'], {
      cwd: root,
    });
  }
  const assertNoGeneratedStyles = () => {
    const config = JSON.parse(readFileSync(join(root, 'proto-ui', 'config.json'), 'utf8'));
    if (config.styles.enabled !== false || existsSync(join(root, 'src', 'styles'))) {
      throw new Error('no-styles consumer: init/add unexpectedly enabled or generated styles');
    }
  };
  assertNoGeneratedStyles();
  run(
    process.execPath,
    [
      join(consumerDir, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--noEmit',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--target',
      'ES2022',
      '--jsx',
      'react-jsx',
      'proto-ui/components/react/index.ts',
    ],
    { cwd: root }
  );
  console.log('no-styles consumer: generation stays disabled + generated facade types ok');
  cpSync(join(fixtureDir, 'consumer-smoke', 'no-styles.mjs'), join(root, 'smoke.mjs'));
  cpSync(join(fixtureDir, 'consumer-smoke-css.mjs'), join(root, 'consumer-smoke-css.mjs'));
  cpSync(join(consumerDir, 'src', 'styles'), join(root, 'consumer-owned-styles'), {
    recursive: true,
  });
  run(process.execPath, ['--import', 'tsx', './smoke.mjs'], { cwd: root });
  assertNoGeneratedStyles();
}
