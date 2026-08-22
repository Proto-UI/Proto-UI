const BAND_ORDER = ['U0', 'C1', 'C2', 'C3', 'C4'];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function selectRunnableMission(queue, { band, subject, now = Date.now() }) {
  requireCondition(BAND_ORDER.includes(band), 'mission selector requires a valid capability band');
  requireCondition(
    typeof subject === 'string' && subject.length > 0,
    'mission selector requires the current leased subject'
  );
  requireCondition(Array.isArray(queue?.missions), 'mission queue must contain missions');

  const eligible = queue.missions
    .filter((mission) => mission.status === 'ready')
    .filter((mission) => mission.taskClass === 'observe')
    .filter(
      (mission) =>
        BAND_ORDER.includes(mission.requiredBand) &&
        BAND_ORDER.indexOf(band) >= BAND_ORDER.indexOf(mission.requiredBand)
    )
    .filter((mission) => mission.lease?.owner === subject)
    .filter((mission) => {
      const acquiredAt = Date.parse(mission.lease?.acquiredAt ?? '');
      const expiresAt = Date.parse(mission.lease?.expiresAt ?? '');
      return Number.isFinite(acquiredAt) && acquiredAt <= now && now < expiresAt;
    })
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

  return eligible[0] ?? null;
}
