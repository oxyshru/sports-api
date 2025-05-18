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

  // --- ADD THIS LINE TO SET CORS HEADER FOR ALL RESPONSES ---
  // Set the Access-Control-Allow-Origin header.
  // Use the ALLOWED_ORIGIN environment variable if set, otherwise allow all (*).
  // In production, it's better to set ALLOWED_ORIGIN to your frontend URL.
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  // --- END ADDITION ---


  res.status(statusCode).json(responseBody);
}

exports.sendApiResponse = sendApiResponse; // Export the function
