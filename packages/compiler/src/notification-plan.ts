/** Compile-time notification lowering. These functions never ship in the consumer. */
export interface NotificationQueue {
  queue: string;
  draining: string;
  alive?: string;
  typed?: boolean;
}

export function emitNotificationDrain({
  queue,
  draining,
  alive,
  typed = true,
}: NotificationQueue): string {
  return `if (!${draining}) {
  ${draining} = true;
  ${typed ? 'const notificationFailures: unknown[] = [];' : '/** @type {unknown[]} */ const notificationFailures = [];'}
  let notificationIndex = 0;
  try {
    while (notificationIndex < ${queue}.length${alive ? ` && (${alive})` : ''}) {
      try { ${queue}[notificationIndex++](); } catch (error) {
        Object.defineProperty(notificationFailures, notificationFailures.length, {value:error, writable:true, enumerable:true, configurable:true});
      }
    }
  } finally { ${queue}.length = 0; ${draining} = false; }
  if (notificationFailures.length === 1) throw notificationFailures[0];
  if (notificationFailures.length > 1) throw new AggregateError(notificationFailures, '[State] subscriber failures');
}`;
}

export function emitRecordedNotification(
  options: NotificationQueue & {
    subscribers: string;
    deliver: string;
    drain?: boolean;
  }
): string {
  const { queue, subscribers, deliver, alive } = options;
  return `for (const subscriber of Array.from(${subscribers})) {
  Object.defineProperty(${queue}, ${queue}.length, {value: () => { if (${alive ? `(${alive}) && ` : ''}${subscribers}.has(subscriber)) { ${deliver}; } }, writable:true, enumerable:true, configurable:true});
}
${options.drain === false ? '' : emitNotificationDrain(options)}`;
}
