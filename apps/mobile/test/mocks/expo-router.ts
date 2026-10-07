export const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
export const useRouter = () => mockRouter;
export const useLocalSearchParams = jest.fn(() => ({}));
export const Link = ({ children }: { children: unknown }) => children;
export const Redirect = () => null;
export const Stack = Object.assign(() => null, { Screen: () => null, Protected: () => null });
