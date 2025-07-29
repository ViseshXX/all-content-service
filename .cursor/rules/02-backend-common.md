# Backend Development Rules

## Architecture & Design

### API Design
- Follow RESTful conventions for API endpoints
- Use consistent HTTP status codes
- Implement proper error handling and responses
- Version your APIs appropriately
- Use meaningful endpoint names and HTTP methods

### Data Validation
- Validate all incoming requests
- Sanitize user inputs
- Use schema validation for request/response data
- Return appropriate error messages for invalid data
- Implement input length and type restrictions

### Database Practices
- Use database migrations for schema changes
- Implement proper indexing strategies
- Use transactions for data consistency
- Optimize queries for performance
- Implement proper connection pooling

### Error Handling
- Log all errors with appropriate levels
- Return consistent error response format
- Don't expose sensitive information in error messages
- Implement global error handling middleware
- Use proper HTTP status codes

### Security
- Implement rate limiting
- Use HTTPS in production
- Validate and sanitize all inputs
- Implement proper CORS policies
- Use secure authentication methods

### Logging & Monitoring
- Log important application events
- Use structured logging
- Implement health check endpoints
- Monitor application performance
- Set up alerting for critical issues

### Configuration
- Use environment variables for configuration
- Implement configuration validation
- Use different configs for different environments
- Never hardcode sensitive values
- Use configuration management tools 