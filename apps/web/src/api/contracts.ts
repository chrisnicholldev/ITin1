import { apiClient } from './client';
import type { ContractResponse, CreateContractInput, UpdateContractInput } from '@itdesk/shared';

export type { ContractResponse as Contract };

export async function getContracts(params?: {
  status?: string;
  contractType?: string;
  search?: string;
}): Promise<ContractResponse[]> {
  const { data } = await apiClient.get('/contracts', { params });
  return data;
}

export async function getUpcomingRenewals(): Promise<ContractResponse[]> {
  const { data } = await apiClient.get('/contracts/renewals');
  return data;
}

export async function createContract(input: CreateContractInput): Promise<ContractResponse> {
  const { data } = await apiClient.post('/contracts', input);
  return data;
}

export async function updateContract(id: string, input: UpdateContractInput): Promise<ContractResponse> {
  const { data } = await apiClient.patch(`/contracts/${id}`, input);
  return data;
}

export async function deleteContract(id: string): Promise<void> {
  await apiClient.delete(`/contracts/${id}`);
}
