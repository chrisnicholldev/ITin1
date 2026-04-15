import mongoose, { type Document, type Model } from 'mongoose';

// ── Template ──────────────────────────────────────────────────────────────────

export interface ITemplateItem {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category?: string;
  required: boolean;
}

export interface IChecklistTemplate {
  name: string;
  type: 'onboarding' | 'offboarding' | 'other';
  description?: string;
  items: ITemplateItem[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChecklistTemplateDocument extends IChecklistTemplate, Document {}

const templateItemSchema = new mongoose.Schema<ITemplateItem>({
  title:       { type: String, required: true, trim: true },
  description: { type: String },
  category:    { type: String, trim: true },
  required:    { type: Boolean, default: true },
});

const checklistTemplateSchema = new mongoose.Schema<IChecklistTemplateDocument>(
  {
    name:        { type: String, required: true, trim: true },
    type:        { type: String, enum: ['onboarding', 'offboarding', 'other'], default: 'onboarding' },
    description: { type: String },
    items:       [templateItemSchema],
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

checklistTemplateSchema.index({ type: 1 });

export const ChecklistTemplate: Model<IChecklistTemplateDocument> =
  mongoose.model<IChecklistTemplateDocument>('ChecklistTemplate', checklistTemplateSchema);

// ── Run ───────────────────────────────────────────────────────────────────────

export interface IRunItem {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category?: string;
  required: boolean;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
}

export interface IChecklistRun {
  templateId: mongoose.Types.ObjectId;
  templateName: string;
  type: 'onboarding' | 'offboarding' | 'other';
  employeeName: string;
  employeeDepartment?: string;
  assignedTo?: string;
  dueDate?: Date;
  notes?: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  completedAt?: Date;
  items: IRunItem[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChecklistRunDocument extends IChecklistRun, Document {}

const runItemSchema = new mongoose.Schema<IRunItem>({
  title:       { type: String, required: true },
  description: { type: String },
  category:    { type: String },
  required:    { type: Boolean, default: true },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date },
  completedBy: { type: String },
  notes:       { type: String },
});

const checklistRunSchema = new mongoose.Schema<IChecklistRunDocument>(
  {
    templateId:         { type: mongoose.Schema.Types.ObjectId, ref: 'ChecklistTemplate', required: true },
    templateName:       { type: String, required: true },
    type:               { type: String, enum: ['onboarding', 'offboarding', 'other'], default: 'onboarding' },
    employeeName:       { type: String, required: true, trim: true },
    employeeDepartment: { type: String, trim: true },
    assignedTo:         { type: String, trim: true },
    dueDate:            { type: Date },
    notes:              { type: String },
    status:             { type: String, enum: ['in_progress', 'completed', 'cancelled'], default: 'in_progress' },
    completedAt:        { type: Date },
    items:              [runItemSchema],
    createdBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

checklistRunSchema.index({ status: 1 });
checklistRunSchema.index({ type: 1 });
checklistRunSchema.index({ createdAt: -1 });

export const ChecklistRun: Model<IChecklistRunDocument> =
  mongoose.model<IChecklistRunDocument>('ChecklistRun', checklistRunSchema);
