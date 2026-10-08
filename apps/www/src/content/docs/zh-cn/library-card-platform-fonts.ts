import type { CDPSession, Page } from 'playwright-core';

/** Diagnostic only. Actual font selection comes from Chromium, not the CSS
 * family string. A failed read is retained separately from the original gate. */
export async function readLibraryPlatformFonts(page: Page) {
  let session: CDPSession | undefined;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup: string[] = [];
  const nodes: Array<{ name: string; fonts?: unknown; missing?: boolean }> = [];
  const detach = async (owned: CDPSession) => {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        owned.detach(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('font diagnostic detach exceeded 1s')),
            1000
          );
        }),
      ]);
    } catch (error) {
      cleanup.push(String(error));
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  };
  const check = () => {
    if (!active) throw new Error('font diagnostic response arrived after deadline');
  };
  let error: string | undefined;
  try {
    await Promise.race([
      (async () => {
        const obtained = await page.context().newCDPSession(page);
        if (!active) {
          await detach(obtained);
          return;
        }
        session = obtained;
        await session.send('DOM.enable');
        check();
        await session.send('CSS.enable');
        check();
        const { root } = await session.send('DOM.getDocument', { depth: 0 });
        check();
        for (const [name, target] of [
          ['caption', '.library-card__kind'],
          ['title', 'h2 [data-library-part]'],
          ['action', '[data-library-action] [data-library-part$="text"]'],
        ]) {
          const { nodeId } = await session.send('DOM.querySelector', {
            nodeId: root.nodeId,
            selector: `[data-library="brutalist"] ${target}`,
          });
          check();
          if (!nodeId) nodes.push({ name, missing: true });
          else {
            const { fonts } = await session.send('CSS.getPlatformFontsForNode', { nodeId });
            check();
            nodes.push({ name, fonts });
          }
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('font diagnostic exceeded 3s')), 3000);
      }),
    ]);
  } catch (issue) {
    error = String(issue);
  } finally {
    active = false;
    if (timer) clearTimeout(timer);
    if (session) await detach(session);
  }
  // Copy so late acquisition cleanup cannot mutate a previously returned record.
  return { nodes, ...(error ? { error } : {}), cleanup: [...cleanup] };
}
