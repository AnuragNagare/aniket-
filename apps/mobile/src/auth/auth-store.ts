import { Alert } from 'react-native';
import { create } from 'zustand';
import type { AdminSignupInput, AuthTokens, AuthUser } from '@worktrail/types';
import { api, ApiError } from '../api';
import { getOutbox, getUpdateQueue } from '../tracking/store';
import { stopTracking } from '../tracking/tracking';
import { syncNow } from '../tracking/uploader';
import { tokenStorage } from './token-storage';

type Status = 'loading' | 'offline' | 'signedOut' | 'signedIn';

type AuthState = {
  status: Status;
  user: AuthUser | null;
  accessToken: string | null;
  bootstrap(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  acceptInvite(token: string, name: string, password: string): Promise<void>;
  register(input: AdminSignupInput): Promise<void>;
  signOut(): Promise<void>;
  refreshAccessToken(): Promise<string | null>;
  clearLocal(): Promise<void>;
  handleAccountDisabled(): Promise<void>;
};

const isNetwork = (e: unknown) => e instanceof ApiError && e.code === 'NETWORK';

export const useAuthStore = create<AuthState>((set, get) => {
  /** Accepts tokens from login, invite or sign-up. Employees and admins both use this app; the role picks their screens. */
  async function adopt(tokens: AuthTokens) {
    await tokenStorage.set(tokens.refreshToken);
    set({ status: 'signedIn', user: tokens.user, accessToken: tokens.accessToken });
  }

  return {
    status: 'loading',
    user: null,
    accessToken: null,

    async bootstrap() {
      set({ status: 'loading' });
      if (!(await tokenStorage.get())) return set({ status: 'signedOut' });
      try {
        const token = await get().refreshAccessToken();
        if (token) set({ status: 'signedIn' });
      } catch (e) {
        if (isNetwork(e)) set({ status: 'offline' });
        else await get().clearLocal();
      }
    },

    async signIn(email, password) {
      const tokens = await api.request<AuthTokens>(
        'POST',
        '/auth/login',
        { email, password },
        { auth: false },
      );
      await adopt(tokens);
    },

    async acceptInvite(token, name, password) {
      const tokens = await api.request<AuthTokens>(
        'POST',
        `/employees/invitations/${encodeURIComponent(token)}/accept`,
        { name, password },
        { auth: false },
      );
      await adopt(tokens);
    },

    async register(input) {
      const tokens = await api.request<AuthTokens>('POST', '/auth/signup/admin', input, {
        auth: false,
      });
      await adopt(tokens);
    },

    async signOut() {
      await stopTracking().catch(() => undefined);
      await syncNow().catch(() => undefined); // last chance to deliver this person's points
      await (await getOutbox()).clear(); // the next person on this phone never inherits them
      await (await getUpdateQueue()).clear();
      const refreshToken = await tokenStorage.get();
      if (refreshToken) {
        await api
          .request('POST', '/auth/logout', { refreshToken }, { auth: false })
          .catch(() => undefined);
      }
      await get().clearLocal();
    },

    /** Rotates the refresh token. Offline → throws NETWORK (token kept); refused → signs out. */
    async refreshAccessToken() {
      const refreshToken = await tokenStorage.get();
      if (!refreshToken) {
        await get().clearLocal();
        return null;
      }
      try {
        const tokens = await api.request<AuthTokens>(
          'POST',
          '/auth/refresh',
          { refreshToken },
          { auth: false },
        );
        await tokenStorage.set(tokens.refreshToken);
        set({ accessToken: tokens.accessToken, user: tokens.user });
        return tokens.accessToken;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'ACCOUNT_DISABLED') {
          await get().handleAccountDisabled();
          return null;
        }
        if (isNetwork(e)) throw e;
        await get().clearLocal();
        return null;
      }
    },

    async clearLocal() {
      await tokenStorage.clear();
      set({ status: 'signedOut', user: null, accessToken: null });
    },

    async handleAccountDisabled() {
      await stopTracking().catch(() => undefined);
      await (await getOutbox()).clear().catch(() => undefined);
      await (await getUpdateQueue()).clear().catch(() => undefined);
      await tokenStorage.clear().catch(() => undefined);
      set({ status: 'signedOut', user: null, accessToken: null });
      Alert.alert('Account disabled', 'This account has been turned off by your company.');
    },
  };
});
