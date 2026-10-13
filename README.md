# CRM Backend (Node.js · Express · PostgreSQL · JWT)

## Setup
```bash
npm install
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET
createdb crm && npm run db:init
npm run dev
```

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register employee `{name,email,password}` → returns JWT |
| POST | `/api/auth/login` | No | Login `{email,password}` → returns JWT |
| POST | `/api/enquiries/public` | **No** | Public enquiry form `{name,email,phone?,course_interest,message?}` |
| GET | `/api/enquiries/unclaimed?page=&limit=` | Bearer | All public (unclaimed) enquiries |
| POST | `/api/enquiries/:id/claim` | Bearer | Claim an enquiry (becomes private) |
| GET | `/api/enquiries/mine?page=&limit=` | Bearer | Enquiries claimed by the logged-in user |

Send the token as `Authorization: Bearer <token>`.

## Design notes
- **Public vs private** is a single column: `enquiries.claimed_by` is `NULL` (public) or an employee id (private).
- **Claim is race-safe**: one `UPDATE ... WHERE id=$2 AND claimed_by IS NULL`. If two counselors click at once, exactly one succeeds; the other gets `409`.
- Passwords are hashed with bcrypt; emails are normalised to lowercase; JWT carries `sub` (employee id) and `email`.
- Counselor-shared form: share the same public form; it posts to `/api/enquiries/public`.

## Quick test
```bash
curl -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Asha","email":"asha@corp.com","password":"password123"}'
curl -X POST localhost:3000/api/enquiries/public -H 'Content-Type: application/json' \
  -d '{"name":"Ravi","email":"ravi@mail.com","course_interest":"Data Science"}'
curl localhost:3000/api/enquiries/unclaimed -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:3000/api/enquiries/1/claim -H "Authorization: Bearer $TOKEN"
curl localhost:3000/api/enquiries/mine -H "Authorization: Bearer $TOKEN"
```
