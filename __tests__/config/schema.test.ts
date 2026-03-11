import { describe, it, expect } from 'vitest'
import { syncConfigSchema } from '../../src/config/schema'

describe('syncConfigSchema', () => {
  it('should validate a valid config', () => {
    const input = {
      sync: [
        {
          src: 'rules/coding-style.md',
          dest: '.github/copilot-instructions.md',
          repos: ['org/repo-a', 'org/repo-b'],
        },
      ],
    }

    const result = syncConfigSchema.parse(input)
    expect(result.sync).toHaveLength(1)
    expect(result.sync[0].repos).toEqual(['org/repo-a', 'org/repo-b'])
  })

  it('should reject empty sync array', () => {
    expect(() => syncConfigSchema.parse({ sync: [] })).toThrow()
  })

  it('should reject empty repos array', () => {
    const input = {
      sync: [
        {
          src: 'file.md',
          dest: 'file.md',
          repos: [],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject invalid repo format', () => {
    const input = {
      sync: [
        {
          src: 'file.md',
          dest: 'file.md',
          repos: ['not-a-valid-repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject empty src path', () => {
    const input = {
      sync: [
        {
          src: '',
          dest: 'file.md',
          repos: ['org/repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject empty dest path', () => {
    const input = {
      sync: [
        {
          src: 'file.md',
          dest: '',
          repos: ['org/repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject missing required fields', () => {
    expect(() => syncConfigSchema.parse({})).toThrow()
    expect(() => syncConfigSchema.parse({ sync: [{}] })).toThrow()
  })

  it('should validate multiple sync entries', () => {
    const input = {
      sync: [
        {
          src: 'a.md',
          dest: 'b.md',
          repos: ['org/repo-a'],
        },
        {
          src: 'c.md',
          dest: 'd.md',
          repos: ['org/repo-b', 'org/repo-c'],
        },
      ],
    }

    const result = syncConfigSchema.parse(input)
    expect(result.sync).toHaveLength(2)
  })

  it('should accept delete option as true', () => {
    const input = {
      sync: [
        {
          src: 'configs/',
          dest: '.github/configs/',
          repos: ['org/repo-a'],
          delete: true,
        },
      ],
    }

    const result = syncConfigSchema.parse(input)
    expect(result.sync[0].delete).toBe(true)
  })

  it('should accept delete option as false', () => {
    const input = {
      sync: [
        {
          src: 'configs/',
          dest: '.github/configs/',
          repos: ['org/repo-a'],
          delete: false,
        },
      ],
    }

    const result = syncConfigSchema.parse(input)
    expect(result.sync[0].delete).toBe(false)
  })

  it('should allow omitting delete option', () => {
    const input = {
      sync: [
        {
          src: 'file.md',
          dest: 'dest.md',
          repos: ['org/repo-a'],
        },
      ],
    }

    const result = syncConfigSchema.parse(input)
    expect(result.sync[0].delete).toBeUndefined()
  })

  it('should reject non-boolean delete value', () => {
    const input = {
      sync: [
        {
          src: 'configs/',
          dest: '.github/configs/',
          repos: ['org/repo-a'],
          delete: 'yes',
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject absolute src path', () => {
    const input = {
      sync: [
        {
          src: '/etc/passwd',
          dest: 'leaked.txt',
          repos: ['org/repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject src path with .. traversal', () => {
    const input = {
      sync: [
        {
          src: '../../../etc/passwd',
          dest: 'leaked.txt',
          repos: ['org/repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject absolute dest path', () => {
    const input = {
      sync: [
        {
          src: 'file.md',
          dest: '/tmp/file.md',
          repos: ['org/repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })

  it('should reject dest path with special characters', () => {
    const input = {
      sync: [
        {
          src: 'file.md',
          dest: '` | injected |',
          repos: ['org/repo'],
        },
      ],
    }

    expect(() => syncConfigSchema.parse(input)).toThrow()
  })
})
