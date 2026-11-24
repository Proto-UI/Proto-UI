// Shared by the real browser observation loop and its synthetic refusal controls.
// These predicates observe captured host facts; they never complete or mutate a view.
type PortalObservation = {
  phase: string;
  present: boolean;
  connected: boolean;
  portaled: boolean;
  detached: boolean;
  owner: number;
  viewEpoch: number | null;
  created: number;
  mounted: number;
  unmounted: number;
  concealed: boolean;
  inert: boolean;
};

function hasActiveMount(value: PortalObservation) {
  return (
    Number.isSafeInteger(value.owner) &&
    value.owner > 0 &&
    typeof value.viewEpoch === 'number' &&
    Number.isSafeInteger(value.viewEpoch) &&
    value.viewEpoch >= 0 &&
    Number.isSafeInteger(value.created) &&
    value.created > 0 &&
    Number.isSafeInteger(value.mounted) &&
    value.mounted > 0 &&
    Number.isSafeInteger(value.unmounted) &&
    value.unmounted >= 0 &&
    value.mounted === value.unmounted + 1
  );
}

function isEnteredReference(reference: PortalObservation) {
  return (
    reference.phase === 'entered' &&
    reference.present === true &&
    reference.detached === false &&
    reference.connected === true &&
    reference.portaled === true &&
    hasActiveMount(reference)
  );
}

function hasSameLifetime(value: PortalObservation, reference: PortalObservation) {
  return (
    value.owner === reference.owner &&
    value.viewEpoch === reference.viewEpoch &&
    value.created === reference.created &&
    value.mounted === reference.mounted
  );
}

export function isRetainedClosedPortal(value: PortalObservation, reference: PortalObservation) {
  return (
    isEnteredReference(reference) &&
    value.phase === 'closed' &&
    value.present === false &&
    value.detached === true &&
    value.connected === true &&
    value.portaled === true &&
    value.concealed === true &&
    value.inert === true &&
    hasActiveMount(value) &&
    hasSameLifetime(value, reference) &&
    value.unmounted === reference.unmounted
  );
}

export function isPhysicallyRetiredPortal(value: PortalObservation, reference: PortalObservation) {
  return (
    isEnteredReference(reference) &&
    value.phase === 'closed' &&
    value.present === false &&
    value.detached === true &&
    value.connected === true &&
    value.portaled === false &&
    value.concealed === true &&
    hasSameLifetime(value, reference) &&
    value.unmounted === reference.unmounted + 1 &&
    value.mounted === value.unmounted
  );
}
