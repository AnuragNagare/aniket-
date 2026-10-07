type Handler = (e: unknown) => void;
const handlers = new Map<string, Handler>();

export const ExpoSpeechRecognitionModule = {
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  isRecognitionAvailable: jest.fn(() => true),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};
export const useSpeechRecognitionEvent = (name: string, handler: Handler) => {
  handlers.set(name, handler);
};
/** Test helper: fire a native speech event. */
export const emitSpeech = (name: string, payload: unknown = {}) => handlers.get(name)?.(payload);
