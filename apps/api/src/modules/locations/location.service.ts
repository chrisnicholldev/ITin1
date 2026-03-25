import { Location, type ILocationDocument } from './location.model.js';
import { AppError } from '../../middleware/error.middleware.js';
import type { CreateLocationInput, UpdateLocationInput } from '@itdesk/shared';

function toResponse(doc: ILocationDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    shortCode: doc.shortCode,
    address: doc.address,
    notes: doc.notes,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listLocations() {
  const docs = await Location.find().sort({ name: 1 }) as ILocationDocument[];
  return docs.map(toResponse);
}

export async function getLocation(id: string) {
  const doc = await Location.findById(id) as ILocationDocument | null;
  if (!doc) throw new AppError(404, 'Location not found');
  return toResponse(doc);
}

export async function createLocation(input: CreateLocationInput) {
  const doc = await Location.create(input) as ILocationDocument;
  return toResponse(doc);
}

export async function updateLocation(id: string, input: UpdateLocationInput) {
  const doc = await Location.findByIdAndUpdate(
    id, { $set: input }, { new: true, runValidators: true },
  ) as ILocationDocument | null;
  if (!doc) throw new AppError(404, 'Location not found');
  return toResponse(doc);
}

export async function deleteLocation(id: string) {
  const doc = await Location.findByIdAndDelete(id);
  if (!doc) throw new AppError(404, 'Location not found');
}

/** Used by Meraki sync to resolve or create a location by name */
export async function upsertLocationByName(name: string, shortCode?: string): Promise<ILocationDocument> {
  return Location.findOneAndUpdate(
    { name },
    { $setOnInsert: { name, shortCode } },
    { upsert: true, new: true },
  ) as Promise<ILocationDocument>;
}
