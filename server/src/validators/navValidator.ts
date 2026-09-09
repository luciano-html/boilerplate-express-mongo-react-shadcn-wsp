import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const navContentBlockSchema = z.object({
  type: z.enum(['heading', 'text', 'image']),
  value: z.string().max(5000),
});

export const navSectionSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(slugRegex, 'El slug debe ser kebab-case (minusculas, guiones)'),
  label: z.string().min(1).max(60),
  type: z.enum(['category', 'page']),
  order: z.number().int().min(0),
  isActive: z.boolean(),
  content: z.object({ blocks: z.array(navContentBlockSchema).max(50) }).optional(),
});

export const updateNavSectionsSchema = z.object({
  navSections: z
    .array(navSectionSchema)
    .max(20)
    .refine((s) => new Set(s.map((x) => x.slug)).size === s.length, {
      message: 'Hay slugs repetidos',
    }),
});

export type UpdateNavSectionsInput = z.infer<typeof updateNavSectionsSchema>;
