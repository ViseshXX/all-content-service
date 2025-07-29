# Cursor Rules for Content Service

This directory contains cursor rules for the ALL Content Service project, based on the [Tekdi Cursor Rules](https://github.com/tekdi/tekdi-cursor-rules) repository.

## Rules Structure

The rules are organized in the following order of precedence:

1. **01-tekdi-common.md** - General Tekdi coding standards and practices
2. **02-backend-common.md** - Backend development best practices
3. **03-nodejs-backend.md** - Node.js and TypeScript specific rules
4. **04-nestjs-framework.md** - NestJS framework specific patterns
5. **05-content-service-specific.md** - Project-specific rules for content service

## Usage

These rules will guide Cursor AI to:
- Follow consistent coding standards
- Implement proper NestJS patterns
- Maintain project-specific conventions
- Ensure security and performance best practices
- Follow the established project structure

## Project Context

This is a NestJS backend service for managing multilingual content with support for:
- Multiple languages (English, Hindi, Kannada, Tamil, Telugu)
- Content and collection management
- JWT authentication
- MongoDB database
- File upload handling

## Key Technologies

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with Passport
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI

## Maintenance

To update these rules:
1. Edit the appropriate rule file
2. Follow the established naming convention
3. Test the changes with Cursor AI
4. Commit changes with descriptive messages

## References

- [Tekdi Cursor Rules Repository](https://github.com/tekdi/tekdi-cursor-rules)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) 