# Mmela Platform

Unified platform for Mmela Financial Services.

**Modules:**
- **Sales** — Call centre CRM (leads, clients, policies, retentions)
- **Campaigns** — Lead capture, forms, QR codes, distribution
- **Concierge** — Vehicle sourcing and supply
- **Credit Health** — Credit advisory workspace

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment file and add your Supabase credentials:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase URL and anon key.

3. Run the dev server:
```bash
npm run dev
```

4. Open http://localhost:3000

## Deploy to Vercel

Push to GitHub and connect the repo in Vercel. Add the environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Project Structure

```
mmela-platform/
├── app/                    # Next.js app router
│   ├── auth/               # Login, password reset
│   ├── globals.css         # Design system + Tailwind
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Entry point (auth gate)
├── components/
│   ├── layout/             # TopNav, PlatformShell, ModuleHome
│   ├── providers/          # AuthProvider
│   ├── ui/                 # Shared UI components (Phase 2+)
│   └── icons/              # Icon components (Phase 2+)
├── lib/
│   ├── auth.ts             # Supabase auth functions
│   ├── modules.ts          # Module config + role routing
│   └── supabase.ts         # Supabase client
└── types/
    └── index.ts            # All TypeScript types
```

## Role-based Access

Each role lands in their default module:
- **Sales Agent / Manager / Team Leader** → Sales module
- **Marketing Admin** → Campaigns module
- **Concierge Agent** → Concierge module
- **Credit Health Agent** → Credit Health module
- **Admin** → All modules (with switcher)
