export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function parsePaginationParams(query: any): PaginationParams {
  const page = Math.max(1, parseInt(query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 25))
  return { page, limit }
}

export function calculatePagination(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1
  }
}

export function getPaginationSkip(page: number, limit: number): number {
  return (page - 1) * limit
}
