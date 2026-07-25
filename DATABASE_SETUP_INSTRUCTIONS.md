# PostgreSQL Database Setup - Step by Step Guide

## Prerequisites
- PostgreSQL installed (v12+)
- pgAdmin (GUI) or psql (CLI) - either works
- The `POSTGRESQL_SCHEMA.sql` file from this repo

---

## STEP-BY-STEP INSTRUCTIONS

### **Option A: Using pgAdmin (GUI) - RECOMMENDED FOR BEGINNERS**

#### 1. Open pgAdmin
- Launch pgAdmin from Start Menu (or from the PostgreSQL installation)
- Default URL: `http://localhost:5050`
- Login with your PostgreSQL credentials

#### 2. Create Database
- Right-click **Databases** → **Create** → **Database**
- Name: `fulcrum_focus_db`
- Owner: `postgres` (or your user)
- Click **Save**

#### 3. Execute SQL Script
- Expand **Databases** → **fulcrum_focus_db**
- Click **Query Tool** (or Tools → Query Tool)
- Copy the entire content from `POSTGRESQL_SCHEMA.sql`
- Paste into the query editor
- Click **Execute** (or F5)
- **WAIT** for completion message ✓

#### 4. Verify Tables
- Expand **fulcrum_focus_db** → **Schemas** → **public** → **Tables**
- Should see 25+ tables listed

---

### **Option B: Using psql (CLI) - FASTER**

#### 1. Open Command Prompt/PowerShell

#### 2. Connect to PostgreSQL
```bash
psql -U postgres -h localhost
```
- Enter password when prompted

#### 3. Create Database
```sql
CREATE DATABASE fulcrum_focus_db;
```

#### 4. Connect to Database
```bash
\c fulcrum_focus_db
```

#### 5. Execute Schema Script
```bash
\i 'C:\path\to\POSTGRESQL_SCHEMA.sql'
```

#### 6. Verify
```sql
\dt
```
- Should list all tables

---

### **Option C: Using Command Line (One-Shot)**

```bash
psql -U postgres -h localhost -d fulcrum_focus_db -f "C:\path\to\POSTGRESQL_SCHEMA.sql"
```

---

## AFTER DATABASE SETUP

### 5. Update .env File for Backend

Create `backend/.env`:
```bash
DATABASE_URL=postgres://postgres:password@localhost:5432/fulcrum_focus_db
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRY=7d
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
```

**Replace:**
- `postgres` → your database username
- `password` → your database password
- `localhost` → server address (keep localhost for local setup)
- `5432` → PostgreSQL port (default is 5432)

---

## VERIFICATION CHECKLIST

After setup, verify everything:

### ✓ Check Enums
```sql
SELECT typname FROM pg_type WHERE typkind = 'e' ORDER BY typname;
```
Should show 14 enums.

### ✓ Check Tables
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public';
```
Should show 25+ tables.

### ✓ Check Functions
```sql
SELECT routine_name FROM information_schema.routines WHERE routine_schema='public';
```
Should show 8+ functions.

### ✓ Check Indexes
```sql
SELECT indexname FROM pg_indexes WHERE schemaname='public';
```
Should show 15+ indexes.

### ✓ Check Triggers
```sql
SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema='public';
```
Should show 9 triggers.

---

## Common Issues & Solutions

### **Issue: "database already exists"**
```sql
DROP DATABASE IF EXISTS fulcrum_focus_db;
-- Then re-run the script
```

### **Issue: Permission denied**
```bash
# Make sure you're using a user with CREATE DATABASE privilege
psql -U postgres  # not your local Windows user
```

### **Issue: Connection refused**
- Check PostgreSQL is running: `Services` → Look for `postgresql-x64-XX`
- Default port: 5432
- Check firewall isn't blocking it

### **Issue: "password authentication failed"**
- Use the password you set during PostgreSQL installation
- Or reset: `ALTER USER postgres WITH PASSWORD 'newpassword';`

---

## Next Steps (After DB is Ready)

1. **Notify me** when database is created ✓
2. I'll create **Express.js backend** structure
3. I'll create **API endpoints** for all operations
4. I'll create **authentication system** (JWT)
5. We'll **migrate frontend** from Supabase to Express API

---

## Database Connection Details for Reference

```
Host: localhost
Port: 5432
Database: fulcrum_focus_db
Username: postgres
Password: [your password]
```

Use these in your backend `.env` file as:
```
DATABASE_URL=postgres://username:password@host:port/database
```

---

## Quick Test Query (To verify connection works)

```sql
SELECT * FROM factory;
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='public';
```

---

**Let me know once you've created the database and I'll proceed with Phase 2: Express Backend Setup!** ✓
