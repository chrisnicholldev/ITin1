import { apiClient } from './client';

export interface TeamMember {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export async function getTeams(): Promise<Team[]> {
  const { data } = await apiClient.get('/teams');
  return data;
}

export async function getTeam(id: string): Promise<Team> {
  const { data } = await apiClient.get(`/teams/${id}`);
  return data;
}

export async function createTeam(payload: { name: string; description?: string }): Promise<Team> {
  const { data } = await apiClient.post('/teams', payload);
  return data;
}

export async function updateTeam(id: string, payload: { name?: string; description?: string | null }): Promise<Team> {
  const { data } = await apiClient.patch(`/teams/${id}`, payload);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  await apiClient.delete(`/teams/${id}`);
}

export async function addTeamMember(teamId: string, userId: string): Promise<Team> {
  const { data } = await apiClient.post(`/teams/${teamId}/members`, { userId });
  return data;
}

export async function removeTeamMember(teamId: string, userId: string): Promise<Team> {
  const { data } = await apiClient.delete(`/teams/${teamId}/members/${userId}`);
  return data;
}
