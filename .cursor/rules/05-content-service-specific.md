# Content Service Specific Rules

## Project Structure

### File Organization
- Keep controllers in `src/controllers/`
- Keep services in `src/services/`
- Keep schemas in `src/schemas/`
- Keep auth logic in `src/auth/`
- Keep config in `src/config/`

### Naming Conventions
- Use kebab-case for file names
- Use PascalCase for class names
- Use camelCase for variables and methods
- Use UPPER_CASE for constants
- Use descriptive names for all identifiers

## Content Management

### Content Operations
- Implement proper content validation
- Use appropriate content types and formats
- Implement content versioning if needed
- Handle multilingual content properly
- Implement content search and filtering

### Collection Management
- Implement proper collection CRUD operations
- Use meaningful collection names
- Implement collection validation
- Handle collection relationships properly
- Implement collection permissions

### Language Support
- Support multiple languages (English, Hindi, Kannada, Tamil, Telugu)
- Implement proper language detection
- Handle language-specific content
- Use proper encoding for different scripts
- Implement language fallbacks

### File Handling
- Implement proper file upload handling
- Validate file types and sizes
- Implement secure file storage
- Handle file metadata properly
- Implement file cleanup procedures

## Database Design

### MongoDB Schema
- Use proper MongoDB schemas
- Implement proper indexing
- Use appropriate data types
- Implement schema validation
- Handle relationships properly

### Data Validation
- Validate all content data
- Implement proper error handling
- Use appropriate data types
- Handle edge cases properly
- Implement data sanitization

## API Design

### RESTful Endpoints
- Use proper HTTP methods
- Implement proper status codes
- Use meaningful endpoint names
- Implement proper pagination
- Handle filtering and sorting

### Authentication & Authorization
- Implement JWT authentication
- Use proper authorization guards
- Implement role-based access control
- Handle token refresh properly
- Implement proper session management

### Error Handling
- Return consistent error responses
- Use proper HTTP status codes
- Implement proper error logging
- Handle validation errors properly
- Implement global error handling

## Performance & Security

### Caching
- Implement appropriate caching strategies
- Use Redis for session storage
- Cache frequently accessed content
- Implement cache invalidation
- Monitor cache performance

### Security
- Validate all inputs
- Implement rate limiting
- Use HTTPS in production
- Implement proper CORS
- Handle sensitive data properly

### Monitoring
- Implement proper logging
- Monitor API performance
- Track content usage metrics
- Implement health checks
- Set up proper alerts 