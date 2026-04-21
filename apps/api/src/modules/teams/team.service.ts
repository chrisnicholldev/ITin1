import mongoose from 'mongoose';
import { Team } from './team.model.js';
import { AppError } from '../../middleware/error.middleware.js';

function toResponse(team: any) {
  return {
    id: String(team._id),
    name: team.name,
    description: team.description ?? null,
    members: (team.members ?? []).map((m: any) => ({
      id: String(m._id ?? m),
      displayName: m.displayName ?? null,
      email: m.email ?? null,
      avatarUrl: m.avatarUrl ?? null,
    })),
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export async function listTeams() {
  const teams = await Team.find()
    .populate('members', 'displayName email avatarUrl')
    .sort({ name: 1 })
    .lean();
  return teams.map(toResponse);
}

export async function getTeam(id: string) {
  const team = await Team.findById(id)
    .populate('members', 'displayName email avatarUrl')
    .lean();
  if (!team) throw new AppError(404, 'Team not found');
  return toResponse(team);
}

export async function createTeam(input: { name: string; description?: string }) {
  const existing = await Team.findOne({ name: input.name.trim() }).lean();
  if (existing) throw new AppError(409, 'A team with that name already exists');
  const team = await Team.create({ name: input.name.trim(), description: input.description?.trim() });
  return toResponse({ ...team.toObject(), members: [] });
}

export async function updateTeam(id: string, input: { name?: string; description?: string | null }) {
  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set['name'] = input.name.trim();
  if (input.description !== undefined) set['description'] = input.description?.trim() ?? null;

  const updated = await Team.findByIdAndUpdate(id, { $set: set }, { new: true })
    .populate('members', 'displayName email avatarUrl')
    .lean();
  if (!updated) throw new AppError(404, 'Team not found');
  return toResponse(updated);
}

export async function deleteTeam(id: string) {
  const result = await Team.findByIdAndDelete(id);
  if (!result) throw new AppError(404, 'Team not found');
}

export async function addMember(teamId: string, userId: string) {
  const updated = await Team.findByIdAndUpdate(
    teamId,
    { $addToSet: { members: new mongoose.Types.ObjectId(userId) } },
    { new: true },
  )
    .populate('members', 'displayName email avatarUrl')
    .lean();
  if (!updated) throw new AppError(404, 'Team not found');
  return toResponse(updated);
}

export async function removeMember(teamId: string, userId: string) {
  const updated = await Team.findByIdAndUpdate(
    teamId,
    { $pull: { members: new mongoose.Types.ObjectId(userId) } },
    { new: true },
  )
    .populate('members', 'displayName email avatarUrl')
    .lean();
  if (!updated) throw new AppError(404, 'Team not found');
  return toResponse(updated);
}
