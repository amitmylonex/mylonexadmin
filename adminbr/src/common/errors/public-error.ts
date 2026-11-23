/** Only deliberate domain messages may be returned for server-side failures. */
export class PublicError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
