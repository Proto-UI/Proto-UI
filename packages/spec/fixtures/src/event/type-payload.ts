export type EventTypePayloadExpectation =
  | 'type-layer-validation'
  | 'core-event-payload'
  | 'optional-event-payload'
  | 'pointer-sample-facts'
  | 'host-bound-event'
  | 'expose-emit-is-expose';

export type EventTypePayloadCase = {
  id: string;
  title: string;
  specCase: string;
  covers: readonly string[];
  acceptedTypes: readonly string[];
  rejectedTypes?: readonly string[];
  expectation: EventTypePayloadExpectation;
};

export const EVENT_TYPE_PAYLOAD_CASES = [
  {
    id: 'event-type-layer-validation',
    title: 'event type validation accepts only declared layers',
    specCase: 'T-EVENT-0002-CASE-TYPE-VALIDATION',
    covers: [
      'C-EVENT-TYPE-0001-A',
      'C-EVENT-TYPE-0001-B',
      'C-EVENT-TYPE-0002-A',
      'C-EVENT-TYPE-0003-C',
      'C-EVENT-TYPE-0003-D',
      'C-EVENT-TYPE-0004-A',
    ],
    acceptedTypes: ['press.commit', 'key.down', 'pointer.down', 'context.menu', 'host:click'],
    rejectedTypes: ['click', 'foo.bar', 'native:click', 'host.click', 'host:'],
    expectation: 'type-layer-validation',
  },
  {
    id: 'event-core-key-payload',
    title: 'key core events expose minimal portable key payload',
    specCase: 'T-EVENT-0002-CASE-CORE-PAYLOAD',
    covers: ['C-EVENT-0002-I', 'C-EVENT-0002-J', 'C-EVENT-TYPE-0002-F'],
    acceptedTypes: ['key.down', 'key.up'],
    expectation: 'core-event-payload',
  },
  {
    id: 'event-optional-pointer-payload',
    title: 'optional pointer events expose event type while native details remain host-local',
    specCase: 'T-EVENT-0002-CASE-OPTIONAL-PAYLOAD',
    covers: ['C-EVENT-0002-I', 'C-EVENT-0002-K', 'C-EVENT-TYPE-0003-B'],
    acceptedTypes: ['pointer.down', 'pointer.move', 'pointer.up'],
    expectation: 'optional-event-payload',
  },
  {
    id: 'event-host-bound-prefix',
    title: 'host-bound event types use host:* and keep lifecycle guarantees only',
    specCase: 'T-EVENT-0002-CASE-HOST-BOUND',
    covers: [
      'C-EVENT-TYPE-0004-A',
      'C-EVENT-TYPE-0004-B',
      'C-EVENT-TYPE-0004-C',
      'C-EVENT-TYPE-0004-D',
      'C-EVENT-TYPE-0004-E',
    ],
    acceptedTypes: ['host:click', 'host:pointerdown'],
    rejectedTypes: ['native:click', 'host.click'],
    expectation: 'host-bound-event',
  },
  {
    id: 'event-expose-emit-is-expose',
    title: 'expose event emission is surfaced as run.expose.emit rather than Event runtime API',
    specCase: 'T-EVENT-0002-CASE-EXPOSE-EMIT',
    covers: ['C-EVENT-0002-G', 'C-EVENT-0002-H'],
    acceptedTypes: [],
    expectation: 'expose-emit-is-expose',
  },
  {
    id: 'event-pointer-sample-facts',
    title: 'six pointer events carry finite sample facts without host leakage',
    specCase: 'T-EVENT-0002-CASE-POINTER-FACTS',
    covers: ['C-EVENT-0002-L', 'M-EVENT-0001-L', 'C-EVENT-TYPE-0003-F', 'C-EVENT-TYPE-0003-G', 'C-EVENT-TYPE-0003-H'],
    acceptedTypes: ['pointer.down', 'pointer.move', 'pointer.up', 'pointer.cancel', 'pointer.enter', 'pointer.leave'],
    expectation: 'pointer-sample-facts',
  },
] as const satisfies readonly EventTypePayloadCase[];

export const EVENT_TYPE_PAYLOAD_SPEC_CASES = [
  ...new Set(EVENT_TYPE_PAYLOAD_CASES.map((testCase) => testCase.specCase)),
] as const;
