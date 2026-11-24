import { readFileSync, readdirSync, statSync } from 'node:fs';

// Every signal target is observed below this invocation's child PID or carries
// its exact random inherited marker. Start times are rechecked before signals.
// The marker recovers an early orphan after its short-lived parent exits between
// observations. Other processes' environment bytes are never printed or retained.
export function processFact(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return { pid: Number(pid), state: fields[0], parent: Number(fields[1]), started: fields[19] };
  } catch {
    return null;
  }
}
export function liveOwned(owned) {
  return [...owned.values()].filter((saved) => {
    const current = processFact(saved.pid);
    return current?.started === saved.started && !['Z', 'X'].includes(current.state);
  });
}
function matchesOwner(fact, ownership) {
  try {
    if (statSync(`/proc/${fact.pid}`).uid !== ownership.uid) return false;
    const environment = readFileSync(`/proc/${fact.pid}/environ`);
    return Buffer.concat([Buffer.from([0]), environment]).includes(ownership.match);
  } catch {
    // A process may exit or deny inspection between /proc reads.
    return false;
  }
}
export function observeChildren(leader, owned, ownership) {
  const facts = readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(processFact)
    .filter(Boolean);
  const selected = new Set(liveOwned(owned).map((entry) => entry.pid));
  if (leader && !owned.has(leader)) {
    const fact = facts.find((entry) => entry.pid === leader);
    // A short-lived child may have exited before the first observation. Its
    // numeric PID alone must not claim an unrelated process after PID reuse.
    if (fact && matchesOwner(fact, ownership)) {
      owned.set(leader, fact);
      selected.add(leader);
      ownership.started ??= Number(fact.started);
    }
  }
  for (const fact of facts) {
    const key = `${fact.pid}/${fact.started}`;
    if (
      selected.has(fact.pid) ||
      ownership.unmarked.has(key) ||
      Number(fact.started) < (ownership.started ?? 0)
    )
      continue;
    // Limit marker inspection to this UID and cache negative identities, so
    // unrelated processes are not repeatedly inspected.
    if (matchesOwner(fact, ownership)) {
      owned.set(fact.pid, fact);
      selected.add(fact.pid);
    } else ownership.unmarked.add(key);
  }
  let added;
  do {
    added = false;
    for (const fact of facts) {
      if (!selected.has(fact.pid) && selected.has(fact.parent)) {
        selected.add(fact.pid);
        owned.set(fact.pid, fact);
        added = true;
      }
    }
  } while (added);
}
