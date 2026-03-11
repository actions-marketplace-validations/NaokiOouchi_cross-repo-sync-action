import { describe, it, expect } from 'vitest'
import { isNotFoundError } from '../../src/github/errors'

describe('isNotFoundError', () => {
  it('should return true for an object with status 404', () => {
    expect(isNotFoundError({ status: 404 })).toBe(true)
  })

  it('should return false for an object with status 500', () => {
    expect(isNotFoundError({ status: 500 })).toBe(false)
  })

  it('should return false for an object with status 200', () => {
    expect(isNotFoundError({ status: 200 })).toBe(false)
  })

  it('should return false for null', () => {
    expect(isNotFoundError(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isNotFoundError(undefined)).toBe(false)
  })

  it('should return false for a string', () => {
    expect(isNotFoundError('not found')).toBe(false)
  })

  it('should return false for a number', () => {
    expect(isNotFoundError(404)).toBe(false)
  })

  it('should return false for an object without status', () => {
    expect(isNotFoundError({ message: 'Not Found' })).toBe(false)
  })

  it('should return true for an error-like object with status 404', () => {
    const error = new Error('Not Found')
    Object.assign(error, { status: 404 })
    expect(isNotFoundError(error)).toBe(true)
  })
})
