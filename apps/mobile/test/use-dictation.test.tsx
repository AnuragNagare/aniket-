import { act, renderHook } from '@testing-library/react-native';
import { useDictation } from '../src/voice/use-dictation';
import { ExpoSpeechRecognitionModule, emitSpeech } from './mocks/speech';

const M = ExpoSpeechRecognitionModule as jest.Mocked<typeof ExpoSpeechRecognitionModule>;

beforeEach(() => jest.clearAllMocks());

describe('useDictation', () => {
  it('starts in the chosen language, shows interim words and hands over final text', async () => {
    const onFinal = jest.fn();
    const { result } = renderHook(() => useDictation({ locale: 'hi-IN', onFinal }));
    await act(() => result.current.start());
    expect(M.start).toHaveBeenCalledWith(expect.objectContaining({ lang: 'hi-IN', interimResults: true, continuous: true }));
    expect(result.current.state).toBe('listening');
    act(() => emitSpeech('result', { isFinal: false, results: [{ transcript: 'साइट पर' }] }));
    expect(result.current.interim).toBe('साइट पर');
    act(() => emitSpeech('result', { isFinal: true, results: [{ transcript: 'साइट पर पहुंचा' }] }));
    expect(onFinal).toHaveBeenCalledWith('साइट पर पहुंचा');
    expect(result.current.interim).toBe('');
  });

  it('explains a refused microphone and stays usable for typing', async () => {
    M.requestPermissionsAsync.mockResolvedValueOnce({ granted: false } as never);
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    expect(result.current.error).toBe('Allow the microphone in Settings to speak your update. You can still type it.');
    expect(M.start).not.toHaveBeenCalled();
  });

  it('says when the phone has no speech service', async () => {
    M.isRecognitionAvailable.mockReturnValueOnce(false);
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    expect(result.current.state).toBe('unavailable');
    expect(result.current.error).toBe('Voice typing isn’t available on this phone. You can type your update instead.');
  });

  it('turns "no speech" into a plain retry message', async () => {
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    act(() => emitSpeech('error', { error: 'no-speech', message: '' }));
    expect(result.current.error).toBe('Didn’t catch that. Tap the microphone and try again.');
    expect(result.current.state).toBe('idle');
  });

  it('stop ends listening', async () => {
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    act(() => result.current.stop());
    act(() => emitSpeech('end'));
    expect(M.stop).toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('does not crash when the speech service throws on start', async () => {
    M.start.mockImplementationOnce(() => {
      throw new Error('service not bound');
    });
    const { result } = renderHook(() => useDictation({ locale: 'en-IN', onFinal: jest.fn() }));
    await act(() => result.current.start());
    expect(result.current.state).toBe('idle');
    expect(result.current.error).toContain('service not bound');
  });
});
