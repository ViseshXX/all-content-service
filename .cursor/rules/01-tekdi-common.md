# Tekdi Common Rules

## General Coding Standards

### Code Quality
- Write clean, readable, and maintainable code
- Follow DRY (Don't Repeat Yourself) principle
- Use meaningful variable and function names
- Add comprehensive comments for complex logic
- Keep functions small and focused on a single responsibility

### Git Practices
- Write clear, descriptive commit messages
- Use conventional commit format: `type(scope): description`
- Create feature branches for new development
- Review code before merging to main branch
- Keep commits atomic and focused

### Documentation
- Document all public APIs and interfaces
- Maintain up-to-date README files
- Include setup and deployment instructions
- Document environment variables and configuration

### Testing
- Write unit tests for all business logic
- Aim for high test coverage (80%+)
- Use descriptive test names
- Test both success and error scenarios
- Mock external dependencies

### Security
- Never commit sensitive data (API keys, passwords)
- Use environment variables for configuration
- Validate all user inputs
- Implement proper authentication and authorization
- Follow OWASP security guidelines

### Performance
- Optimize database queries
- Use caching where appropriate
- Minimize network requests
- Profile and optimize bottlenecks
- Consider scalability in design decisions 