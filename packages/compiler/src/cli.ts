import fs from 'node:fs';
import path from 'node:path';
import { createCompiler } from './compiler';
import { formatDiagnostics } from './diagnostics';
import { detectLlvmToolchain } from './llvm';

export interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function parseFlag(args: readonly string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

export function runCompilerCli(argv: readonly string[]): CliResult {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    return {
      exitCode: 0,
      stdout: [
        'Usage: proto-compiler <command> <entry> [options]',
        '',
        'Commands:',
        '  check   <entry>   Typecheck and verify Proto SSA IR (+ LLVM IR if installed)',
        '  compile <entry>   Emit thin React TypeScript (+ optional --out <dir> and --wasm)',
        '  ir      <entry>   Print optimized Proto SSA IR (.pir)',
        '  llvm    <entry>   Print verified/optimized LLVM IR (.ll)',
        '  info              Print compiler & LLVM toolchain status',
        '',
        'Options:',
        '  --root <dir>      Workspace root directory',
        '  --export <name>   Specific prototype export name',
        '  --out <dir>       Output directory for compile artifacts',
        '  --optimize        Run LLVM opt -passes=verify,default<O2>',
        '  --wasm            Emit compiled WebAssembly kernel via LLVM llc + wasm-ld',
        '  --json            Emit structured JSON output',
        '',
      ].join('\n'),
      stderr: '',
    };
  }

  if (command === 'info') {
    const llvm = detectLlvmToolchain();
    return {
      exitCode: 0,
      stdout:
        JSON.stringify({ compiler: '@proto.ui/compiler', irVersion: 2, llvm }, null, 2) + '\n',
      stderr: '',
    };
  }

  const entry = rest.find((a) => !a.startsWith('-'));
  if (!entry) {
    return { exitCode: 2, stdout: '', stderr: `Missing entry file for '${command}'.\n` };
  }

  const rootDir = parseFlag(rest, '--root');
  const exportName = parseFlag(rest, '--export');
  const outDir = parseFlag(rest, '--out');
  const json = rest.includes('--json');
  const optimize = rest.includes('--optimize');
  const emitWasm = rest.includes('--wasm');

  const compiler = createCompiler({ rootDir });
  const res = compiler.compileFile(entry, {
    exportName,
    allowHookOnly: command === 'check',
    llvm: {
      verify: true,
      optimize: optimize ? 'O2' : false,
      emitWasm,
    },
  });

  if (!res.ok) {
    return {
      exitCode: 1,
      stdout: json
        ? JSON.stringify({ ok: false, diagnostics: res.diagnostics }, null, 2) + '\n'
        : '',
      stderr: json ? '' : formatDiagnostics(res.diagnostics) + '\n',
    };
  }

  const out = res.value;

  if (command === 'ir') {
    return { exitCode: 0, stdout: out.irText, stderr: '' };
  }

  if (command === 'llvm') {
    return { exitCode: 0, stdout: out.llvm.optimizedIr ?? out.llvm.ir, stderr: '' };
  }

  if (command === 'check') {
    const summary = {
      ok: true,
      sourceFile: out.sourceFile,
      prototypes: out.prototypes.map((p) => ({
        name: p.name,
        exportName: p.exportName,
        tier: p.tier,
        reactLines: p.react.code.split('\n').length,
      })),
      llvmVerified: out.llvm.verified,
      llvmVersion: out.llvm.toolchainVersion,
      elapsedMs: Number(out.elapsedMs.toFixed(2)),
    };
    return {
      exitCode: 0,
      stdout: JSON.stringify(summary, null, 2) + '\n',
      stderr: '',
    };
  }

  if (command === 'compile') {
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      const written: string[] = [];
      for (const p of out.prototypes) {
        const tsxPath = path.join(outDir, `${p.react.componentName}.tsx`);
        fs.writeFileSync(tsxPath, p.react.code, 'utf8');
        written.push(tsxPath);
      }
      const llPath = path.join(outDir, `${out.primary?.react.componentName ?? 'module'}.ll`);
      fs.writeFileSync(llPath, out.llvm.optimizedIr ?? out.llvm.ir, 'utf8');
      written.push(llPath);
      if (out.llvm.wasm) {
        const wasmPath = path.join(outDir, `${out.primary?.react.componentName ?? 'module'}.wasm`);
        fs.writeFileSync(wasmPath, out.llvm.wasm);
        written.push(wasmPath);
      }
      return {
        exitCode: 0,
        stdout: json
          ? JSON.stringify({ ok: true, written, elapsedMs: out.elapsedMs }, null, 2) + '\n'
          : written.map((f) => `wrote ${f}`).join('\n') + '\n',
        stderr: '',
      };
    }
    return {
      exitCode: 0,
      stdout: out.primary ? out.primary.react.code : out.irText,
      stderr: '',
    };
  }

  return { exitCode: 2, stdout: '', stderr: `Unknown command '${command}'.\n` };
}
