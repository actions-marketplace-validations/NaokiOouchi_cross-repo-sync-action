export const isNotFoundError = (err: unknown): boolean => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: number }).status === 404
  )
}
