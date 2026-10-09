/** The AI provider was briefly unavailable (rate limit, 5xx, timeout, network). Worth retrying later. */
export class TransientAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientAiError';
  }
}
