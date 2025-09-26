# CMS Web Backend

A Node.js/Express backend API for the CMS Web application.

## Features

- User authentication and management
- Case management system
- Progress tracking
- Data synchronization
- RESTful API endpoints

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your configuration

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Start the production server:
   ```bash
   npm start
   ```

## API Endpoints

- `GET /api/` - API information
- `GET /api/health` - Health check
- `POST /api/users/login` - User login
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `GET /api/cases` - Get all cases
- `POST /api/cases` - Create case
- `PUT /api/cases/:id` - Update case
- `GET /api/progress` - Get all progress
- `POST /api/progress` - Create progress entry

## Deployment

This application is configured to deploy on Render as a Web Service.
