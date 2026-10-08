import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { sha256, jsonBytes } from './nine-plan.mjs';

// Credential-free projection only. Python keeps the entire provider config inside
// its process and emits an allowlist, never auth, request bodies or history.
const projection = String.raw`
import sqlite3,json,re,sys
c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); c.row_factory=sqlite3.Row
providers=c.execute("select id,name,settings_config,cost_multiplier,limit_daily_usd,limit_monthly_usd from providers where app_type='codex' and is_current=1").fetchall()
assert len(providers)==1, 'Exactly one current codex provider required'
p=providers[0]; config=json.loads(p['settings_config'])
urls=re.findall(r'base_url\s*=\s*[\"\x27]([^\"\x27]+)',config.get('config',''))
assert len(urls)==1, 'Exactly one provider base_url required'
proxy=dict(c.execute("select proxy_enabled,enabled,listen_address,listen_port,auto_failover_enabled,max_retries,pricing_model_source,streaming_first_byte_timeout,streaming_idle_timeout,non_streaming_timeout from proxy_config where app_type='codex'").fetchone())
prices=[dict(r) for r in c.execute('select model_id,input_cost_per_million,output_cost_per_million,cache_read_cost_per_million,cache_creation_cost_per_million from model_pricing where model_id=?',('gpt-6.1-sol',))]
print(json.dumps({'endpoint':'http://'+proxy['listen_address']+':'+str(proxy['listen_port'])+'/v1/responses','providerId':p['id'],'providerName':p['name'],'upstreamBaseUrl':urls[0],'proxyMaxRetries':proxy['max_retries'],'autoFailover':proxy['auto_failover_enabled'],'proxyEnabled':proxy['proxy_enabled'],'proxyRuntimeEnabled':proxy['enabled'],'pricingModelSource':proxy['pricing_model_source'],'timeouts':{k:proxy[k] for k in ['streaming_first_byte_timeout','streaming_idle_timeout','non_streaming_timeout']},'priceRows':prices,'dailyLimitUSD':p['limit_daily_usd'],'monthlyLimitUSD':p['limit_monthly_usd'],'costMultiplier':p['cost_multiplier']}))
`;
export async function observeConfiguredRoute({
  databasePath = path.join(os.homedir(), '.cc-switch/cc-switch.db'),
} = {}) {
  const { stdout } = await promisify(execFile)('python3', ['-c', projection, databasePath], {
    timeout: 10000,
    maxBuffer: 100000,
  });
  const binding = JSON.parse(stdout);
  assert.equal(binding.providerName, 'yvxi', 'Authorized provider changed');
  assert.equal(binding.proxyEnabled, 1, 'Configured proxy disabled');
  assert.equal(binding.proxyRuntimeEnabled, 1, 'Configured proxy not enabled');
  assert.equal(binding.autoFailover, 0, 'Unexpected route failover enabled');
  for (const field of ['endpoint', 'upstreamBaseUrl']) {
    const url = new URL(binding[field]);
    assert.ok(!url.username && !url.password && !url.search, 'Credential-bearing route rejected');
  }
  assert.equal(new URL(binding.endpoint).hostname, '127.0.0.1');
  return {
    kind: 'local-configured-route-not-upstream-authentication-or-invoice',
    observedAt: new Date().toISOString(),
    binding,
    routeFingerprint: sha256(jsonBytes(binding)),
    internalRetryOrigin: 'unknown; local configured max retries is not observed retry history',
  };
}
