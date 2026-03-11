import { z } from 'zod'
import { validateRelativePath, validateDestPath } from '../utils/validation'

const fileMappingSchema = z.object({
  src: z
    .string()
    .min(1, 'src path must not be empty')
    .refine(validateRelativePath, 'src must be a relative path without .. segments'),
  dest: z
    .string()
    .min(1, 'dest path must not be empty')
    .refine(validateRelativePath, 'dest must be a relative path without .. segments')
    .refine(validateDestPath, 'dest path contains invalid characters'),
  repos: z
    .array(
      z
        .string()
        .regex(
          /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/,
          'repo must be in "owner/repo" format'
        )
    )
    .min(1, 'repos must have at least one entry'),
  delete: z.boolean().optional(),
})

const syncConfigSchema = z.object({
  sync: z.array(fileMappingSchema).min(1, 'sync must have at least one entry'),
})

export { syncConfigSchema, fileMappingSchema }
