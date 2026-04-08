const { body, param, query } = require('express-validator')
const { CONTENT_TYPES, TONES, LENGTHS } = require('../config/constants')

const generateValidator = [
  body('contentType')
    .notEmpty().withMessage('Content type is required')
    .isIn(CONTENT_TYPES).withMessage(`Content type must be one of: ${CONTENT_TYPES.join(', ')}`),

  body('tone')
    .notEmpty().withMessage('Tone is required')
    .isIn(TONES).withMessage(`Tone must be one of: ${TONES.join(', ')}`),

  body('length')
    .notEmpty().withMessage('Length is required')
    .isIn(LENGTHS).withMessage(`Length must be one of: ${LENGTHS.join(', ')}`),

  body('prompt')
    .trim()
    .notEmpty().withMessage('Prompt is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Prompt must be between 10 and 2000 characters'),

  body('templateId')
    .optional()
    .isMongoId().withMessage('Invalid template ID'),
]

const historyQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('type')
    .optional()
    .isIn(CONTENT_TYPES).withMessage(`Type must be one of: ${CONTENT_TYPES.join(', ')}`),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Search query too long'),
]

const contentIdValidator = [
  param('id')
    .isMongoId().withMessage('Invalid content ID'),
]

module.exports = { generateValidator, historyQueryValidator, contentIdValidator }
