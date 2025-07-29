# NestJS Framework Rules

## Architecture Patterns

### Module Organization
- Organize code into feature modules
- Use shared modules for common functionality
- Implement proper module imports/exports
- Follow NestJS module structure conventions
- Use dynamic modules when needed

### Dependency Injection
- Use constructor injection for dependencies
- Implement proper service interfaces
- Use providers appropriately
- Implement custom providers when needed
- Follow NestJS DI patterns

### Controllers
- Keep controllers thin and focused
- Use DTOs for request/response validation
- Implement proper HTTP decorators
- Use route parameters and query strings correctly
- Implement proper error handling

### Services
- Implement business logic in services
- Use proper service interfaces
- Implement proper error handling
- Use async/await for database operations
- Keep services testable and mockable

### Guards & Interceptors
- Implement authentication guards
- Use interceptors for logging and transformation
- Implement proper authorization
- Use custom decorators when needed
- Follow NestJS security patterns

### Database Integration
- Use TypeORM or Mongoose properly
- Implement proper entity/schema definitions
- Use repositories for data access
- Implement proper migrations
- Use transactions when needed

### Validation & DTOs
- Use class-validator for DTO validation
- Implement proper validation pipes
- Use class-transformer for transformations
- Create comprehensive DTOs
- Implement proper error responses

### Testing
- Use @nestjs/testing for unit tests
- Mock dependencies properly
- Test controllers and services separately
- Use supertest for e2e tests
- Implement proper test fixtures

### Configuration
- Use ConfigModule for configuration
- Implement proper environment validation
- Use configuration service properly
- Implement feature flags when needed
- Use proper configuration structure

### Documentation
- Use Swagger/OpenAPI decorators
- Document all endpoints properly
- Use proper response schemas
- Implement API versioning
- Keep documentation up to date 