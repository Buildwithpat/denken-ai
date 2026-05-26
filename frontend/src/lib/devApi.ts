import { api } from './api';
import type { Entitlements } from './subscriptionApi';
import type { StoredUser } from './auth';

export interface DevPersona {
  id:          string;
  label:       string;
  description: string;
}

export interface SetPersonaResponse {
  persona:      string;
  message:      string;
  user:         StoredUser;
  entitlements: Entitlements;
}

export const listPersonas = () =>
  api.get<{ personas: DevPersona[] }>('/dev/personas', { auth: true });

export const setPersona = (persona: string) =>
  api.post<SetPersonaResponse>('/dev/set-persona', { persona }, { auth: true });
