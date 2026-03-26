import { apiClient } from './client';
import type { CreateVendorInput, UpdateVendorInput, VendorContactInput, VendorResponse } from '@itdesk/shared';

export async function getVendors(): Promise<VendorResponse[]> {
  const { data } = await apiClient.get('/vendors');
  return data;
}

export async function getVendor(id: string): Promise<VendorResponse> {
  const { data } = await apiClient.get(`/vendors/${id}`);
  return data;
}

export async function createVendor(input: CreateVendorInput): Promise<VendorResponse> {
  const { data } = await apiClient.post('/vendors', input);
  return data;
}

export async function updateVendor(id: string, input: UpdateVendorInput): Promise<VendorResponse> {
  const { data } = await apiClient.patch(`/vendors/${id}`, input);
  return data;
}

export async function deleteVendor(id: string): Promise<void> {
  await apiClient.delete(`/vendors/${id}`);
}

export async function addContact(vendorId: string, input: VendorContactInput): Promise<VendorResponse> {
  const { data } = await apiClient.post(`/vendors/${vendorId}/contacts`, input);
  return data;
}

export async function updateContact(vendorId: string, contactId: string, input: Partial<VendorContactInput>): Promise<VendorResponse> {
  const { data } = await apiClient.patch(`/vendors/${vendorId}/contacts/${contactId}`, input);
  return data;
}

export async function deleteContact(vendorId: string, contactId: string): Promise<VendorResponse> {
  const { data } = await apiClient.delete(`/vendors/${vendorId}/contacts/${contactId}`);
  return data;
}
