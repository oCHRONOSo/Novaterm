## Novaterm AI (Next.js)

Full-stack rebuild with Next.js (App Router, TypeScript, Tailwind + shadcn/ui), Prisma (MySQL), and Socket.IO + ssh2 for remote server automation.

### Setup
1) Copy `env.example` to `.env` and set:
```
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="set-a-strong-secret"
OLLAMA_HOST="http://localhost:11434"
SOCKET_HOST="http://localhost:3000"
NEXT_PUBLIC_SOCKET_HOST="http://localhost:3000"
```
2) Install deps: `npm install`
3) Push schema: `npm run db:push`
4) Seed demo user: `npm run db:seed` (creates demo@example.com / password123)

### Run
- Next dev only: `npm run dev` (no sockets)
- Next + Socket.IO server: `npm run dev:server`
- Production server: `npm run build && npm run start:server`

### Features
- Auth (register/login/logout) with JWT HTTP-only cookie
- Protected `/app` dashboard
- SSH terminal via Socket.IO + ssh2 (resize, input)
- Script runner uploads to `/tmp` with cleanup (scripts in `./scripts`)
- AI assistant hitting Ollama `generate` API
- Recent connections persisted via Prisma

### Notes
- Ensure the database user has privileges for the target schema.
- Socket server reads scripts from `./scripts` (copied from legacy project).
- Update env vars for deployment and secure `JWT_SECRET`.
