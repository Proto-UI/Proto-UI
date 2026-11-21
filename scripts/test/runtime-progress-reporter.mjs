// Incremental diagnostic evidence. The ordinary JSON reporter and strict
// runtime gate remain the acceptance authority; a checkpoint never passes it.
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function taskObservation(task, parents = []) {
  const names = [...parents, task.name];
  const result = task.result;
  return {
    name: names.join(' > '),
    kind: task.type,
    status: result?.state ?? (['skip', 'todo'].includes(task.mode) ? task.mode : 'not-run'),
    durationMs: result?.duration ?? null,
    errors: (result?.errors ?? []).map(({ name, message, stack }) => ({ name, message, stack })),
    children: (task.tasks ?? []).map((child) => taskObservation(child, names)),
  };
}

export default class RuntimeProgressReporter {
  onInit(context) {
    this.context = context;
    this.output = process.env.PROTO_UI_RUNTIME_PROGRESS_FILE;
    if (!this.output) throw new Error('Runtime progress reporter requires its own output path');
    this.selection = JSON.parse(readFileSync(process.env.PROTO_UI_RUNTIME_SELECTION_FILE, 'utf8'));
    mkdirSync(path.dirname(this.output), { recursive: true });
    writeFileSync(
      `${this.output}.events.jsonl`,
      `${JSON.stringify({ type: 'selection', selection: this.selection })}\n`
    );
    this.intervalMs = this.selection.phase === 'general' ? 5000 : 1000;
    this.write(false);
  }

  onCollected() {
    this.maybeWrite();
  }

  onTaskUpdate(packs) {
    // Append only the updated node, never a suite's recursive children. This
    // preserves every update without rewriting thousands of general suites.
    const updates = packs.map(([id, result]) => {
      const task = this.context.state.idMap.get(id);
      const names = [];
      for (let current = task; current; current = current.suite) names.unshift(current.name);
      return {
        type: 'task',
        id,
        file: task?.file?.filepath ?? task?.filepath,
        name: names.join(' > '),
        state: result?.state,
        durationMs: result?.duration,
        errors: (result?.errors ?? []).map(({ name, message, stack }) => ({
          name,
          message,
          stack,
        })),
      };
    });
    if (updates.length)
      appendFileSync(
        `${this.output}.events.jsonl`,
        updates.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
      );
    this.maybeWrite();
  }

  maybeWrite() {
    if (Date.now() - this.lastSnapshot >= this.intervalMs) this.write(false);
  }

  onFinished(_files, errors) {
    this.write(true, errors);
  }

  write(finished, errors = []) {
    this.lastSnapshot = Date.now();
    const root = process.env.PROTO_UI_RUNTIME_ROOT ?? process.cwd();
    const files = this.context.state.getFiles();
    const observed = new Map(
      files.map((file) => [path.relative(root, file.filepath).replaceAll('\\', '/'), file])
    );
    const report = {
      schemaVersion: 1,
      selection: this.selection,
      updatedAt: new Date().toISOString(),
      finished,
      unhandledErrors: errors.map((error) => ({ name: error?.name, message: error?.message })),
      suites: this.selection.suites.map((suite) => ({
        suite,
        observation: observed.has(suite) ? taskObservation(observed.get(suite)) : null,
      })),
    };
    mkdirSync(path.dirname(this.output), { recursive: true });
    writeFileSync(`${this.output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
    renameSync(`${this.output}.tmp`, this.output);
  }
}
