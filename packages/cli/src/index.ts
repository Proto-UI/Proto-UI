import { runAddCommand } from './commands/add.js';
import { printHelp, printCommandHelp } from './commands/help.js';
import { runInitCommand } from './commands/init.js';
import {
  runLegacyStyleCommand,
  STYLE_COMMANDS,
  STYLE_PRESET_NAMES,
} from './services/legacy-styles.js';
import { isHelpToken, parseArgv } from './utils/args.js';

export async function run(argv: string[]): Promise<void> {
  const { options, positionals } = parseArgv(argv);
  const [command, ...rest] = positionals;

  if (!command || isHelpToken(command)) {
    printHelp();
    return;
  }

  if (
    Object.hasOwn(options, 'shadow-out') &&
    !['tokens', 'shadcn', 'brutalist'].includes(command)
  ) {
    throw new Error('--shadow-out is supported only by tokens, shadcn, and brutalist');
  }

  if (command === 'init') {
    if (rest.some(isHelpToken) || options.help === true || options.h === true) {
      printCommandHelp('init');
      return;
    }
    await runInitCommand(argv.slice(1));
    return;
  }

  if (command === 'add') {
    if (rest.some(isHelpToken) || options.help === true || options.h === true) {
      printCommandHelp('add');
      return;
    }
    await runAddCommand(argv.slice(1));
    return;
  }

  if (STYLE_COMMANDS.has(command) || STYLE_PRESET_NAMES.has(command)) {
    await runLegacyStyleCommand(argv);
    return;
  }

  throw new Error(`unknown command "${command}". Run "proto-ui --help" for usage.`);
}
