# SaaS Platform Backend

The backend of our SaaS platform is built with Go, providing a robust, scalable API with authentication, database management, and security features. It integrates with various services to offer a complete SaaS infrastructure.

## Tech Stack

- **Language**: Go 1.23+
- **Database**: PostgreSQL
- **Authentication**: JWT + OAuth2 (Google, GitHub)
- **Payment Processing**: LemonSqueezy
- **API**: RESTful endpoints
- **Email**: Plunk
- **Security**: Rate limiting, CORS, secure headers
- **Docker**: Containerization support

## Project Structure

```
server/
├── database/         # Database connection and migration management
├── handlers/         # HTTP request handlers for all API endpoints
├── middleware/       # Custom middleware functions
├── models/           # Data models and database schemas
├── pkg/              # Utility packages and external service integrations
│   ├── analytics/    # Analytics tracking functionality
│   ├── cleanup/      # Cleanup utilities
│   └── lemonsqueezy/ # LemonSqueezy integration
└── main.go           # Application entry point
```

## Key Features

- **Authentication**
  - JWT-based authentication
  - Google & GitHub OAuth2 integration
  - Password hashing and validation
  - Session management
  - Email verification

- **Security**
  - Rate limiting middleware
  - CORS configuration
  - Secure headers
  - Input validation
  - Token-based authentication

- **Payment & Subscription**
  - LemonSqueezy integration for payments
  - Subscription management
  - Webhook processing
  - Checkout flow

- **Marketing & User Engagement**
  - Newsletter subscription
  - Contact form processing
  - Early access waitlist
  - Email notifications

- **Admin Features**
  - Admin authentication
  - Product management
  - User data management
  - Analytics

## Getting Started

1. Install dependencies:
```bash
go mod download
```

2. Set up environment variables:
Copy `.env.example` to `.env` and configure the appropriate values:
```bash
cp .env.example .env
```

Required environment variables include:
- Database connection details
- JWT configuration
- OAuth provider credentials
- LemonSqueezy API keys
- Frontend URLs
- Email service credentials
- Admin credentials

3. Set up the database:
```bash
# Create database
psql -U postgres -c "CREATE DATABASE saas_db;"
```

4. Start the server:
```bash
go run main.go
```

5. For production deployment:
```bash
# Build the application
go build -o app

# Run in production
./app
```

## API Documentation

### Authentication Endpoints
```
POST /auth/register              # Register new user
POST /auth/login                 # Login user
POST /auth/google                # Google OAuth login
POST /auth/github                # GitHub OAuth login
POST /auth/refresh               # Refresh JWT token
POST /auth/logout                # Logout user
POST /auth/forgot-password       # Initiate password reset
POST /auth/reset-password        # Complete password reset
GET  /auth/verify-email/:token   # Verify email address
```

### User Endpoints
```
GET    /user/profile             # Get user profile
PUT    /user/profile             # Update user profile
PUT    /user/password            # Change password
DELETE /user                     # Delete account
```

### Subscription & Payment Endpoints
```
GET  /user/subscription          # Get subscription info
POST /checkout                   # Create checkout session
POST /webhook/lemonsqueezy       # Webhook for payment events
```

### Marketing Endpoints
```
POST /newsletter/subscribe       # Subscribe to newsletter
POST /contact                    # Submit contact form
POST /early-access               # Join early access
```

### Admin Endpoints
```
POST /admin/login                # Admin login
GET  /admin/users                # Get all users
GET  /admin/analytics            # Get analytics data
```

## Docker Support

The server includes a Dockerfile for containerization:

```bash
# Build the Docker image
docker build -t saas-server .

# Run the container
docker run -p 8080:8080 --env-file .env saas-server
```

## Development Guidelines

### Code Structure
- Follow Go best practices and idioms
- Use proper error handling
- Implement middleware for common functionality
- Keep handlers focused and maintainable

### Database
- Use prepared statements
- Implement proper transaction handling
- Follow database normalization principles
- Write efficient queries

### Security
- Validate all input data
- Implement proper rate limiting
- Use secure password hashing
- Follow OWASP security guidelines

### Testing
- Write unit tests for handlers
- Implement integration tests
- Use test fixtures and mocks
- Maintain good test coverage

## Error Handling

- Use appropriate HTTP status codes
- Return consistent error responses
- Log errors properly
- Implement graceful error recovery

## Contributing

1. Follow Go coding conventions
2. Write clear commit messages
3. Include tests for new features
4. Document API changes
5. Submit pull requests for review

## Learn More

- [Go Documentation](https://golang.org/doc/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Authentication](https://jwt.io/introduction)
- [OAuth 2.0](https://oauth.net/2/)
- [LemonSqueezy API](https://docs.lemonsqueezy.com/api)