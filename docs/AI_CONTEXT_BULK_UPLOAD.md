# ALL Content Service — Bulk Upload AI Context Document

> Generated 2026-03-18. Copy this entire file into a new AI chat session.

---

## PART 1 — `.cursor/rules` Files

### `backend-1-architectural-patterns.mdc`

**Trigger:** USE WHEN designing system architecture, implementing design patterns, organizing code structure, or discussing architectural decisions

#### Layered Architecture

**Controller Layer**
- Keep controllers thin and focused on HTTP concerns
- Handle request/response transformation
- Delegate business logic to service layer
- Implement proper input validation
- Return consistent response formats

**Service Layer**
- Contain all business logic and rules
- Orchestrate operations across multiple repositories
- Handle business rule validation
- Implement transaction management
- Make services testable and mockable

**Repository/Data Access Layer**
- Abstract data access logic
- Implement data persistence operations
- Handle database-specific concerns
- Provide clean interfaces for data operations
- Implement proper error handling for data operations

#### Dependency Injection
- Use constructor injection for required dependencies
- Implement proper dependency interfaces/contracts
- Avoid circular dependencies
- Use dependency injection containers when available
- Make dependencies explicit and testable

#### Domain-Driven Design Patterns

**Entities and Value Objects**
- Define clear entity boundaries
- Use value objects for immutable data
- Implement proper equality comparison
- Encapsulate business rules within entities
- Maintain data consistency within aggregates

**Repository Pattern**
- Define repository interfaces in domain layer
- Implement repositories in infrastructure layer
- Use repositories to abstract data access
- Implement unit of work pattern for transactions
- Keep repositories focused on single aggregates

#### Error Handling Patterns

**Exception Hierarchy**
- Create domain-specific exception types
- Use base exception classes for common behavior
- Include relevant context in exceptions
- Implement proper exception handling at boundaries
- Log exceptions with appropriate detail levels

**Result Pattern**
- Use result objects for operations that can fail
- Return success/failure status with data or errors
- Avoid throwing exceptions for expected failures
- Implement proper error propagation
- Provide clear error messages to consumers

#### Authentication and Authorization Patterns

**Authentication**
- Implement token-based authentication
- Use secure token storage and transmission
- Implement proper token validation
- Handle token refresh and expiration
- Log authentication events for security monitoring

**Authorization**
- Implement role-based access control
- Use attribute-based authorization for complex scenarios
- Implement proper permission checking
- Cache authorization decisions when appropriate
- Log authorization failures with relevant context

#### Data Transfer Patterns

**DTO (Data Transfer Object)**
- Use separate models for API requests/responses
- Implement proper validation in DTOs
- Keep DTOs focused on data transfer
- Version DTOs for API evolution
- Use mapping between DTOs and domain models

**Command and Query Separation**
- Separate read and write operations
- Use commands for state-changing operations
- Use queries for data retrieval
- Implement different models for reads and writes
- Optimize each operation type independently

#### Background Processing Patterns

**Event-Driven Architecture**
- Use events for loose coupling
- Implement proper event handling
- Handle event ordering when necessary
- Implement event sourcing where appropriate
- Log event processing results and failures

#### 12-Factor App Principles

**Configuration Management (12-Factor III)**
- Store configuration in environment variables
- Use different configs for different environments
- Never commit secrets to version control
- Implement config validation on application startup
- Group related config into logical sections
- Provide sensible defaults where appropriate

**Process Architecture (12-Factor VI)**
- Design stateless processes that share nothing
- Store session state in external stores (database, cache)
- Make processes disposable and easily replaceable
- Use process isolation for different concerns

**Concurrency (12-Factor VIII)**
- Scale out via the process model
- Use asynchronous patterns for I/O operations
- Implement proper connection pooling for databases and external services
- Use background tasks for non-blocking operations

**Admin Processes (12-Factor XII)**
- Run admin/management tasks as one-off processes
- Use same environment and codebase for admin tasks
- Include admin code in application repository
- Avoid direct database manipulation outside of application

---

### `backend-2-rest-api-design-standards.mdc`

**Trigger:** USE WHEN designing REST APIs, creating endpoints, implementing HTTP methods, or working with API responses and requests

#### RESTful Design Principles
- Use resource-based URLs with proper HTTP methods
- Maintain consistent patterns across all endpoints
- Follow REST architectural constraints

#### URL Structure and Naming
- Use kebab-case for URLs: `/api/v1/weather-stations/{id}`
- Always include API versioning: `/api/v1/`, `/api/v2/`
- Use resource-based URLs, not action-based: `/users` not `/getUsers`
- Use plural nouns for collections: `/users`, `/orders`, `/products`
- Use sub-resources for relationships: `/users/{id}/orders`

#### HTTP Methods and Status Codes
- **GET**: Retrieve resources (200 OK, 404 Not Found)
- **POST**: Create new resources (201 Created, 400 Bad Request, 409 Conflict)
- **PUT**: Update entire resources (200 OK, 404 Not Found)
- **PATCH**: Partial updates (200 OK, 404 Not Found)
- **DELETE**: Remove resources (204 No Content, 404 Not Found)

#### Request/Response Patterns
- Use consistent response format with success, message, data, errors, timestamp
- Implement proper pagination with limit, offset, total, has_next, has_prev
- Include metadata in responses (total count, page info, timestamps)
- Use appropriate HTTP status codes for all scenarios

#### API Versioning
- Implement URL path versioning: `/api/v1/`, `/api/v2/`
- Maintain backward compatibility when possible
- Include version information in API responses

#### Query Parameters
- Use query parameters for filtering, sorting, and pagination
- Implement consistent parameter naming across endpoints
- Validate all query parameters with proper constraints
- Include supported parameters in API schema definitions

---

### `backend-3-code-quality.mdc`

**Trigger:** USE WHEN organizing project structure, implementing code quality standards, managing dependencies, or reviewing code

#### Project Structure
- Use layered architecture with clear separation of concerns
- Separate presentation, business logic, and data access layers
- Implement dependency injection for loose coupling
- Create modular, reusable components
- Follow consistent file and folder naming conventions

#### Naming Conventions

| Element | Convention |
|---------|------------|
| Files/Folders | Follow project conventions |
| Functions | Follow language conventions |
| Variables | Follow language conventions |
| Classes | Follow language conventions |
| Constants | Follow language conventions |
| Interfaces | Follow language conventions |

#### Code Organization
- Keep functions small and focused (< 20 lines)
- Use meaningful and descriptive names
- Implement proper error handling
- Add comments for complex business logic
- Follow DRY (Don't Repeat Yourself) principle
- Group related functionality together
- Minimize dependencies between modules

#### Dependency Management (12-Factor II)
- Explicitly declare and isolate dependencies
- Use dependency management tools appropriate for your language
- Never rely on system-wide packages
- Include exact version numbers in dependency declarations
- Use lock files to ensure consistent dependency versions
- Isolate dependencies from system environment

#### Type Safety
- Use static typing when available in your language
- Implement proper interface/contract definitions
- Use generic/template types where appropriate
- Avoid dynamic typing for critical business logic
- Define clear data contracts between layers
- Validate data at system boundaries

#### Code Review Guidelines
- [ ] Code follows consistent naming conventions
- [ ] Business logic is properly separated from presentation logic
- [ ] No hardcoded values or credentials
- [ ] Proper error handling and logging
- [ ] Tests are included for new functionality
- [ ] Documentation is updated
- [ ] Security considerations are addressed
- [ ] Performance implications are considered
- [ ] Code is readable and maintainable
- [ ] Dependencies are minimal and justified

---

### `backend-4-data-validation.mdc`

**Trigger:** USE WHEN implementing data validation, working with databases, handling input validation, or managing data schemas

#### Database Design
- Use appropriate data types and constraints
- Use schema migrations for database changes
- Implement data validation at database level
- Use transactions for data consistency
- Design for your database type (SQL, NoSQL, Graph, etc.)
- Consider data normalization vs denormalization based on use case

#### Schema Definition
- Define clear data models and schemas
- Use validation metadata appropriate for your language/framework
- Implement custom validators for business rules
- Document all schema fields and their purposes
- Version your schemas for API evolution
- Define data contracts between system boundaries
- Specify validation rules declaratively when possible

#### Database Operations
- Use parameterized queries to prevent injection attacks
- Implement proper connection pooling
- Use transactions for multi-step operations
- Implement soft deletes when data retention is required
- Use appropriate indexing strategies for performance
- Handle database-specific error conditions gracefully
- Implement proper connection timeout and retry logic

#### Input Validation
- Validate all input parameters (path, query, body)
- Use schema validation libraries appropriate for your framework
- Implement field-level validation with clear error messages
- Use type checking and constraints (min/max values, string lengths)
- Validate data formats (email, phone, dates, URLs)
- Reject invalid input early in the request pipeline
- Use allowlists rather than blocklists when possible

#### Validation Error Handling
- Return structured validation errors with consistent format
- Include field names, error codes, and descriptive messages
- Provide user-friendly error messages
- Log validation failures with appropriate detail levels
- Implement progressive validation feedback
- Structure error messages to support internationalization
- Distinguish between client errors and server errors

#### Data Sanitization
- Sanitize input data before processing
- Remove or escape dangerous characters
- Normalize data formats (trim whitespace, standardize case)
- Implement data transformation pipelines
- Validate data integrity after transformations
- Remove or mask sensitive data in logs and error messages

#### Error Response Format

```json
{
  "valid": false,
  "errors": [
    { "field": "email", "code": "INVALID_FORMAT", "message": "Email format is invalid" },
    { "field": "age", "code": "OUT_OF_RANGE", "message": "Age must be between 13 and 120" }
  ]
}
```

---

### `backend-5-error-handling.mdc`

**Trigger:** USE WHEN implementing error handling, managing exceptions, adding logging, or debugging application issues

#### Exception Management
- Create custom exception classes for different error types
- Implement global exception handlers
- Use structured error responses with consistent format
- Log errors with appropriate context and correlation IDs
- Handle validation errors with field-level details
- Implement exception hierarchies for better error categorization
- Use appropriate error handling patterns for your architecture

#### Error Response Format (REST/HTTP APIs)

```json
{
  "success": false,
  "message": "Error description",
  "error_type": "ValidationError",
  "errors": [
    { "field": "email", "message": "Invalid email format", "code": "INVALID_FORMAT" }
  ],
  "timestamp": "2024-01-01T00:00:00Z",
  "request_id": "req-123456"
}
```

#### Logging & Monitoring
- Implement comprehensive logging (debug, info, warn, error, fatal levels)
- Use structured logging with correlation IDs and context
- Expose application performance and health metrics
- Log critical errors with appropriate severity levels
- Include business metrics in structured logs
- Structure logs for centralized aggregation
- Use appropriate log levels to avoid noise
- Include relevant context without exposing sensitive data

#### Logs (12-Factor XI)
- Treat logs as event streams
- Write logs to stdout/stderr for aggregation
- Use structured logging with correlation IDs and context
- Log all important application events
- Include request/response correlation in logs

#### Error Classification

**Client Errors (4xx equivalent)**
- Invalid Input: Bad request data, validation errors
- Authentication Required: Missing or invalid credentials
- Authorization Denied: Insufficient permissions for operation
- Resource Not Found: Requested resource doesn't exist
- Conflict: Resource state conflict, duplicate entries
- Rate Limited: Too many requests, quota exceeded

**Server Errors (5xx equivalent)**
- Internal Error: Unexpected application errors
- Service Unavailable: External dependencies down
- Timeout: Operation exceeded time limits
- Resource Exhausted: Out of memory, disk space, etc.

**Business Logic Errors**
- Validation Failed: Business rule violations
- State Conflict: Invalid state transitions
- Dependency Missing: Required resources unavailable
- Operation Not Allowed: Business constraints violated

#### Exception Hierarchy

```
BaseException
├── ClientException (4xx-type errors)
│   ├── ValidationException
│   ├── AuthenticationException
│   └── AuthorizationException
├── ServerException (5xx-type errors)
│   ├── DatabaseException
│   ├── ExternalServiceException
│   └── ConfigurationException
└── BusinessException
    ├── InsufficientFundsException
    └── InvalidStateTransitionException
```

---

### `backend-6-performance-optimization.mdc`

**Trigger:** USE WHEN optimizing performance, implementing caching, handling async operations, or improving application speed

#### Async Programming
- Use asynchronous patterns for I/O operations
- Implement proper connection pooling for databases and external services
- Use background tasks for non-blocking operations
- Leverage concurrent operations where appropriate
- Avoid blocking operations on main execution thread

#### Caching Strategy
- Implement multi-level caching (in-memory, distributed cache, persistent storage)
- Use appropriate TTL values based on data volatility
- Cache frequently accessed data and expensive computations
- Implement cache invalidation strategies
- Use conditional requests for client-side caching

#### Caching TTL Guidelines

| Data Type | TTL (seconds) | Use Case |
|-----------|---------------|----------|
| Static Reference | 3600+ | Countries, categories, constants |
| User Sessions | 1800 | Authentication tokens, user state |
| API Responses | 300-1800 | Weather data, prices, external APIs |
| Database Queries | 60-300 | Frequently accessed data |
| Real-time Data | 10-60 | Live metrics, counters, notifications |
| Configuration | 7200+ | App settings, feature flags |
| Computed Results | 900-3600 | Reports, analytics, aggregations |

#### Database Optimization
- Use proper indexing strategies
- Implement connection pooling
- Optimize queries to avoid N+1 problems
- Use pagination for large datasets
- Implement transactions for consistency when supported

#### Pagination Implementation
- Use offset-based pagination for simple cases
- Implement cursor-based pagination for large datasets
- Include pagination metadata in responses
- Limit maximum page size to prevent resource exhaustion
- Provide navigation links/tokens for next/previous pages

#### I/O Optimization
- **Batch operations**: Combine multiple requests
- **Compression**: Reduce payload sizes
- **Streaming**: Handle large data sets efficiently
- **Prefetching**: Load anticipated data in advance

#### Concurrency (12-Factor VIII)
- Scale out via the process model
- Use asynchronous patterns for I/O operations
- Implement proper connection pooling for databases and external services
- Use background tasks for non-blocking operations
- Leverage concurrent operations where appropriate
- Avoid blocking operations on main execution thread

---

### `backend-7-security-implementation.mdc`

**Trigger:** USE WHEN implementing security features, handling authentication, managing authorization, or addressing security vulnerabilities

#### Authentication & Authorization
- Implement token-based authentication with proper validation
- Use role-based access control (RBAC) for authorization
- Secure API endpoints with proper authentication mechanisms
- Implement rate limiting to prevent abuse
- Use secure communication protocols for all API interactions
- Implement proper token lifecycle management (creation, refresh, revocation)
- Use strong cryptographic algorithms for token generation and validation

#### Input Validation & Sanitization
- Validate all input parameters (path, query, body, headers)
- Use schema validation libraries appropriate for your framework
- Sanitize inputs to prevent injection attacks
- Implement field-level validation with clear error messages
- Use type checking and constraints (min/max values, string lengths)
- Validate data formats (email, phone, dates, URLs)
- Implement allowlist-based validation when possible
- Reject malformed or suspicious input early in the request pipeline

#### Security Configuration
- Implement security policies appropriate for your protocol
- Configure cross-origin access controls properly
- Use environment variables for sensitive configuration
- Never expose stack traces or internal errors in production
- Implement proper error handling without information leakage
- Use secure defaults for all configuration options
- Implement proper logging without exposing sensitive data

#### Access Control & Permissions
- Implement principle of least privilege
- Use fine-grained permissions for different operations
- Validate permissions at both endpoint and data levels
- Implement proper session/context management
- Validate user permissions on every request

#### Data Protection
- Encrypt sensitive data at rest and in transit
- Use appropriate hashing algorithms for passwords
- Implement proper key management practices
- Sanitize data before logging or error reporting
- Use secure random number generation
- Implement data masking for sensitive information
- Follow data retention and deletion policies

#### Error Handling & Information Disclosure
- Implement consistent error response formats
- Avoid exposing sensitive information in error messages
- Use generic error messages for security-related failures
- Implement proper logging of security events
- Use correlation IDs for tracking without exposing internals
- Return appropriate error codes without revealing system details

---

### `backend-8-testing-standards.mdc`

**Trigger:** USE WHEN writing tests, implementing testing strategies, setting up test environments, or ensuring code quality through testing

#### Testing Requirements
- Write unit tests for business logic (>80% coverage)
- Implement integration tests for service interfaces
- Use test fixtures and mocks appropriately
- Test error scenarios and edge cases
- Implement automated testing in deployment pipeline
- Test both synchronous and asynchronous operations
- Validate input/output contracts and data transformations

#### Unit Testing
- Test business logic in isolation from external dependencies
- Mock external services and data sources
- Test both success and failure scenarios
- Use descriptive test names that explain the behavior being tested
- Follow AAA pattern (Arrange, Act, Assert)
- Test single responsibility per test case
- Ensure tests are deterministic and repeatable

#### Integration Testing
- Test service interfaces end-to-end
- Test data persistence and retrieval operations
- Test authentication and authorization mechanisms
- Test error handling and input validation
- Test performance under expected load conditions
- Test inter-service communication and contracts
- Validate data consistency across system boundaries

#### Test Coverage Goals
- Minimum 80% code coverage for all production code
- 100% coverage for critical business logic and security components
- Cover all error paths and edge cases
- Test all public interfaces and contracts
- Monitor coverage trends over time and prevent regression
- Include boundary condition testing
- Test both happy path and failure scenarios

#### Security Testing
- Test authentication and authorization mechanisms
- Test input validation and sanitization
- Test for common security vulnerabilities
- Test access control and permission enforcement
- Test secure communication and data protection
- Test session management and token handling
- Validate error messages don't leak sensitive information

---

### `nestjs-1-core-architecture.mdc`

**Trigger:** USE WHEN implementing NestJS core architecture patterns, organizing project structure, managing dependencies, or setting up modular applications

#### Controller Layer Rules
- Keep controllers thin and focused on HTTP concerns only
- Handle request/response transformation and validation
- Delegate all business logic to service layer
- Use proper HTTP decorators and status codes
- Implement comprehensive input validation with DTOs

#### Service Layer Rules
- Contain all business logic and domain rules
- Orchestrate operations across multiple repositories
- Handle business rule validation and transaction management
- Make services testable and mockable
- Use dependency injection for all external dependencies

#### Repository Layer Rules
- Abstract data access logic from business logic
- Implement data persistence operations with proper error handling
- Handle database-specific concerns and optimizations
- Provide clean interfaces for data operations

#### Dependency Injection Patterns
- Use constructor injection for all dependencies
- Inject interfaces, not concrete implementations when possible
- Make dependencies explicit and testable
- Avoid circular dependencies between modules

#### Module Organization
- Each feature should be a self-contained module
- Import only required dependencies to avoid circular references
- Follow single responsibility principle for module design

#### Project Structure Standards

```
src/
├── modules/
│   ├── users/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── entities/
│   │   ├── dto/
│   │   └── repositories/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   └── interceptors/
├── config/
└── shared/
```

#### File Naming Conventions

| File Type | Convention | Example |
|-----------|------------|---------|
| Controllers | `*.controller.ts` | `users.controller.ts` |
| Services | `*.service.ts` | `users.service.ts` |
| Entities | `*.entity.ts` | `user.entity.ts` |
| DTOs | `*.dto.ts` | `create-user.dto.ts` |
| Modules | `*.module.ts` | `users.module.ts` |

#### Code Quality Standards

**Type Safety Rules**
- Use TypeScript for all code with strict mode enabled
- Implement proper interface definitions for all contracts
- Use generic types where appropriate
- Avoid `any` type unless absolutely necessary

**Naming Convention Rules**
- Classes: PascalCase (`UsersController`, `UserService`)
- Methods/Variables: camelCase (`findAllUsers`, `isAuthenticated`)
- Constants: UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- Interfaces: PascalCase with `I` prefix (`IUserService`)

#### Anti-Patterns to Avoid
- Don't put business logic in controllers
- Don't create circular dependencies between modules
- Don't use synchronous operations for I/O
- Don't hardcode configuration values
- Don't skip input validation and sanitization
- Don't ignore proper error handling and logging
- Don't use `any` type without justification
- Don't create God objects or services
- Don't ignore TypeScript compiler warnings
- Don't skip proper dependency injection
- Don't use direct database queries in controllers

---

### `nestjs-2-api-design-rest.mdc`

**Trigger:** USE WHEN designing RESTful APIs, implementing controllers, handling HTTP requests/responses, or creating API documentation

#### URL Structure Standards
- Use kebab-case for URLs: `/api/v1/weather-stations/{id}`
- Always include API versioning: `/api/v1/`, `/api/v2/`
- Use plural nouns for collections: `/api/v1/users`, `/api/v1/orders`
- Use sub-resources for relationships: `/api/v1/users/{id}/orders`
- Avoid action-based URLs: use `/api/v1/users` not `/api/v1/getUsers`

#### HTTP Status Codes

```
200 OK          → GET, PUT, PATCH successful
201 Created     → POST successful
204 No Content  → DELETE successful
400 Bad Request → Invalid request data
401 Unauthorized → Authentication required
403 Forbidden   → Access denied
404 Not Found   → Resource doesn't exist
409 Conflict    → Resource conflict
422 Unprocessable → Validation errors
429 Too Many Requests → Rate limited
500 Internal Server Error → Unexpected server error
502 Bad Gateway → External service error
503 Service Unavailable → Service temporarily down
```

#### Consistent Response Format

```typescript
// Success response structure
interface ApiResponse<T> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

// Error response structure
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    timestamp: string;
    requestId: string;
    path: string;
    method: string;
  };
}
```

**Rules:**
- Always wrap all successful responses in the `ApiResponse<T>` structure
- Use `ApiErrorResponse` for all error responses
- Only return plain DTOs internally within the service layer; controllers must always wrap responses before sending to the client

#### Request Validation with DTOs
- Use class-validator decorators for all input validation
- Implement proper transformation with class-transformer
- Provide clear validation error messages
- Use appropriate validation constraints for each field

#### Controller Anti-Patterns
- Don't put business logic in controllers
- Don't skip input validation
- Don't use synchronous operations for I/O
- Don't ignore proper exception handling
- Don't skip API documentation

---

### `nestjs-3-documentation.mdc`

**Trigger:** USE WHEN creating API documentation, implementing Swagger, documenting code, or writing README files

#### Swagger Configuration Rules
- Configure Swagger with proper metadata and authentication
- Use tags to organize endpoints logically
- Include request/response examples
- Document all query parameters and path parameters
- Set up proper authentication schemes

#### API Endpoint Documentation Rules
- Use descriptive operation summaries and descriptions
- Document all possible response codes and their meanings
- Include example request and response bodies
- Document authentication requirements
- Use proper HTTP status codes

#### Code Documentation Standards
- Add clear comments and docstrings to all public APIs and interfaces
- Include code examples in function/method documentation
- Use appropriate documentation format for your language
- Create README files for modules and packages
- Document configuration options and environment variables in code
- Use clear and concise language in code comments

#### Documentation Anti-Patterns
- Don't skip Swagger decorators for public endpoints
- Don't use generic or unclear endpoint descriptions
- Don't ignore request/response examples
- Don't skip error response documentation
- Don't write comments that explain what the code does (focus on why)
- Don't skip JSDoc comments for public methods
- Don't use outdated or incorrect comments

---

### `nestjs-4-deployment-config.mdc`

**Trigger:** USE WHEN configuring deployments, managing environment variables, setting up Docker, CI/CD, or production configurations

#### Environment Configuration Rules
- Use environment variables for all configuration values
- Implement configuration validation with proper schemas
- Separate configuration by environment (dev, staging, production)
- Use secure defaults and validate required environment variables
- Store configuration in environment variables (12-Factor III)
- Use configuration validation to catch errors early
- Implement proper type conversion for environment variables
- Provide sensible defaults for development environments

#### Configuration Validation Schema (Joi)

```typescript
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_LIMIT: Joi.number().default(100),
});
```

#### Configuration Anti-Patterns
- Don't hardcode configuration values in code
- Don't commit secrets to version control
- Don't use same configuration across all environments
- Don't ignore environment variable validation
- Don't skip configuration documentation
- Don't use weak or default secrets in production

---

### `nestjs-5-error-handling.mdc`

**Trigger:** USE WHEN implementing error handling, exception filters, logging, monitoring, or debugging applications

#### Exception Hierarchy Rules
- Create custom exception classes for different error types
- Implement global exception handlers for consistent error responses
- Use structured error responses with correlation IDs
- Log errors with appropriate context and severity levels
- Handle validation errors with field-level details

#### Custom Exception Pattern

```typescript
export abstract class BaseException extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  readonly timestamp: string;
  readonly correlationId: string;
  constructor(message: string, context?: Record<string, any>, correlationId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.correlationId = correlationId || randomUUID();
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BusinessLogicException extends BaseException {
  readonly statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly errorCode = 'BUSINESS_LOGIC_ERROR';
}

export class ValidationException extends BaseException {
  readonly statusCode = HttpStatus.BAD_REQUEST;
  readonly errorCode = 'VALIDATION_ERROR';
}

export class ResourceNotFoundException extends BaseException {
  readonly statusCode = HttpStatus.NOT_FOUND;
  readonly errorCode = 'RESOURCE_NOT_FOUND';
}

export class AuthenticationException extends BaseException {
  readonly statusCode = HttpStatus.UNAUTHORIZED;
  readonly errorCode = 'AUTHENTICATION_ERROR';
}
```

#### Global Exception Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const errorResponse = this.buildErrorResponse(exception, request);
    this.logError(exception, request, errorResponse);
    response.status(errorResponse.statusCode).json(errorResponse);
  }
}
```

#### Error Handling Anti-Patterns
- Don't catch exceptions without proper handling
- Don't expose sensitive information in error messages
- Don't ignore error logging and monitoring
- Don't use generic error messages for all scenarios
- Don't skip error correlation and tracking
- Don't throw exceptions for expected business logic failures
- Don't ignore proper exception hierarchy
- Don't log sensitive data (passwords, tokens, personal info)
- Don't ignore structured logging formats
- Don't skip correlation IDs for request tracking
- Don't log everything at ERROR level
- Don't ignore log rotation and retention policies

---

### `nestjs-6-database-performance.mdc`

**Trigger:** USE WHEN working with databases, implementing repositories, optimizing queries, caching, or performance tuning

#### Database Configuration Rules
- Use appropriate data types and constraints for your database
- Implement proper relationships and foreign keys
- Use schema migrations for database changes
- Implement proper connection pooling
- Use transactions for data consistency

#### Backing Services Rules (12-Factor IV)
- Treat backing services as attached resources
- Use connection pooling for database services
- Implement circuit breakers for external services
- Handle service failures gracefully
- Use same backing services across environments

#### Performance Optimization Rules
- Use proper indexing strategies for frequently queried fields
- Implement connection pooling for database connections
- Optimize queries to avoid N+1 problems
- Use pagination for large datasets
- Implement transactions for consistency

#### Repository Pattern with Caching

```typescript
@Injectable()
export class UserRepository {
  async findByIdWithCache(id: string): Promise<User | null> {
    const cacheKey = `user:${id}`;
    let user = await this.cacheManager.get<User>(cacheKey);
    if (!user) {
      user = await this.repository.findOne({ where: { id } });
      if (user) await this.cacheManager.set(cacheKey, user, { ttl: 300 });
    }
    return user;
  }

  async findWithPagination(page: number, limit: number): Promise<PaginatedResult<User>> {
    const [items, total] = await this.repository
      .createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.firstName', 'user.lastName'])
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total, hasPrevious: page > 1 };
  }
}
```

#### Performance Anti-Patterns
- Don't use SELECT * in production queries
- Don't ignore database indexes for frequently queried columns
- Don't use synchronous operations for database calls
- Don't skip connection pooling configuration
- Don't ignore query optimization
- Don't use ORM without understanding generated SQL
- Don't skip database migrations for schema changes
- Don't use N+1 queries — use proper joins or eager loading
- Don't ignore pagination for large datasets
- Don't use LIKE queries without proper indexes

---

### `nestjs-7-security-auth.mdc`

**Trigger:** USE WHEN implementing authentication, authorization, security guards, input validation, or handling security concerns

#### Token-Based Authentication Rules
- Implement JWT-based authentication with proper validation
- Use secure token storage and transmission
- Implement proper token validation and refresh mechanisms
- Handle token expiration and renewal gracefully
- Log authentication events for security monitoring

#### Role-Based Access Control Rules
- Implement role-based access control (RBAC) for authorization
- Use attribute-based authorization for complex scenarios
- Implement proper permission checking at endpoint level
- Cache authorization decisions when appropriate
- Log authorization failures with relevant context

#### Input Validation & Sanitization Rules
- Use comprehensive validation with class-validator
- Transform and sanitize input data
- Implement custom validation decorators where needed
- Provide clear validation error messages

#### Global Validation Pipe Configuration

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // Strip properties that don't have decorators
  forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
  transform: true,            // Automatically transform payloads to DTO instances
  transformOptions: { enableImplicitConversion: true },
  disableErrorMessages: process.env.NODE_ENV === 'production',
  validationError: { target: false, value: false },
}));
```

#### Security Anti-Patterns
- Don't store passwords in plain text
- Don't use weak hashing algorithms (MD5, SHA1)
- Don't ignore token expiration
- Don't use predictable session IDs
- Don't transmit credentials in URLs
- Don't implement authentication logic in controllers
- Don't rely solely on client-side authorization
- Don't skip server-side validation
- Don't trust client-side validation
- Don't expose sensitive information in error messages
- Don't log sensitive data
- Don't ignore security headers
- Don't use HTTP in production
- Don't ignore rate limiting

---

### `nestjs-8-testing-quality.mdc`

**Trigger:** USE WHEN writing tests, implementing testing strategies, ensuring code quality, or setting up test environments

#### Testing Strategy Rules
- Write unit tests for all services and business logic
- Create integration tests for database operations
- Implement end-to-end tests for critical user flows
- Use proper mocking for external dependencies
- Maintain high test coverage (>80%) for critical paths

#### Test Organization Rules
- Organize tests alongside source code
- Use descriptive test names and clear assertions
- Follow AAA pattern (Arrange, Act, Assert)
- Create reusable test fixtures and helpers
- Implement proper test isolation and cleanup

#### Mock Repository Pattern

```typescript
export type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

export const createMockRepository = <T = any>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn(),
  })),
});
```

#### Testing Anti-Patterns
- Don't test implementation details, test behavior
- Don't create tests that depend on other tests
- Don't use real external services in unit tests
- Don't skip mocking of dependencies
- Don't write tests that are too complex
- Don't ignore test isolation and cleanup
- Don't skip edge cases and error scenarios
- Don't use production database for testing
- Don't skip database cleanup between tests
- Don't test too many layers at once
- Don't ignore transaction rollback in tests

---

## PART 2 — BulkUploadJob Mongoose Schema

**File:** `backend/src/schemas/bulk-upload-job.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Schema({ collection: 'bulk_upload_jobs', timestamps: true })
export class BulkUploadJob {
  @Prop({ type: String, default: uuidv4, index: true, unique: true })
  jobId: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true,
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  totalRows: number;

  @Prop({ type: Number, default: 0 })
  processedRows: number;

  @Prop({ type: Number, default: 0 })
  failedRows: number;

  @Prop({ type: Number, default: 0 })
  resumeCount: number;

  @Prop({ type: String, required: false })
  errorMessage: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  wizardConfig: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  generatedCollections: Record<string, string>;

  @Prop({ type: String, required: true })
  zipFilename: string;

  @Prop({ type: String, required: false })
  authToken: string;

  /**
   * IMPORTANT: `_id: false` is required to prevent Mongoose from silently
   * stripping subdocument entries during save/update operations.
   */
  @Prop({
    type: [
      {
        _id: false,
        rowIndex: { type: Number },
        sheetName: { type: String },
        error: { type: String },
      },
    ],
    default: [],
  })
  failedRowDetails: { rowIndex: number; sheetName: string; error: string }[];
}

export type BulkUploadJobDocument = BulkUploadJob & Document;
export const BulkUploadJobSchema = SchemaFactory.createForClass(BulkUploadJob);
```

### Key Schema Notes

| Field | Purpose |
|-------|---------|
| `timestamps: true` | Mongoose auto-injects `createdAt` and `updatedAt` (not declared on class, always present on retrieved docs) |
| `resumeCount` | Tracks how many times a job has been resumed. UI allows max 2 resumes (`resumeCount >= 2` blocks the Resume button) |
| `failedRowDetails` | Per-row error array. `_id: false` is critical — without it Mongoose silently strips subdocument entries |
| `processedRows` | Watermark for Pass 2. During resume, rows before this watermark are skipped UNLESS they are in `failedRowDetails` |
| `generatedCollections` | Maps auto-created collection names to their IDs (used in two-pass CREATE flows for Collection template) |
| `zipFilename` | Original ZIP filename stored on disk in `STORAGE_DIR`. Needed for resume — Pass 2 re-reads the ZIP |
| `authToken` | JWT bearer token captured at upload time, stored for use during resume (no need for user to re-authenticate) |

---

## PART 3 — WizardConfig Interface

**File:** `backend/src/services/bulk-ingest.service.ts`

```typescript
export interface WizardConfig {
  collectionId:      string;   // Target collection (required for content templates)
  language:          string;   // e.g. 'en', 'te', 'kn', 'hi', 'ta', 'gu'
  tags:              string[]; // Exactly one tag from the filtered tag list (wizard Step 4)
  status:            string;   // 'live' | 'draft'
  publisher:         string;   // e.g. 'ekstep'
  target_lang_code:  string;   // Used for Two-Pass multilingual lookup (M4-M9)
  templateType:      TemplateType;
  action:            'CREATE' | 'UPDATE';
}

export type TemplateType =
  | 'M1 to M2 Read Along Content'
  | 'M3 Read Along Content'
  | 'M4 to M6 Read Along Content'
  | 'M7 to M9 Read Along Content'
  | 'M1 Mechanics Content'
  | 'M2 Mechanics Content'
  | 'M3 Mechanics Content'
  | 'M4 to M6 Mechanics Content'
  | 'M7 to M9 Mechanics Content'
  | 'M10 to M15 Mechanics Content'
  | 'Collection'
  | 'Multilingual';

export interface TemplateConfig {
  expectedTabs: string[];                               // Lowercase tab names expected in the ZIP Excel
  dbTarget: 'content' | 'collection' | 'multilingual'; // Which MongoDB collection to write
  skipTagsCheck?: boolean;                              // true for Collection and Multilingual templates
}

export const TEMPLATE_CONFIGS: Record<TemplateType, TemplateConfig> = {
  'M1 to M2 Read Along Content':  { expectedTabs: ['read along'], dbTarget: 'content' },
  'M3 Read Along Content':        { expectedTabs: ['read along'], dbTarget: 'content' },
  'M4 to M6 Read Along Content':  { expectedTabs: ['read along'], dbTarget: 'content' },
  'M7 to M9 Read Along Content':  { expectedTabs: ['read along'], dbTarget: 'content' },
  'M1 Mechanics Content':         { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'M2 Mechanics Content':         { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'M3 Mechanics Content':         { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'M4 to M6 Mechanics Content':   { expectedTabs: ['read along', 'fill in the blanks', 'mcq', 'jumbled words'], dbTarget: 'content' },
  'M7 to M9 Mechanics Content':   { expectedTabs: ['read along', 'fill in the blanks', 'mcq', 'jumbled words'], dbTarget: 'content' },
  'M10 to M15 Mechanics Content': { expectedTabs: ['read along', 'mechanic'], dbTarget: 'content' },
  'Collection':                   { expectedTabs: ['collection'], dbTarget: 'collection', skipTagsCheck: true },
  'Multilingual':                 { expectedTabs: ['multilingual'], dbTarget: 'multilingual', skipTagsCheck: true },
};

export const SUPPORTED_LANGUAGES = ['en', 'te', 'kn', 'hi', 'ta', 'gu'] as const;
```

---

## PART 4 — ContentPayload and Supporting Types

**File:** `backend/src/services/bulk-processor.service.ts`

```typescript
/**
 * A single data row extracted from the Excel workbook.
 */
interface ParsedExcelRow {
  /** Optional custom audio filename (treated specially during asset preprocessing). */
  audio_file?: string;
  [key: string]: string | number | boolean | null | undefined;
}

/** Typed representation of a single contentSourceData entry. */
interface ContentSourceDataItem {
  text?: string;
  audioUrl?: string;
  inst_audioUrl?: string;
  [key: string]: unknown;
}

/** Typed representation of one language entry inside payload.multilingual. */
interface MultilingualEntry {
  text?: string;
  audio_url?: string;
  image_url?: string;
  [key: string]: unknown;
}

/** Hint object attached to a mechanics_data entry. */
interface HintsEntry {
  text?: string;
  audio_url?: string;
  image_url?: string;
  [key: string]: unknown;
}

/** One option inside a mechanics exercise. */
interface MechanicsOption {
  text?: string;
  audio_url?: string;
  image_url?: string;
  isAns?: boolean;
  [key: string]: unknown;
}

/** One syllable chunk inside an M1_L mechanics entry. */
interface SyllableEntry {
  text?: string;
  audio_url?: string;
  [key: string]: unknown;
}

/** One item inside an M2_L imageAudioMap array. */
interface ImageAudioEntry {
  text?: string;
  audio_url?: string;
  image_url?: string;
  multilingual_id?: string;
  [key: string]: unknown;
}

/** A single entry inside payload.mechanics_data. */
interface MechanicsEntry {
  mechanics_id?: string;
  language?: string;
  text?: string;
  jumbled_text?: string;
  audio_url?: string;
  image_url?: string;
  time_limit?: number;
  options?: MechanicsOption[];
  hints?: HintsEntry;
  syllable?: SyllableEntry[];
  imageAudioMap?: ImageAudioEntry[];
  [key: string]: unknown;
}

/**
 * The assembled content/collection/multilingual payload passed to persistSingleRow.
 */
interface ContentPayload {
  contentId?: string;
  language?: string;
  collectionId?: string;
  multilingual_id?: string;
  contentSourceData?: ContentSourceDataItem[];
  multilingual?: Record<string, MultilingualEntry>;
  mechanics_data?: MechanicsEntry[];
  [key: string]: unknown;
}

/** A single failed-row entry accumulated during Pass 1 or Pass 2. */
interface FailedRowEntry {
  rowIndex: number;
  sheetName: string;
  error: string;
}

/**
 * Lean job document with timestamps injected at runtime by Mongoose `timestamps: true`.
 * These fields are not declared on the BulkUploadJob class but are always present
 * on documents retrieved from MongoDB.
 */
type JobStatusResult = BulkUploadJob & { createdAt: Date; updatedAt: Date };
```

---

## PART 5 — Key Architecture Decisions & Invariants

### Two-Pass Processing Architecture

**Pass 1 — `runPass1Validation` (Read-only)**
- Parses Excel, validates ALL rows
- Accumulates all errors into `FailedRowEntry[]` (does NOT fail-fast)
- On any errors: saves `failedRowDetails` to MongoDB job, throws a single `IngestionError` summarising count
- NO S3 uploads, NO audio generation, NO MongoDB writes to content/collection/multilingual

**Pass 2 — `runPass2Execution` (Write phase)**
- Asset pipeline: find file in ZIP → convert if needed → upload to S3
- Audio pipeline: custom file or gTTS auto-generate → upload to S3
- MongoDB upsert: content / collection / multilingual
- Each row failure is caught, stored in `job.failedRowDetails`, and processing CONTINUES (no abort)
- `job.processedRows` uses `Math.max` — never goes backwards
- Saves progress to MongoDB after every row

---

### Resume Logic

```typescript
// Check if resumable
const canResume =
  job.status === 'FAILED' ||
  (job.status === 'COMPLETED' && (job.failedRows || 0) > 0);

// Cooldown guard
const msSinceUpdate = Date.now() - new Date(job.updatedAt).getTime();
if (msSinceUpdate < RESUME_COOLDOWN_MS) { /* return 409 */ }

// State transition on resume
job.status = 'PENDING';
job.errorMessage = undefined;
job.resumeCount = (job.resumeCount || 0) + 1;
await job.save();
```

```typescript
// In runPass2Execution — fault-tolerant skip
const failedIndexes = new Set<number>(
  (job.failedRowDetails || []).map((d) => d.rowIndex)
);

for (let i = 0; i < rows.length; i++) {
  const rowIdx = i + 2; // Excel is 1-indexed, row 1 is header

  // Skip rows already successfully processed
  if (i < job.processedRows && !failedIndexes.has(rowIdx)) continue;

  // If retrying a previously failed row — clean up stale error entry
  if (failedIndexes.has(rowIdx)) {
    job.failedRowDetails = (job.failedRowDetails || []).filter((d) => d.rowIndex !== rowIdx);
    job.markModified('failedRowDetails');
    job.failedRows = Math.max(0, (job.failedRows || 0) - 1);
    failedIndexes.delete(rowIdx);
  }

  // ... process row, catch errors, push to failedRowDetails ...

  job.processedRows = Math.max(job.processedRows || 0, i + 1);
  await job.save();
}
```

---

### S3 Folder Routing (5 Rules, evaluated in order)

| Priority | Condition | S3 Folder |
|----------|-----------|-----------|
| 1 | File is an image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`) | `mechanics_images/` |
| 2 | `config.dbTarget === 'multilingual'` (Multilingual Collection template) | `multilingual_audios/` |
| 3 | Column is `instruction_audio_file` | `all-audio-files/${language}/` |
| 4 | Column key contains both 'multilingual' AND 'audio' (M1/M2 embedded multilingual) | `multilingual_audios/` |
| 5 | Everything else (mechanics audio, contentSourceData audio) | `mechanics_audios/` |

**For TTS auto-generation of main content audio:**
```typescript
const s3Key = config.dbTarget === 'multilingual'
  ? `multilingual_audios/${wavFilename}`
  : `all-audio-files/${resolvedLang}/${wavFilename}`;
```

---

### TTS (`synthesizeAndUploadTTS`)

```typescript
// Returns Promise<void> — throws on failure
private async synthesizeAndUploadTTS(text: string, lang: string, s3Key: string): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // gTTS → save MP3 → ffmpeg convert to WAV → upload to S3
      lastError = null;
      break;
    } catch (err) {
      lastError = err as Error;
      // cleanup temp files
    }
  }
  if (lastError) throw lastError;
  if (!fs.existsSync(tmpWavPath)) throw new Error('WAV file was not produced after TTS synthesis');
  // S3 upload
}
```

Callers wrap with educator-friendly error messages:
```typescript
try {
  await this.synthesizeAndUploadTTS(text, resolvedLang, s3Key);
} catch (ttsErr) {
  throw new Error(
    `Auto-audio generation failed for language '${resolvedLang}': ` +
    `${(ttsErr as Error).message}. ` +
    `Please manually provide an audio file in the 'audio_file' column.`,
  );
}
```

---

### Validation Error Accumulation Pattern

```typescript
// In validateM1M2Row — accumulate ALL errors, throw once at end
private validateM1M2Row(row: ParsedExcelRow, _rowIdx: number): void {
  const rowErrors: string[] = [];

  this.checkM1M2RequiredColumns(row, rowErrors);

  const lang = normalizeLanguage(String(row['language'] ?? ''));
  if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(lang)) {
    rowErrors.push(
      `Column 'language' contains an unsupported value '${lang}'. Allowed: ${SUPPORTED_LANGUAGES.join(', ')}.`
    );
    throw new IngestionError(rowErrors.join(' • '));
  }

  const text = String(row['text'] ?? '').trim();
  if (lang === 'en') {
    if (text && !M1M2_ENGLISH_REGEX.test(text)) {
      rowErrors.push("Column 'text' must contain only English characters, digits, spaces, and common punctuation.");
    }
    this.checkAtLeastOneMultilingualText(row, rowErrors);
    this.checkMultilingualScripts(row, rowErrors);
  } else if (text) {
    this.checkIndicScript(lang, text, rowErrors, 'text');
  }

  if (rowErrors.length > 0) throw new IngestionError(rowErrors.join(' • '));
}

// checkIndicScript passes columnName for precise error messages
private checkIndicScript(lang: string, text: string, rowErrors: string[], columnName: string): void {
  const regex = M1M2_SCRIPT_REGEXES[lang];
  if (regex && !regex.test(text)) {
    rowErrors.push(
      `Column '${columnName}' does not match the ${lang} script. ` +
      `Ensure it contains only ${lang} characters, digits, spaces, and standard punctuation.`,
    );
  }
}
```

---

### M1/M2 Script Regex Constants

```typescript
const M1M2_ENGLISH_REGEX = /^[a-zA-Z0-9\s.,!?'"()\-]+$/;

const M1M2_SCRIPT_REGEXES: Readonly<Record<string, RegExp>> = {
  kn: /^[\u0C80-\u0CFF0-9\s.,!?'"()\-]+$/,  // Kannada
  te: /^[\u0C00-\u0C7F0-9\s.,!?'"()\-]+$/,  // Telugu
  hi: /^[\u0900-\u097F0-9\s.,!?'"()\-]+$/,  // Devanagari / Hindi
  ta: /^[\u0B80-\u0BFF0-9\s.,!?'"()\-]+$/,  // Tamil
};

/** Matches any M1/M2 multilingual column key: "multilingual {2-letter code} text|audio". */
const M1M2_ML_COL = /^multilingual ([a-z]{2}) (text|audio)$/;
```

---

### Key Constants

```typescript
const STORAGE_DIR        = process.env.STORAGE_DIR || '/tmp/bulk-uploads';
const MAX_ROWS           = 1000;
const S3_BUCKET          = 'all-dev-content-service';
const STALE_CUTOFF_MS    = 48 * 60 * 60 * 1000;  // 48 hours
const RESUME_COOLDOWN_MS = 10_000;                // 10 seconds
```

---

### Critical Bug Fixes Applied (for awareness)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `failedRowDetails` not shown in UI | Controller's `getJobStatus` manually listed response fields and never included `failedRowDetails` or `resumeCount` | Added both fields explicitly to the `reply.send({...})` object |
| `failedRowDetails` silently stripped by Mongoose | Missing `_id: false` in subdocument schema caused Mongoose matching/diffing issues during updates | Added `_id: false` to subdocument definition in schema |
| Wrong TTS error message (said language unsupported for kn/te) | `synthesizeAndUploadTTS` swallowed real error, returned `false`, callers assumed the language code was invalid | Changed to `Promise<void>`, stores `lastError` across attempts, throws real error after all 3 retries |
| Pass 1 only showed first error per row | Used early `throw` inside validation helpers | Switched to `rowErrors: string[]` accumulation, single `throw` at end joined with ` • ` |
| Resume rewound to already-processed rows | Skip condition was `i < job.processedRows` without exception for `failedIndexes` | Added `&& !failedIndexes.has(rowIdx)` so failed rows ARE retried despite being before the watermark |

---

### API Endpoints

```
POST   /v1/content/bulk-upload            — Upload ZIP + wizard config, returns 202 + jobId
GET    /v1/content/bulk-upload/status/:id — Poll job progress, returns full job status
POST   /v1/content/bulk-upload/resume/:id — Resume a FAILED job (max 2 times)
```

**GET status response shape:**
```typescript
{
  statusCode:       200,
  jobId:            string,
  status:           'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
  totalRows:        number,
  processedRows:    number,
  failedRows:       number,
  resumeCount:      number,   // ← was missing in original controller, now fixed
  errorMessage:     string | null,
  failedRowDetails: { rowIndex: number; sheetName: string; error: string }[], // ← was missing, now fixed
  createdAt:        Date,
  updatedAt:        Date,
}
```

---

### Frontend Components

**`frontend/src/components/bulk-upload/JobProgress.tsx`** — displays job status card
- Polls via `useJobStatus(jobId)` (React Query, refetchInterval when active)
- Resume button: visible only when `canResume` (FAILED, or COMPLETED+failedRows, and `resumeCount < 2`)
- Per-row error list: capped at 50 shown, overflow shows "…and N more errors" message
- `maxRetriesReached = resumeCount >= 2 && job.failedRows > 0` → shows amber warning, Start Over button
- `isValidationFailure = status === 'FAILED' && processedRows === 0` → shows Upload New File button only

**`frontend/src/types/index.ts`** — `JobStatus` interface includes:
```typescript
interface FailedRowDetail {
  rowIndex: number;
  sheetName: string;
  error: string;
}

interface JobStatus {
  statusCode: number;
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  processedRows: number;
  failedRows: number;
  resumeCount: number;
  errorMessage: string | null;
  failedRowDetails: FailedRowDetail[];
  createdAt: string;
  updatedAt: string;
}
```

---

### File Locations

| Component | Path |
|-----------|------|
| Bulk Upload Controller | `backend/src/controllers/bulk-upload.controller.ts` |
| Bulk Processor Service | `backend/src/services/bulk-processor.service.ts` |
| Bulk Ingest Service (builders, parsers) | `backend/src/services/bulk-ingest.service.ts` |
| BulkUploadJob Schema | `backend/src/schemas/bulk-upload-job.schema.ts` |
| App Module | `backend/src/app.module.ts` |
| Frontend BulkUploadPage | `frontend/src/pages/BulkUploadPage.tsx` |
| Frontend JobProgress component | `frontend/src/components/bulk-upload/JobProgress.tsx` |
| Frontend WizardForm component | `frontend/src/components/bulk-upload/WizardForm.tsx` |
| Frontend bulk-upload API client | `frontend/src/api/bulk-upload.ts` |
| Frontend useBulkUpload hook | `frontend/src/hooks/useBulkUpload.ts` |
| Frontend types | `frontend/src/types/index.ts` |
| API Docs | `docs/CONTENT_SERVICE_DOCS.md` |
| Frontend Architecture Docs | `docs/FRONTEND_BULK_UPLOAD_ARCHITECTURE.md` |
