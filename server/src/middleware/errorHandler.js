import logger from '../services/logger.service.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Mask internal stack traces in production / user-facing errors
  logger.error('api', `Unhandled API error on ${req.method} ${req.url}: ${message}`, {
    stack: err.stack,
    params: req.params,
    query: req.query
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    statusCode
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`,
    statusCode: 404
  });
}

export default {
  errorHandler,
  notFoundHandler
};
