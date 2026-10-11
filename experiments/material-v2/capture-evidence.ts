type NativeCaptureEvent = {
  type: string;
  trust: boolean;
  custom?: boolean;
  detail?: number;
  pointerId?: number;
  pointerType?: string;
  runtime?: string;
  control?: string;
  time: number;
};
type Contact = { active: boolean; session: number; reason: string };

/** Evidence validation only; never dispatches an event or creates capture. */
export function explicitCaptureEvidenceIssues(
  native: readonly NativeCaptureEvent[],
  runtime: string,
  pointerId: number,
  held: Contact,
  ended: Contact,
  release: 'inside' | 'outside' = 'inside'
): string[] {
  const issues: string[] = [];
  const positions = ['pointerdown', 'gotpointercapture', 'lostpointercapture', 'pointerup'].map(
    (type) => {
      const matches = native.flatMap((event, index) =>
        event.type === type &&
        event.trust &&
        event.pointerType === 'mouse' &&
        event.pointerId === pointerId &&
        (type === 'pointerup' && release === 'outside'
          ? event.control === undefined
          : event.runtime === runtime && event.control === 'regular')
          ? [index]
          : []
      );
      if (matches.length !== 1) issues.push(`expected one trusted ${runtime}/${pointerId} ${type}`);
      return matches.length === 1 ? matches[0] : -1;
    }
  );
  if (positions.some((index, i) => index < 0 || (i > 0 && index <= positions[i - 1])))
    issues.push('expected native down -> gotcapture -> lostcapture -> up order');
  if (!held.active || !Number.isSafeInteger(held.session) || held.session <= 0)
    issues.push('capture must begin with an active router contact');
  if (ended.active || ended.reason !== 'lostcapture' || ended.session !== held.session)
    issues.push('the same held session must terminate by lostcapture');
  return issues;
}

/** The contact outcome and the activation channel are independent observations. */
export function captureActivationEvidenceIssues(
  native: readonly NativeCaptureEvent[],
  activations: readonly { runtime: string; time: number }[],
  runtime: string,
  pointerId: number,
  release: 'inside' | 'outside'
): string[] {
  const issues: string[] = [];
  const clicks = native.filter(
    (event) => event.type === 'click' && event.runtime === runtime && event.control === 'regular'
  );
  const inputs = clicks.filter((event) => !event.custom);
  const outward = activations.filter((event) => event.runtime === runtime);
  const custom = clicks.filter((event) => event.custom);
  if (release === 'outside') {
    if (clicks.length || outward.length)
      issues.push('outside release must not activate the control');
    return issues;
  }
  const input = inputs[0];
  const up = native.find((event) => event.type === 'pointerup' && event.pointerId === pointerId);
  if (
    inputs.length !== 1 ||
    !input?.trust ||
    input.pointerId !== pointerId ||
    input.pointerType !== 'mouse' ||
    !(input.detail! > 0) ||
    !up ||
    input.time < up.time
  )
    issues.push('inside release needs exactly one matching trusted pointer click after up');
  if (outward.length !== 1 || !input || outward[0].time < input.time)
    issues.push('native click must reach the public consumer exactly once');
  // WC exposes a DOM CustomEvent; the other Adapters expose framework callbacks.
  if (
    runtime === 'wc' &&
    (custom.length !== 1 || custom[0].trust || !input || custom[0].time < input.time)
  )
    issues.push('WC must expose exactly one distinct untrusted CustomEvent after native click');
  return issues;
}
