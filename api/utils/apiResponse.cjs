// api/utils/apiResponse.cjs
// api/utils/apiResponse.cjs
// No types needed at runtime in CJS

/**
 * Helper function to send API responses in the ApiResponse format.
 * @param res VercelResponse object
 * @param success Boolean indicating success
 * @param data Optional data payload
 * @param error Optional error message
 * @param statusCode HTTP status code
 */
function sendApiResponse( // Use function keyword for CJS export
  res, // Untyped variable
  success, // Untyped variable
  data, // Untyped variable
  error, // Untyped variable
  statusCode = success ? 200 : 500 // Default value syntax is fine
) {
  const responseBody = { // Untyped variable
    success,
    data,
    error,
  };
  res.status(statusCode).json(responseBody);
}

exports.sendApiResponse = sendApiResponse; // Export the function

