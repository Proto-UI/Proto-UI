type NativeCaptureEvent = {
  type: string;
  trust: boolean;
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
  ended: Contact
): string[] {
  const issues: string[] = [];
  const positions = ['pointerdown', 'gotpointercapture', 'lostpointercapture', 'pointerup'].map(
    (type) => {
      const matches = native.flatMap((event, index) =>
        event.type === type &&
        event.trust &&
        event.pointerType === 'mouse' &&
        event.pointerId === pointerId &&
        event.runtime === runtime &&
        event.control === 'regular'
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
