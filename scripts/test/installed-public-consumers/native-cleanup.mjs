export async function closeNativeResources(browser, server) {
  const failures = [];
  try {
    await browser?.close();
  } catch (error) {
    failures.push({ resource: 'browser', error: error.stack ?? String(error) });
  }
  try {
    if (server.listening) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } catch (error) {
    failures.push({ resource: 'server', error: error.stack ?? String(error) });
  }
  return failures;
}
