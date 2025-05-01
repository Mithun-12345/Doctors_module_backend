
  
  // utils/sanitize.js
  const DOMPurify = require('dompurify');
  const { JSDOM } = require('jsdom');
  
  // Create a DOMPurify instance using a virtual DOM
  const window = new JSDOM('').window;
  const purify = DOMPurify(window);
  
  exports.sanitizeInput = (input) => {
    if (!input) return input;
    
    // Convert to string if not already
    const stringInput = String(input);
    
    // Sanitize the input to remove any potentially malicious code
    const sanitized = purify.sanitize(stringInput, {
      ALLOWED_TAGS: [], // No HTML tags allowed
      ALLOWED_ATTR: [] // No HTML attributes allowed
    });
    
    return sanitized;
  };