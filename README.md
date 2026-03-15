# CloudBib

Self-hosted reference manager for teams — manage libraries, papers, PDFs and annotations collaboratively.

## Tech Stack

- **Web App:** Next.js 15 + TypeScript (App Router)
- **Database:** PostgreSQL 16 via Prisma ORM
- **Auth:** Auth.js with database sessions
- **PDF Storage:** Local server filesystem
- **Deployment:** Docker Compose

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Development

```bash
# Start PostgreSQL
docker compose up -d db

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run first migration
npm run db:migrate

# Start dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Production (Docker)

```bash
docker compose up --build
```

### Environment Variables

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Public URL of the app |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `APP_STORAGE_ROOT` | Directory for PDF uploads (default: `./storage`) |

## Project Structure

```
app/                    # Next.js App Router pages & API routes
├── api/                # API endpoints
├── (auth)/             # Auth pages (login, register)
├── dashboard/          # Dashboard
└── libraries/          # Library views
components/             # Shared React components
lib/                    # Server-side utilities
├── auth/               # Auth.js configuration
├── db/                 # Prisma client singleton
├── storage/            # Local file storage helpers
└── validations/        # Zod schemas & env validation
prisma/                 # Prisma schema & migrations
storage/uploads/        # PDF upload directory (gitignored)
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations (dev) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:studio` | Open Prisma Studio |

## License

MIT
