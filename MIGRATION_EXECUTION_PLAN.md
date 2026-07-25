# Migration Execution Plan - Backend & Frontend

## Overview
While you create the PostgreSQL database, I'll prepare the Express backend and migration code.

---

## PHASE 1: DATABASE SETUP (YOUR PART)
**Timeline:** Today  
**Task:** Create PostgreSQL database using `POSTGRESQL_SCHEMA.sql`  
**Deliverable:** Working database with all tables, enums, triggers

**Once complete:** Send confirmation ✓

---

## PHASE 2: EXPRESS BACKEND SETUP (MY PART)
**Timeline:** While DB setup in progress / immediately after

### 2.1 Backend Project Structure
```
backend/
├── src/
│   ├── server.ts                 # Main Express app
│   ├── config/
│   │   ├── database.ts           # PostgreSQL connection pool
│   │   ├── environment.ts        # Config loader
│   │   └── logger.ts             # Winston logger
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification
│   │   ├── errorHandler.ts       # Global error handling
│   │   └── validation.ts         # Input validation
│   ├── routes/
│   │   ├── auth.ts               # Auth endpoints
│   │   ├── users.ts              # User CRUD
│   │   ├── kpi.ts                # KPI endpoints
│   │   ├── tasks.ts              # Task endpoints
│   │   ├── meetings.ts           # Meeting endpoints
│   │   ├── projects.ts           # Project endpoints
│   │   ├── pd.ts                 # PD jobs endpoints
│   │   ├── pm.ts                 # PM endpoints
│   │   ├── departments.ts        # Department endpoints
│   │   └── audit.ts              # Audit log endpoints
│   ├── services/
│   │   ├── authService.ts        # Auth logic
│   │   ├── kpiService.ts         # KPI logic
│   │   ├── taskService.ts        # Task logic
│   │   └── ...                   # Other services
│   ├── types/
│   │   └── index.ts              # TypeScript types
│   └── utils/
│       └── helpers.ts            # Utilities
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

### 2.2 API Endpoints to Create (40+)

**Authentication:**
- `POST /api/auth/login`
- `POST /api/auth/register` (admin-only)
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`

**Users:**
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

**KPI:**
- `GET /api/kpi`
- `GET /api/kpi/:id`
- `POST /api/kpi`
- `PUT /api/kpi/:id`
- `DELETE /api/kpi/:id`

**Tasks:**
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `PUT /api/tasks/:id/status` (RPC: update_task_status)
- `PUT /api/tasks/:id/due-date` (RPC: update_task_due_date)
- `PUT /api/tasks/:id/fields` (RPC: update_task_fields)

**Meetings:**
- `GET /api/meetings`
- `POST /api/meetings`
- `PUT /api/meetings/:id`
- `GET /api/meetings/:id/decisions`
- `POST /api/meetings/:id/decisions`

**Other Endpoints:**
- `/api/departments` (CRUD)
- `/api/projects` (CRUD)
- `/api/pd-jobs` (CRUD + stage update)
- `/api/pm-machines` (CRUD)
- `/api/audit-logs` (READ-only)
- `/api/kpi-charts` (CRUD)
- `/api/task-groups` (CRUD)

### 2.3 Key Services to Implement

**AuthService:**
```typescript
- login(email, password) → { token, user, roles }
- register(userData) → { success, user }
- verifyToken(token) → { valid, userId }
- hashPassword(password) → hash
- comparePassword(password, hash) → boolean
```

**TaskService:**
```typescript
- getAllTasks(filters, pagination)
- getTaskById(id)
- createTask(data)
- updateTask(id, data)
- deleteTask(id)
- updateTaskStatus(id, newStatus, reason)
- updateTaskDueDate(id, newDate, reason)
- updateTaskFields(id, fields)
```

**KPIService:**
```typescript
- getAllKPIs(departmentId)
- getKPIById(id)
- createKPI(data)
- updateKPI(id, data)
- deleteKPI(id)
- getKPIEntries(kpiId, dateRange)
- submitKPIEntry(data)
```

---

## PHASE 3: DATABASE POLLING IMPLEMENTATION
**Timeline:** After backend setup

### 3.1 Polling Strategy
- Poll interval: **2 seconds** for real-time feel
- Fallback on: **manual refresh** for critical updates
- Cache: Use React Query for smart caching

### 3.2 Data Fetching Pattern
```typescript
// In React components
useQuery({
  queryKey: ['tasks'],
  queryFn: () => apiClient.getTasks(),
  refetchInterval: 2000,  // Poll every 2 seconds
  staleTime: 1000,       // Stale after 1 second
})
```

---

## PHASE 4: FRONTEND REFACTORING (YOUR PART - CAN HELP)
**Timeline:** After backend ready

### 4.1 Create API Client
**File:** `src/integrations/api/client.ts`
```typescript
class APIClient {
  baseURL = process.env.VITE_API_BASE_URL

  async login(email, password)
  async getTasks(filters?)
  async createTask(data)
  async updateTask(id, data)
  // ... 40+ methods
}
```

### 4.2 Replace All Supabase Calls

**Before (Supabase):**
```typescript
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('department_id', deptId)
```

**After (Express API):**
```typescript
const data = await apiClient.getTasks({ departmentId: deptId })
```

### 4.3 Update useAuth Hook
- Replace Supabase auth with JWT-based auth
- Store token in localStorage
- Auto-refresh on expiry

### 4.4 Update React Query Queries
- Use new API endpoints
- Implement polling for real-time (2-second interval)
- Keep same error handling

---

## PHASE 5: TESTING & DEPLOYMENT

### 5.1 Testing
- Unit tests for services
- Integration tests for API endpoints
- E2E tests with existing Playwright setup

### 5.2 Deployment Structure
```bash
# Development
Frontend: http://localhost:5173 (Vite)
Backend: http://localhost:3001

# Production
Frontend: Your domain
Backend: Your domain/api (or separate backend server)
```

---

## SPLIT RESPONSIBILITY SUMMARY

### YOU HANDLE:
1. ✓ Create PostgreSQL database (Phase 1)
2. ✓ Provide database credentials
3. ⬜ (Optional) Update frontend components to use new API

### I HANDLE:
1. ✓ Create Express backend structure (Phase 2)
2. ✓ Create all 40+ API endpoints (Phase 2)
3. ✓ Implement JWT authentication (Phase 2)
4. ✓ Database polling logic (Phase 3)
5. ✓ Create API client library (Phase 4)
6. ✓ Help migrate frontend (Phase 4)
7. ✓ Testing & documentation (Phase 5)

---

## TIMELINE

| Phase | Owner | Days | Status |
|-------|-------|------|--------|
| 1. DB Setup | You | 1 | ⏳ Waiting |
| 2. Express Backend | Me | 2 | ⏳ Ready to start |
| 3. Polling Setup | Me | 1 | ⏳ After phase 2 |
| 4. Frontend Migration | Both | 2-3 | ⏳ After phase 3 |
| 5. Testing | Both | 1-2 | ⏳ After phase 4 |
| **Total** | - | **5-7 days** | - |

---

## NEXT STEPS

1. **You:** Create the PostgreSQL database using `POSTGRESQL_SCHEMA.sql`
2. **You:** Verify all tables are created ✓
3. **You:** Share database credentials (or confirm localhost setup)
4. **Me:** Create Express backend + API endpoints
5. **Me:** Test API endpoints
6. **Both:** Migrate frontend together

---

**Ready? Start with DATABASE_SETUP_INSTRUCTIONS.md and let me know when done! 🚀**
