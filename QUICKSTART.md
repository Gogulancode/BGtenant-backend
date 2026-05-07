# Quick Start Guide

This guide will help you get the Business Accountability Backend up and running quickly.

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** or **yarn** - Comes with Node.js

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Then edit `.env` and update with your database credentials:
```env
DATABASE_URL="postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/accountability?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=3000
```

### 3. Setup Database

Make sure PostgreSQL is running, then create the database:
```bash
# Using psql
createdb accountability

# Or connect to PostgreSQL and run:
# CREATE DATABASE accountability;
```

### 4. Run Prisma Migrations

Generate Prisma Client and run database migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Seed the Database (Optional)

Populate the database with initial data:
```bash
npx prisma db seed
```

This creates:
- Admin user (email: `admin@example.com`, password: `Admin@123`)
- Sample metrics
- Business snapshot

### 6. Start the Development Server

```bash
npm run start:dev
```

The server will start on `http://localhost:3000`

### 7. Access API Documentation

Open your browser and navigate to:
```
http://localhost:3000/api/docs
```

You'll see the interactive Swagger API documentation.

## Testing the API

### 1. Register a New User

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test@123",
    "businessType": "Startup"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "Admin@123"
  }'
```

Save the `accessToken` from the response.

### 3. Get User Profile

```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Using VS Code Tasks

Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and type "Run Task":

- **Start Dev Server** - Starts the development server with hot-reload
- **Build Project** - Compiles TypeScript to JavaScript
- **Prisma Generate** - Regenerates Prisma Client
- **Prisma Migrate Dev** - Creates and applies migrations
- **Prisma Seed** - Seeds the database

## Common Issues

### Issue: Database connection error

**Solution**: Make sure PostgreSQL is running and the `DATABASE_URL` in `.env` is correct.

```bash
# Check if PostgreSQL is running
# On Windows (PowerShell):
Get-Service postgresql*

# On Mac/Linux:
brew services list  # If installed via Homebrew
# or
systemctl status postgresql
```

### Issue: Port 3000 already in use

**Solution**: Change the `PORT` in `.env` to a different port (e.g., 3001).

### Issue: Prisma Client not found

**Solution**: Run Prisma generate:
```bash
npx prisma generate
```

## Next Steps

1. **Explore the API**: Use the Swagger docs at `/api/docs`
2. **Integrate with Frontend**: Connect your Next.js or Flutter app
3. **Customize**: Modify modules to fit your specific business needs
4. **Deploy**: Follow the deployment guide in README.md

## Development Tips

- **Auto-reload**: Changes to your code will automatically restart the server
- **Database Management**: Use Prisma Studio to view/edit data:
  ```bash
  npx prisma studio
  ```
- **Logs**: Check the console for request logs and errors
- **Debug**: Use VS Code's debugger by pressing F5

## Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with watch mode
- `npm run start:debug` - Start server in debug mode
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review the Prisma schema at `prisma/schema.prisma`
- Explore the module structure in `src/`

Happy coding! 🚀