import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const errors = (items) => items.map((error) => String(error?.stack ?? error?.message ?? error));

// Vitest 2.1.9's JSON reporter omits unhandled errors. Its close() also logs
// rejected resource cleanup instead of rejecting. Observe both without changing
// runner behavior, and seal the receipt only when the process actually exits.
export default class DialogRunIntegrityReporter {
  onInit(ctx) {
    this.ctx = ctx;
    this.output = process.env.PROTO_UI_DIALOG_INTEGRITY_PATH;
    this.jsonPath = process.env.PROTO_UI_DIALOG_JSON_PATH;
    if (!this.output || !this.jsonPath) throw new Error('Missing Dialog integrity output paths');
    this.receipt = {
      schemaVersion: 1,
      vitestVersion: ctx.version,
      reporterSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
      phase: 'initialized',
      finishedCalls: 0,
      closeStarted: false,
      closeFinished: false,
      processTimedOut: false,
      runnerErrors: [],
      unhandledErrors: [],
      files: [],
    };
    this.write();
    const close = ctx.close.bind(ctx);
    ctx.close = async (...args) => {
      this.receipt.closeStarted = true;
      try {
        const result = await close(...args);
        this.receipt.closeFinished = true;
        return result;
      } catch (error) {
        this.recordRunnerErrors([error]);
        throw error;
      } finally {
        this.write();
      }
    };
    const logError = ctx.logger.error.bind(ctx.logger);
    ctx.logger.error = (...args) => {
      if (this.receipt.closeStarted) this.recordRunnerErrors(args);
      return logError(...args);
    };
    const printError = ctx.logger.printError.bind(ctx.logger);
    ctx.logger.printError = (error, options) => {
      // Expected assertion errors carry their task. Startup, reporter and main
      // process rejection errors do not necessarily enter state.getUnhandledErrors().
      if (this.receipt.closeStarted || !options?.task) this.recordRunnerErrors([error]);
      return printError(error, options);
    };
    process.on('uncaughtExceptionMonitor', (error) => {
      this.recordRunnerErrors([error]);
    });
    process.once('exit', (exitCode) => {
      this.receipt.phase = 'process-exit';
      this.receipt.exitCode = exitCode;
      this.receipt.cancelled = ctx.isCancelling;
      this.receipt.unhandledErrors = [
        ...new Set([...this.receipt.unhandledErrors, ...errors(ctx.state.getUnhandledErrors())]),
      ];
      // Missing JSON (including a failed reporter) must not produce a sealed receipt.
      this.receipt.reportSha256 = sha256(fs.readFileSync(this.jsonPath));
      this.write();
    });
  }

  recordRunnerErrors(items) {
    this.receipt.runnerErrors.push(...errors(items));
    // A later exit listener can fail after our exit snapshot was written. No
    // event-loop turn remains then: invalidate the on-disk receipt synchronously.
    this.write();
  }

  write() {
    fs.mkdirSync(path.dirname(this.output), { recursive: true });
    fs.writeFileSync(this.output, JSON.stringify(this.receipt, null, 2));
  }

  onFinished(files, unhandledErrors) {
    this.receipt.phase = 'reported';
    this.receipt.finishedCalls++;
    this.receipt.unhandledErrors = errors(unhandledErrors);
    this.receipt.files = files.map((file) => {
      const suiteErrors = [];
      const visit = (suite) => {
        suiteErrors.push(...errors(suite.result?.errors ?? []));
        for (const task of suite.tasks ?? []) if (task.type === 'suite') visit(task);
      };
      visit(file);
      return {
        path: path.relative(this.ctx.config.root, file.filepath).split(path.sep).join('/'),
        state: file.result?.state,
        suiteErrors,
      };
    });
    this.write();
  }

  onProcessTimeout() {
    this.receipt.processTimedOut = true;
    this.write();
  }
}
