import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { tabsControl } from '../semantic/tabs-controls.mjs';
import { responsesTransport } from './http-transport.mjs';
import { prepareBatch, sha256 } from './batch-plan.mjs';
import { executeCandidateBatch, inspectInterruptedBatch } from './batch-runner.mjs';

const enabled = process.env.PROTO_BENCHMARK_BROWSER_TESTS === '1';
test(
  'synthetic end-to-end: exact HTTP archives, valid/invalid discovery, positive/negative real Chrome observations',
  { skip: !enabled, timeout: 150000 },
  async () => {
    const root = await mkdtemp(
      path.join(
        process.env.PROTO_BENCHMARK_EVIDENCE_ROOT || os.tmpdir(),
        'candidate-batch-browser-'
      )
    );
    const ready = await prepareBatch({
      directory: path.join(root, 'plan'),
      model: 'synthetic-not-a-model',
      wallMs: 30000,
      totalWallMs: 120000,
    });
    const received = [];
    const server = createServer(async (request, response) => {
      const parts = [];
      for await (const part of request) parts.push(part);
      received.push(Buffer.concat(parts));
      const index = received.length - 1;
      const text =
        index === 0
          ? JSON.stringify({
              properties: [
                {
                  id: 'p1',
                  claim: 'Only one section is selected',
                  basis: 'observed',
                  testProposal: 'Activate another section',
                  limitations: 'Synthetic control, not a discovered model property',
                },
              ],
            })
          : index === 1
            ? 'malformed discovery control'
            : tabsControl({
                seed: `batch-${index}`,
                mutation: index === 2 ? 'navigation-selects' : null,
              });
      response.end(
        JSON.stringify({
          status: 'completed',
          output: [
            { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
          ],
        })
      );
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const directory = path.join(root, 'execution');
    try {
      const { report } = await executeCandidateBatch({
        planDir: ready.directory,
        expectedSha256: ready.planSha256,
        directory,
        chromiumPath: process.env.PROTO_BENCHMARK_CHROMIUM,
        transportFactory: ({ archiveDir }) =>
          responsesTransport({
            endpoint: `http://127.0.0.1:${server.address().port}/responses`,
            token: 'SYNTHETIC-LOCAL-ONLY',
            archiveDir,
            allowLoopbackHttp: true,
            requestTimeoutMs: 30000,
          }),
      });
      assert.equal(received.length, 4);
      assert.equal(report.realModelRuns, 0);
      assert.equal(report.formalCompletion, false);
      const execution = JSON.parse(await readFile(path.join(directory, 'execution.json')));
      assert.deepEqual(
        execution.results.map((r) => r.assessment.status),
        [
          'proposal-structure-valid',
          'invalid-submission',
          'candidate-observations',
          'candidate-observations',
        ]
      );
      assert.equal(execution.results[3].assessment.layers.journey.fail, 0);
      assert.ok(
        execution.results[2].assessment.checks.some(
          (c) => c.id === 'right-skip-disabled' && c.status === 'fail'
        )
      );
      assert.ok(report.failedCheckClusters.some((c) => c.check === 'right-skip-disabled'));
      for (const [index, run] of execution.results.entries()) {
        assert.equal(sha256(received[index]), run.requestSha256);
        const dir = path.join(directory, run.id, 'http-attempt');
        const metadata = JSON.parse(await readFile(path.join(dir, 'transport.json')));
        for (const file of metadata.files)
          assert.equal(sha256(await readFile(path.join(dir, file.name))), file.sha256);
        assert.equal(metadata.rawBodyComplete, true);
      }
      const recovery = await inspectInterruptedBatch({
        planDir: ready.directory,
        expectedSha256: ready.planSha256,
        directory,
      });
      assert.equal(recovery.status, 'terminal-artifacts-present-unverified');
      console.log(
        JSON.stringify({
          syntheticOnly: true,
          root,
          planSha256: ready.planSha256,
          cells: report.cells,
        })
      );
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
);
