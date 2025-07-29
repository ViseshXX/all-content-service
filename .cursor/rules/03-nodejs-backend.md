# Node.js Backend Rules

## TypeScript Best Practices

### Type Safety
- Use strict TypeScript configuration
- Define proper interfaces and types
- Avoid using `any` type
- Use union types and generics appropriately
- Implement proper type guards

### Code Organization
- Use ES6+ features (async/await, destructuring, etc.)
- Implement proper module structure
- Use barrel exports for clean imports
- Separate concerns into different modules
- Follow consistent naming conventions

### Error Handling
- Use try-catch blocks for async operations
- Implement proper error boundaries
- Create custom error classes when needed
- Use proper error logging
- Handle promise rejections properly

### Performance
- Use async/await instead of callbacks
- Implement proper memory management
- Use streams for large data processing
- Implement caching strategies
- Optimize database queries

### Testing
- Use Jest for unit testing
- Mock external dependencies
- Test async functions properly
- Use test fixtures and factories
- Implement integration tests

### Package Management
- Use npm or yarn consistently
- Lock dependency versions
- Regularly update dependencies
- Audit packages for security issues
- Use semantic versioning

### Environment & Configuration
- Use dotenv for environment variables
- Implement configuration validation
- Use different configs per environment
- Never commit .env files
- Use environment-specific settings 