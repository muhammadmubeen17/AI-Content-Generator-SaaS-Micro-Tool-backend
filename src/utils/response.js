/**
 * Standard success response wrapper
 */
const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    ...data,
  })
}

/**
 * Paginated list response
 */
const sendPaginatedResponse = (res, { data, total, page, limit }, message = 'Success') => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  })
}

module.exports = { sendSuccess, sendPaginatedResponse }
