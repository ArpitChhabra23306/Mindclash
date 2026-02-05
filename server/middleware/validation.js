import { validationResult, body, param, query } from 'express-validator';

/**
 * Handle validation errors
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
            })),
        });
    }
    next();
};

/**
 * Auth validations
 */
export const registerValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be 3-20 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    validate,
];

export const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate,
];

/**
 * Debate validations
 */
export const createDebateValidation = [
    body('type')
        .optional()
        .isIn(['1v1', '2v2', '3v3', 'battleRoyale'])
        .withMessage('Invalid debate type'),
    body('category')
        .optional()
        .isIn(['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social', 'Other'])
        .withMessage('Invalid category'),
    body('isAnonymous')
        .optional()
        .isBoolean()
        .withMessage('isAnonymous must be a boolean'),
    validate,
];

export const submitArgumentValidation = [
    body('content')
        .notEmpty()
        .withMessage('Argument content is required')
        .isLength({ max: 2000 })
        .withMessage('Argument cannot exceed 2000 characters'),
    validate,
];

/**
 * Bet validations
 */
export const placeBetValidation = [
    body('debateId')
        .notEmpty()
        .withMessage('Debate ID is required')
        .isMongoId()
        .withMessage('Invalid debate ID'),
    body('predictedWinner')
        .isIn(['pro', 'con'])
        .withMessage('Predicted winner must be "pro" or "con"'),
    body('amount')
        .isInt({ min: 10, max: 10000 })
        .withMessage('Bet amount must be between 10 and 10000 XP'),
    validate,
];

/**
 * Message validations
 */
export const messageValidation = [
    body('content')
        .notEmpty()
        .withMessage('Message content is required')
        .isLength({ max: 500 })
        .withMessage('Message cannot exceed 500 characters'),
    validate,
];

/**
 * Community validations
 */
export const createCommunityValidation = [
    body('name')
        .isLength({ min: 3, max: 50 })
        .withMessage('Community name must be 3-50 characters')
        .matches(/^[a-zA-Z0-9 _-]+$/)
        .withMessage('Community name contains invalid characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters'),
    body('category')
        .optional()
        .isIn(['Politics', 'Technology', 'Sports', 'Philosophy', 'Science', 'Entertainment', 'Economy', 'Social', 'Other', 'General'])
        .withMessage('Invalid category'),
    validate,
];

/**
 * Pagination validation
 */
export const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    validate,
];

/**
 * MongoDB ID validation
 */
export const mongoIdValidation = (paramName = 'id') => [
    param(paramName)
        .isMongoId()
        .withMessage(`Invalid ${paramName}`),
    validate,
];

export default {
    validate,
    registerValidation,
    loginValidation,
    createDebateValidation,
    submitArgumentValidation,
    placeBetValidation,
    messageValidation,
    createCommunityValidation,
    paginationValidation,
    mongoIdValidation,
};
