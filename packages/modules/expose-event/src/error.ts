export class ExposeEventError extends Error {
  readonly code: string;
  readonly detail?: any;

  constructor(code: string, message: string, detail?: any) {
    super(message);
    this.name = 'ExposeEventError';
    this.code = code;
    this.detail = detail;
  }
}

export function exposeEventInvalidArgument(message: string, detail?: any) {
  return new ExposeEventError('EXPOSE_EVENT_INVALID_ARGUMENT', message, detail);
}
