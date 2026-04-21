import mongoose, { type Document, type Model } from 'mongoose';

export interface ITeam {
  name: string;
  description?: string;
  members: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamDocument extends ITeam, Document {}

const teamSchema = new mongoose.Schema<ITeamDocument>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

teamSchema.index({ name: 1 });

export const Team: Model<ITeamDocument> = mongoose.model<ITeamDocument>('Team', teamSchema);
