import { z } from 'zod';

export const CreateDocFolderSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().default(0),
});

export const UpdateDocFolderSchema = CreateDocFolderSchema.partial();

export const DocFolderResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number(),
  articleCount: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateArticleSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().default(''),
  folderId: z.string().min(1).optional(),
  linkedAssets: z.array(z.string()).default([]),
  linkedLocationId: z.string().optional(),
  tags: z.array(z.string().max(50)).default([]),
  published: z.boolean().default(false),
  sourceUrl: z.string().url().optional().or(z.literal('')),
});

export const UpdateArticleSchema = CreateArticleSchema.partial();

export const ArticleResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  body: z.string(),
  folder: z.object({ id: z.string(), name: z.string(), icon: z.string().optional() }).optional(),
  linkedAssets: z.array(z.object({ id: z.string(), name: z.string(), assetTag: z.string() })),
  linkedLocation: z.object({ id: z.string(), name: z.string() }).optional(),
  tags: z.array(z.string()),
  published: z.boolean(),
  sourceUrl: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  createdBy: z.object({ id: z.string(), displayName: z.string() }),
  updatedBy: z.object({ id: z.string(), displayName: z.string() }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CreateDocFolderInput = z.infer<typeof CreateDocFolderSchema>;
export type UpdateDocFolderInput = z.infer<typeof UpdateDocFolderSchema>;
export type DocFolderResponse = z.infer<typeof DocFolderResponseSchema>;
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;
export type ArticleResponse = z.infer<typeof ArticleResponseSchema>;
