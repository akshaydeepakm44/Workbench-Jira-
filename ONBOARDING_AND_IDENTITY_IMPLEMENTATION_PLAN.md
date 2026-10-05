# WORKDESK 2.0 — ONBOARDING & IDENTITY IMPLEMENTATION PLAN

**Document Version:** 1.0.0  
**Status:** PLANNING ONLY — IMPLEMENTATION HALTED PENDING EXPLICIT APPROVAL  
**Architectural Baseline:** Phases 1–4 Formally Closed and Frozen  
**Governing Roles:** Canonical 3-Role Model (`ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`)  

---

## 1. Role-Model Decision: Option A vs. Option B

### Architectural Context
WorkDesk 2.0 has an immutable architectural constraint: exactly three operational roles exist in the canonical domain:
```text
ROLE_EMPLOYEE
ROLE_LEAD
ROLE_MANAGER
```
Never introduce `ROLE_SUPER_ADMIN`, `SUPER_ADMIN`, `ADMIN`, `ADMINISTRATOR`, `PROJECT_MANAGER`, or any fourth role. Unrestricted governance access is exclusively held by `ROLE_MANAGER`.

The operational requirement states: in an organization with 10 employees, a company may want to designate one specific employee as the Lead for a particular product/project. The Lead dashboard view and supervisory controls should be active for that product, while keeping the user fundamentally grounded within the company's employee roster.

---

### Comparison Matrix

| Evaluation Dimension | Option A: Canonical `ROLE_LEAD` as Static Identity Role | Option B: `ROLE_EMPLOYEE` Base Identity with Dynamic Project-Scoped Lead Elevation |
| :--- | :--- | :--- |
| **Identity Role Definition** | User's primary database record is assigned `ROLE_LEAD` globally in `User.roleId`. | User's primary database record is `ROLE_EMPLOYEE`. Lead capabilities are evaluated dynamically via `ProjectMember.roleInProject = 'LEAD'` or `Project.leadId = user.id`. |
| **Multi-Project Context** | An individual designated as Lead on Project A is labeled a Lead globally across the organization, even when acting as a basic contributor on Project B. | An individual is an Employee globally, acting as Lead on Project A, and acting as a basic contributor on Project B. |
| **Existing Authorization Compatibility** | Fully compatible out-of-the-box. `PolicyGuard` checks global role permissions (`Role.permissions`), and domain services (`TasksService`, `BoardsService`) check resource ownership. | Requires careful design so `PolicyGuard` does not reject an employee before reaching domain services for project-scoped actions. |
| **Risk of Dual Authorization Systems** | Low. Single system. | High if implemented naively (e.g. creating a separate permissions engine). Low if unified with existing resource-scoped guards. |
| **Organizational Usability** | Rigid: requires Manager to manually change global roles when team leads rotate. | High: aligns with real-world product assignments where lead responsibilities are project-bound. |

---

### Architectural Recommendation: The Unified Governed Elevation Model (Option B Compatible with Frozen Architecture)

**We recommend Option B implemented via Governed Role Synchronization:**

1. **Identity Grounding:** Every non-manager onboarded into WorkDesk is assigned `ROLE_EMPLOYEE` as their canonical baseline.
2. **Project-Scoped Lead Authority:** When a Manager assigns an Employee as Lead for Project X (`Project.leadId = employee.id` and `ProjectMember.roleInProject = 'LEAD'`):
   - The user's account role in `User.roleId` is synchronized to the canonical `ROLE_LEAD`. This grants the operational permission claims (`MANAGE_BACKLOG`, `ADD_TASK_POINT`, `VIEW_TEAM_TASKS`, `TRANSITION_TASK`) recognized by `PolicyGuard`.
   - **Resource-Scope Authority:** The existing server-side domain services (`TasksService.verifyProjectAccess`, `BoardsService`, `TimelineService`) enforce that these Lead capabilities are **strictly restricted to the projects the user actually leads (`ledProjectIds`)**. On any other project where they are a contributor, they are restricted to employee permissions.
3. **Automated Demotion / Reversion:** If the Manager removes the user from their lead designation on all projects, the backend transaction automatically re-synchronizes `User.roleId` back to `ROLE_EMPLOYEE`.
4. **Zero New Roles:** This preserves the exact 3-role frozen architecture (`ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`), prevents creating a second authorization engine, uses existing `PolicyGuard` and `SessionGuard`, and delivers the exact project-scoped Lead behavior required.

---

## 2. Authorization Model: Server-Authoritative Enforcement

### Elimination of Frontend Authorization Fallacy
Client-side UI routing (e.g. `if (user.ledProjectIds.length > 0) render LeadDashboard`) is **strictly a presentation affordance** and has **zero security or authorization authority**.

Every API request must traverse the canonical 5-stage backend enforcement pipeline:

```text
Incoming HTTP Request
        │
        ▼
1. SessionGuard
   ├── Validates signed session cookie ('workdesk_session')
   ├── Checks user existence and isActive === true
   └── Enforces approvalStatus === 'APPROVED'
        │
        ▼
2. PolicyGuard
   ├── Extracts required permissions from @RequirePermissions(...)
   └── Asserts user.role.permissions contains all required permission codes
        │
        ▼
3. Resource-Scope Guard (Domain Layer)
   ├── Resolves target resource (Project, Task, Sprint, Board)
   ├── Evaluates Actor Scope:
   │    ├── ROLE_MANAGER ──► Global Organization Scope (Allowed)
   │    ├── ROLE_LEAD ─────► Allowed ONLY if resource.projectId ∈ user.ledProjectIds
   │    └── ROLE_EMPLOYEE ─► Allowed ONLY if resource.assigneeId === user.id OR creatorId === user.id
   └── Throws NotFoundException (HTTP 404) if out-of-scope (resource hiding)
        │
        ▼
4. Business Rule Engine
   ├── Done Gate Verification
   ├── Dependency Cycle Detection (DFS)
   └── WIP Limit Checks (WARNING / HARD_LIMIT)
        │
        ▼
5. Audit & Persistence Layer
   └── Records actorId, action, entityId, metadata, and ipAddress to AuditLog
```

---

## 3. Database Purge Clarification & Master E2E Evidence Preservation

### Statement of Purged Database
The database purge executed prior to this plan affected **exclusively the local development SQLite test database (`apps/api/prisma/dev.db`)**.

* **Nature of Purged Database:** Disposable local single-developer test environment used for iterative script development.
* **Production / Shared Databases:** **Zero production, staging, or remote shared databases were touched, modified, or connected.**
* **Preservation of Master E2E Evidence:**
  The evidence supporting the 100% pass rate of the Master Live Acceptance Suite remains **fully preserved, immutable, and committed** in the workspace:
  - Master Pre-Test Baseline Snapshot: [`apps/api/master_e2e_pre_test_baseline.json`](file:///d:/Datai2iJira/apps/api/master_e2e_pre_test_baseline.json)
  - Master Post-Test Reconciliation Report: [`apps/api/master_e2e_reconciliation_report.json`](file:///d:/Datai2iJira/apps/api/master_e2e_reconciliation_report.json)
  - Authoritative Acceptance Report: [`WORKDESK_2_0_MASTER_LIVE_TEST_REPORT.md`](file:///d:/Datai2iJira/WORKDESK_2_0_MASTER_LIVE_TEST_REPORT.md)
  - Master Test Suite Source: [`apps/api/test/master-e2e-production-readiness.spec.ts`](file:///d:/Datai2iJira/apps/api/test/master-e2e-production-readiness.spec.ts)
  - Browser Test Recording: `master_e2e_browser_test_1791130854579.webp`
  - Browser UI Screenshots: 6 full-viewport PNG artifacts in the artifact directory.
* **Current Database State:** The local database contains exactly one approved governance user: `akshay.m@datai2i.com` (`ROLE_MANAGER`), 0 tasks, 0 projects, 0 boards, 0 sprints.

---

## 4. Invitation Security Architecture

### Raw Token Handling & Hashing
Raw invitation tokens **MUST NEVER** be stored in the database in plaintext.

```text
Manager Triggers Invite
        │
        ▼
Generate 32-byte cryptographic random token (crypto.randomBytes(32).toString('hex'))
        │
        ├─────────────────────────────────────────────────┐
        ▼                                                 ▼
Compute SHA-256 Hash                              Transmit Raw Token
SHA256(rawToken)                                  via Email Link
        │                                         https://.../accept-invitation?token={rawToken}
        ▼                                                 │
Persist into Database                             User Clicks Link
User.invitationTokenHash = hash                           ▼
User.invitationSentAt = now                       Incoming Request: token={rawToken}
User.invitationExpiresAt = now + 72h                      ▼
                                                  Compute SHA256({rawToken})
                                                  Query User where invitationTokenHash === hash
```

### Security Invariants for Invitations
1. **Expiration Window:** 72 hours from generation. After 72 hours, the invitation token is invalid and returns HTTP 410 Gone.
2. **Token Rotation on Resend:** When a Manager clicks "Resend Invitation", the previous token hash is immediately overwritten with a newly generated token hash. The old link is instantly revoked.
3. **Revocation Capability:** Manager can revoke pending invitations at any time. Revocation sets `invitationTokenHash = null` and `invitationStatus = 'REVOKED'`.
4. **Single-Use Replay Prevention:** Upon successful acceptance, the `invitationTokenHash` is cleared (`null`) and `invitationAcceptedAt = now()`. Any replay attempt fails with HTTP 404/410.

---

## 5. OTP Security Architecture

### Cryptographic Passcode Generation & Verification
The One-Time Passcode (OTP) provides two-factor verification that the person accepting the invitation controls the recipient mailbox.

```text
User Accepts Invitation Link
        │
        ▼
Generate 6-digit numeric code (crypto.randomInt(100000, 999999).toString())
        │
        ├─────────────────────────────────────────────────┐
        ▼                                                 ▼
Compute SHA-256 Hash with Salt                    Transmit 6-digit code
SHA256(otp + user.id)                             via Email: "Your WorkDesk Code is: 123456"
        │                                                 │
Persist to DB:                                    User Inputs 6 Digits
User.otpHash = hash                                       ▼
User.otpExpiresAt = now + 10m                     Compute SHA256(inputOtp + user.id)
User.otpAttempts = 0                                      ▼
User.otpLastSentAt = now                          Compare against User.otpHash
```

### OTP Defense Parameters

| Parameter | Specification | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Passcode Format** | 6 decimal digits (`100000` to `999999`) | `crypto.randomInt` (cryptographically strong) |
| **Storage** | Salted SHA-256 hash | Raw OTP never stored in DB |
| **Validity Lifetime** | Exactly 10 minutes | Checked against `user.otpExpiresAt` |
| **Maximum Attempts** | Exactly 5 failed attempts | Incremented on each invalid submission |
| **Brute-Force Lockout** | 30 minutes lockout upon 5th failure | Account locked; requires Manager intervention or wait |
| **Resend Cooldown** | 60 seconds minimum interval | `user.otpLastSentAt + 60s > now()` -> HTTP 429 |
| **Maximum Resends** | 3 resends per invitation cycle | Prevents mailbox flooding and SMS/SMTP exhaustion |
| **Consumption State** | Consumed on first success | `otpHash = null`, `otpExpiresAt = null` |

---

## 6. Authoritative User Lifecycle State Machine

```text
                           ┌────────────────────────┐
                           │      [Non-Existent]    │
                           └───────────┬────────────┘
                                       │ Manager creates invite (POST /users/invite)
                                       ▼
                           ┌────────────────────────┐
                           │        INVITED         │◄────────────────┐
                           │  Token active (72h)    │                 │ Resend Invite
                           └─────┬───────────┬──────┘                 │ (token rotated)
                                 │           │ Manager revokes        │
       Token expires (>72h)      │           ▼                        │
       ┌─────────────────────────┤     ┌───────────┐                  │
       │                         │     │  REVOKED  │──────────────────┘
       ▼                         │     └───────────┘
 ┌───────────┐                   │
 │  EXPIRED  │                   │ User opens link (token valid)
 └─────┬─────┘                   ▼
       │                   ┌────────────────────────┐
       │                   │    PENDING_VERIFY      │
       │                   │   OTP dispatched (10m) │◄────────────────┐
       │                   └─────┬───────────┬──────┘                 │ Resend OTP
       │                         │           │ Max attempts exceeded  │ (cooldown 60s,
       │   OTP correct (<10m)    │           ▼ (5 attempts)           │ max 3)
       │                         │     ┌───────────┐                  │
       │                         │     │  LOCKED   │──────────────────┘
       │                         ▼     └───────────┘
       │                   ┌────────────────────────┐
       │                   │    APPROVED_ACTIVE     │
       │                   │ Session issued -> Home │
       │                   └─────┬───────────▲──────┘
       │                         │           │
       │        Manager deactivates          │ Manager reactivates
       │                         ▼           │
       │                   ┌─────────────────┴──────┐
       │                   │       DEACTIVATED      │
       │                   │  Sessions invalidated  │
       │                   └────────────────────────┘
       │
       └──────────────────► Re-invited by Manager
```

### Valid Transition Matrix

| Current State | Event Trigger | Next State | Authorization | Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `[None]` | `INVITE_CREATED` | `INVITED` | `ROLE_MANAGER` | Hash generated, EmailLog created, AuditLog logged |
| `INVITED` | `INVITE_LINK_OPENED` | `PENDING_VERIFY` | Public (Token) | Token verified, OTP generated & dispatched |
| `INVITED` | `INVITE_RESENT` | `INVITED` | `ROLE_MANAGER` | Token rotated, expiry reset to +72h, EmailLog logged |
| `INVITED` | `INVITE_EXPIRED` | `EXPIRED` | System / Time | Token invalidated |
| `INVITED` | `INVITE_REVOKED` | `REVOKED` | `ROLE_MANAGER` | Token cleared, status marked REVOKED |
| `PENDING_VERIFY` | `OTP_SUBMITTED_VALID`| `APPROVED_ACTIVE`| Public (OTP) | User activated, session created, token cleared |
| `PENDING_VERIFY` | `OTP_ATTEMPT_FAILED` | `PENDING_VERIFY` | Public (OTP) | `otpAttempts += 1`, Audit warning |
| `PENDING_VERIFY` | `MAX_ATTEMPTS_HIT` | `LOCKED` | System | Locked for 30m or until Manager reset |
| `APPROVED_ACTIVE` | `USER_DEACTIVATED` | `DEACTIVATED` | `ROLE_MANAGER` | `isActive = false`, all sessions deleted |
| `DEACTIVATED` | `USER_REACTIVATED` | `APPROVED_ACTIVE`| `ROLE_MANAGER` | `isActive = true`, Audit logged |

---

## 7. Email Delivery Architecture (Handling SMTP Limitations)

The Master E2E validation proved that the local development environment lacks active external SMTP credentials (`BLOCKED — ENVIRONMENT`).

The onboarding email pipeline is architected to safely handle this boundary without failing or bypassing security:

```text
Event: Invite or OTP Triggered
        │
        ▼
1. Create Database EmailLog Record
   ├── recipient = user.email
   ├── templateName = 'INVITATION_EMAIL' | 'OTP_VERIFICATION'
   ├── status = 'PENDING'
   ├── metadata = { userId, tokenExpiresAt, ... }
   └── correlationId = UUID
        │
        ▼
2. Evaluate SMTP Configuration
   ├── Check if SMTP_HOST and SMTP_USER are defined in ConfigService
   │
   ├── [Case A: SMTP Configured] ──────────────────────────┐
   │    │                                                  │
   │    ▼                                                  ▼
   │   Send email via Nodemailer Transport               [Case B: SMTP Unconfigured / Error]
   │    │                                                  │
   │    ├── Success: Update EmailLog status = 'SENT'       ▼
   │    └── Failure: Update EmailLog status = 'FAILED'   Log to EmailLog status = 'PENDING_ENVIRONMENT'
   │                 Record errorMessage in DB            Record warning in AuditLog
   │                 DO NOT activate user                 DO NOT crash process
   │                 DO NOT bypass OTP                    DO NOT bypass OTP verification
   │                                                      Allow dev inspection via /api/v1/auth/email-logs
```

### Safety Guarantees
* **No Premature Activation:** An email dispatch failure **NEVER** causes a user to become active.
* **No Verification Bypass:** Absence of an SMTP server does not auto-validate invitations or OTPs.
* **Inspectable Dev Log:** In local development, the generated OTP and invitation links are queryable by the Manager via `EmailLog` or `AuditLog`, allowing full live testing even without an external mailbox.

---

## 8. Project Lead Designation Model

### Data Relationship & Storage

```prisma
// Existing Models - 100% Reused
model Project {
  id        String          @id @default(uuid())
  name      String
  key       String          @unique
  leadId    String?         // Canonical primary Lead
  lead      User?           @relation("ProjectLead", fields: [leadId], references: [id])
  members   ProjectMember[]
  // ...
}

model ProjectMember {
  id            String   @id @default(uuid())
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleInProject String   @default("CONTRIBUTOR") // "LEAD" | "CONTRIBUTOR"
  joinedAt      DateTime @default(now())

  @@unique([projectId, userId])
}
```

### Project Lead Business Rules
1. **Canonical Lead:** `Project.leadId` stores the primary designated Lead for the project.
2. **Project Member Role:** `ProjectMember.roleInProject` is set to `'LEAD'` for the lead user and `'CONTRIBUTOR'` for others.
3. **Multiple Projects:** An Employee can be designated as Lead on Project A and a Contributor on Project B. Their `user.ledProjectIds` returns `[ProjectA.id]`.
4. **Lead Removal & Demotion:**
   - When a Manager reassigns the Lead or removes the designation:
     - `Project.leadId` is set to the new Lead (or `null`).
     - `ProjectMember.roleInProject` reverts to `'CONTRIBUTOR'`.
     - The user's active task assignments on that project remain **100% intact**.
     - If the user has zero remaining led projects across the entire system, their role synchronizes back to `ROLE_EMPLOYEE`.
   - Audit event `PROJECT_LEAD_REASSIGNED` is recorded.
   - In-app notification sent to the affected employee.

---

## 9. Manager Onboarding Workflow & UI Flow

### Step-by-Step Manager Journey
1. **Navigation:** Manager opens **Manager Governance Dashboard** (`/governance`) -> Clicks **"Onboard Users"** tab.
2. **Input Form:**
   - **Full Name:** Text input (mandatory, min 2 chars).
   - **Email Address:** Email input (mandatory, unique validation).
   - **Employee ID:** Custom string or auto-generated button (`EMP-XXXX`).
   - **Assign Product/Project:** Dropdown populated with active projects.
   - **Designate as Product Lead:** Checkbox (only visible if project selected).
3. **Submission:**
   - Manager clicks **"Send Official Invitation"**.
   - UI shows loading spinner.
   - Backend creates user in `INVITED` state, generates token hash, records `ProjectMember`, and creates `EmailLog`.
   - Toast notification: *"Invitation sent to employee@company.com"*.
4. **Pending Invitations Roster:**
   - Table displaying: Name, Email, Employee ID, Assigned Project, Lead Status, Invitation Status (`INVITED`, `EXPIRED`, `PENDING_VERIFY`), Sent Date, Actions (Resend, Revoke).

---

## 10. Employee Acceptance & OTP Verification UI Flow

### Step-by-Step Employee Journey
1. **Entry:** Employee receives email and clicks link: `https://workdesk.company.com/accept-invitation?token={rawToken}`.
2. **Acceptance Screen (`/accept-invitation`):**
   - Brand banner: *"Welcome to WorkDesk 2.0"*.
   - Verification card: *"Hello {fullName}, Akshay Maradapudi has invited you to join WorkDesk as an Employee on {projectName}."*
   - Button: **"Confirm & Receive Verification Code"**.
3. **OTP Screen:**
   - System triggers OTP generation and email dispatch.
   - Screen displays: *"Enter the 6-digit verification code sent to {email}"*.
   - 6 individual auto-advancing numeric digit boxes.
   - 60-second countdown timer: *"Resend code in 0:45"*.
   - Attempt counter: *"3 attempts remaining"*.
4. **Completion:**
   - Employee enters correct OTP.
   - Backend validates, marks user `APPROVED_ACTIVE`, clears token/OTP, and sets authentication session cookie.
   - Dynamic redirect:
     - If designated as Project Lead -> Lands on `/lead-dashboard` or `/projects/{id}/backlog`.
     - If standard Employee -> Lands on `/dashboard` (My Tasks & Standups).

---

## 11. API Endpoint Design

### 1. Manager Onboarding Endpoints

```typescript
// POST /api/v1/users/invite
// Auth: SessionGuard + PolicyGuard(@RequirePermissions(Permission.MANAGE_USERS))
Request:
{
  fullName: string;
  email: string;
  employeeId?: string;
  projectId?: string;
  isProjectLead?: boolean;
}
Response (201 Created):
{
  success: true;
  user: {
    id: string;
    email: string;
    fullName: string;
    employeeId: string;
    status: 'INVITED';
    invitationSentAt: string;
    invitationExpiresAt: string;
  };
  emailStatus: 'SENT' | 'PENDING_ENVIRONMENT';
}
```

```typescript
// POST /api/v1/users/invitations/:userId/resend
// Auth: SessionGuard + PolicyGuard(@RequirePermissions(Permission.MANAGE_USERS))
Response (200 OK):
{
  success: true;
  message: 'Invitation resent successfully with rotated token.';
  invitationExpiresAt: string;
}
```

```typescript
// DELETE /api/v1/users/invitations/:userId
// Auth: SessionGuard + PolicyGuard(@RequirePermissions(Permission.MANAGE_USERS))
Response (200 OK):
{
  success: true;
  message: 'Invitation revoked successfully.';
}
```

### 2. Public Invitation & OTP Endpoints

```typescript
// GET /api/v1/auth/invitation/validate?token={rawToken}
// Auth: Public
Response (200 OK):
{
  valid: true;
  user: {
    fullName: string;
    email: string;
    projectName?: string;
    roleName: string;
  };
}
// Error (410 Gone / 404 Not Found):
// { statusCode: 410, message: "Invitation token has expired or is invalid." }
```

```typescript
// POST /api/v1/auth/invitation/request-otp
// Auth: Public
Request:
{
  token: string; // raw token
}
Response (200 OK):
{
  success: true;
  message: 'Verification code sent to registered email.';
  expiresInSeconds: 600;
  cooldownSeconds: 60;
}
```

```typescript
// POST /api/v1/auth/invitation/verify-otp
// Auth: Public
Request:
{
  token: string;
  otp: string; // 6 digits
}
Response (200 OK):
// Sets Set-Cookie: workdesk_session={sessionId}; HttpOnly; Path=/; SameSite=Lax
{
  success: true;
  user: {
    id: string;
    email: string;
    fullName: string;
    roleCode: RoleCode;
    ledProjectIds: string[];
  };
  redirectTo: '/dashboard' | '/lead-dashboard';
}
```

---

## 12. Audit Logging Specifications

Every single lifecycle event must generate an immutable `AuditLog` entry:

| Event Code | Entity Name | Actor | Metadata Captured |
| :--- | :--- | :--- | :--- |
| `USER_INVITATION_CREATED` | `User` | Manager ID | `targetEmail`, `targetEmployeeId`, `projectId`, `isLead`, `invitationExpiresAt` |
| `USER_INVITATION_RESENT` | `User` | Manager ID | `targetEmail`, `previousTokenRevoked: true`, `newExpiresAt` |
| `USER_INVITATION_REVOKED`| `User` | Manager ID | `targetEmail`, `revokedAt` |
| `INVITATION_OTP_DISPATCHED`| `User` | Target User (Unauth)| `targetEmail`, `otpExpiresAt`, `attemptCount: 0` |
| `INVITATION_OTP_FAILED` | `User` | Target User (Unauth)| `targetEmail`, `failedAttempts`, `ipAddress` |
| `INVITATION_OTP_LOCKED` | `User` | Target User (Unauth)| `targetEmail`, `lockoutUntil`, `ipAddress` |
| `USER_INVITATION_ACCEPTED`| `User` | Target User (Unauth)| `targetEmail`, `acceptedAt`, `ipAddress`, `assignedRole` |
| `PROJECT_LEAD_ASSIGNED` | `Project` | Manager ID | `projectId`, `leadUserId`, `projectKey` |
| `PROJECT_LEAD_REASSIGNED`| `Project` | Manager ID | `projectId`, `previousLeadId`, `newLeadId` |

---

## 13. Rate Limiting & Abuse Prevention

To prevent brute force, enumeration, and denial of service:

1. **IP Rate Limiting on OTP Endpoints:**
   - Max 10 requests per minute per IP address on `/auth/invitation/*`.
   - Enforced via NestJS Throttler guard or memory cache.
2. **Account-Level Lockout:**
   - 5 incorrect OTP attempts -> locks the invitation record for 30 minutes.
   - Subsequent verification attempts immediately return HTTP 423 Locked.
3. **Resend Cooldown:**
   - Minimum 60 seconds between OTP resend requests.
   - Max 3 resend attempts per invitation cycle.
4. **Token Invalidation on Acceptance:**
   - Atomic database update: `invitationTokenHash = null` and `otpHash = null` in the same transaction as session creation, preventing race conditions or replay attacks.

---

## 14. Database Model Classification

| Model / Field | Action | Justification |
| :--- | :--- | :--- |
| **`User` model** | **EXTEND** | Add `invitationTokenHash String? @unique`, `invitationSentAt DateTime?`, `invitationExpiresAt DateTime?`, `invitationStatus String @default("APPROVED")`, `otpHash String?`, `otpExpiresAt DateTime?`, `otpAttempts Int @default(0)`, `otpLockedUntil DateTime?`, `otpLastSentAt DateTime?`. |
| **`Role` model** | **REUSE** | Zero changes. Exactly `ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`. |
| **`Project` model** | **REUSE** | Zero changes. Existing `leadId` field is canonical. |
| **`ProjectMember` model**| **REUSE** | Zero changes. Existing `roleInProject` (`'LEAD'` / `'CONTRIBUTOR'`) is canonical. |
| **`Session` model** | **REUSE** | Zero changes. Issued on OTP verification. |
| **`EmailLog` model** | **REUSE** | Zero changes. Records invitation and OTP dispatch attempts. |
| **`AuditLog` model** | **REUSE** | Zero changes. Records all security and governance events. |
| **`Invitation` separate table** | **NOT REQUIRED** | Storing lifecycle state directly on `User` simplifies foreign key integrity, prevents orphaned invitations, and reuses existing user identity references. |

---

## 15. Migration Strategy

When implementation is explicitly approved:

1. **Prisma Schema Update:**
   Add the optional invitation and OTP fields to `model User` in `apps/api/prisma/schema.prisma`. All fields are nullable (`String?`, `DateTime?`) with safe defaults (`otpAttempts Int @default(0)`), ensuring 100% backwards compatibility with existing user records.
2. **Migration Generation:**
   Execute `npx prisma migrate dev --name add_user_invitation_and_otp` in `apps/api`.
3. **Seed Stability:**
   The primary Manager (`akshay.m@datai2i.com`) has `invitationStatus = 'APPROVED'`, `isActive = true`, `invitationTokenHash = null`. Existing login continues without interruption.

---

## 16. Rollback Strategy

If a critical regression is discovered during testing:

1. **Database Rollback:**
   Execute `prisma migrate resolve --rolled-back` or drop the added columns. Since all added columns are nullable, existing queries continue executing without syntax errors.
2. **Code Rollback:**
   Revert git commits containing the invitation routes.
3. **Session Invalidation:**
   `DELETE FROM Session WHERE userId IN (SELECT id FROM User WHERE invitationStatus = 'INVITED')`.

---

## 17. Comprehensive Test Matrix

| Test ID | Scenario Description | Input Data | Expected Status | Expected Persisted State |
| :--- | :--- | :--- | :--- | :--- |
| **TC-ONB-01** | Manager invites standard Employee | Valid name, email, EMP-1002 | 201 Created | User created, status `INVITED`, hash stored, EmailLog `PENDING`/`SENT` |
| **TC-ONB-02** | Manager invites Employee with Product Lead designation | Valid inputs + `projectId`, `isLead = true` | 201 Created | User status `INVITED`, `Project.leadId = user.id`, `ProjectMember.roleInProject = 'LEAD'` |
| **TC-ONB-03** | Non-Manager attempts invite | Employee E1 token | 403 Forbidden | Zero DB modification |
| **TC-ONB-04** | Invite with duplicate email | Existing email address | 409 Conflict | Rejects duplicate registration |
| **TC-ONB-05** | Open valid invitation link | Valid raw token | 200 OK | Returns user name and project info |
| **TC-ONB-06** | Open expired invitation link | Expired raw token (>72h) | 410 Gone | Returns explicit expiration message |
| **TC-ONB-07** | Open revoked invitation link | Revoked token | 410 Gone | Returns revocation notice |
| **TC-ONB-08** | Request OTP on valid token | Valid raw token | 200 OK | Salted OTP hash stored in DB, EmailLog created |
| **TC-ONB-09** | OTP resend within 60s cooldown | Resend after 20s | 429 Too Many Req | Rejects rapid resend |
| **TC-ONB-10** | Verify valid OTP | Correct 6 digits within 10m | 200 OK | User status `APPROVED_ACTIVE`, token cleared, session cookie issued |
| **TC-ONB-11** | Verify invalid OTP | Incorrect 6 digits | 400 Bad Request | `otpAttempts = 1`, session NOT issued |
| **TC-ONB-12** | Brute force OTP lockout | 5 consecutive invalid OTPs | 423 Locked | Account locked for 30m, AuditLog records warning |
| **TC-ONB-13** | Replay accepted token | Accepted raw token | 410 Gone | Replay strictly blocked |

---

## 18. Security Test Matrix

| Threat Vector | Mitigation Mechanism | Verification Test |
| :--- | :--- | :--- |
| **Database Token Exposure** | Raw tokens never stored; only SHA-256 hashes persisted. | Inspect DB after invite; verify raw token cannot be retrieved from SQL. |
| **OTP Timing Attacks** | Constant-time string comparison (`crypto.timingSafeEqual`). | Sub-millisecond timing analysis on verification endpoint. |
| **Token Guessing / Enumeration** | 256 bits of cryptographic entropy (`crypto.randomBytes(32)`). | Computational infeasibility ($2^{256}$ space). |
| **Privilege Escalation during Onboarding** | Requested role is strictly ignored; backend forces `ROLE_EMPLOYEE` (or Governed Elevation if project lead). | Send payload `{ roleCode: 'ROLE_MANAGER' }` -> Assert user is created as `ROLE_EMPLOYEE`. |
| **Cross-Tenant Data Exposure in Invite** | Public validate endpoint returns only recipient's name and assigned project name. | Inspect public GET response; verify 0 organization-wide data returned. |

---

## 19. Browser End-to-End Scenarios

### Scenario 1: Manager Invites Lead & Employee
1. Log in as Manager (`akshay.m@datai2i.com`).
2. Navigate to `/governance` -> Onboard Users tab.
3. Fill form: *"Sarah Connor"*, `sarah@datai2i.com`, `EMP-0101`, Project: *"Project Titan"*, Check: *"Designate as Lead"*.
4. Click Send Invite. Verify table shows Sarah Connor in `INVITED` state with Lead badge.
5. Fill form: *"John Connor"*, `john@datai2i.com`, `EMP-0102`, Project: *"Project Titan"*, Unchecked.
6. Click Send Invite. Verify table shows John Connor in `INVITED` state with Member badge.

### Scenario 2: Employee Acceptance & OTP Verification
1. Open incognito browser window.
2. Navigate to invitation URL copied from invite record.
3. Verify welcome card displays *"Sarah Connor"* and *"Project Titan"*.
4. Click **"Confirm & Receive Verification Code"**.
5. Retrieve OTP from `EmailLog` or mailer.
6. Enter OTP in the 6-digit input boxes.
7. Verify automatic redirect to `/lead-dashboard` or project backlog with supervisory controls active.

---

## 20. SMTP / Live-Email Test Requirements

Before claiming live mailbox delivery:
1. Provision live SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) in `.env`.
2. Configure DKIM, SPF, and DMARC for outbound domain (`datai2i.com`).
3. Execute real email dispatch to test inboxes on Gmail, Outlook, and corporate mail.
4. Verify email arrives in inbox (not spam), links are clickable, and responsive HTML renders cleanly on mobile and desktop.
5. If SMTP credentials remain unprovisioned, the system **MUST continue operating in `BLOCKED — ENVIRONMENT` safe fallback mode** with full logging to `EmailLog`.

---

## 21. Compatibility with Frozen Phase 1–4 Architecture

This implementation plan guarantees 100% preservation of all previously approved invariants:

1. **3 Canonical Roles:** Exactly `ROLE_EMPLOYEE`, `ROLE_LEAD`, and `ROLE_MANAGER`. Zero new roles.
2. **Canonical Work Item Entity:** `Task` remains the single work-item entity.
3. **Canonical Transition Engine:** Unaltered. All state transitions pass through `TasksService.transitionTask`.
4. **Done Gate Authoritative:** All criteria, guidance, evidence, review, and blocker checks remain intact.
5. **Resource Scoping & 404 Hiding:** Project-scoped leads can only access resources within their led projects; out-of-scope resources return HTTP 404.
6. **LexoRank & Sprints:** Unaltered. Sprints continue tracking historical `SprintCommitment`.
7. **Control Tower & Health Engines:** Continue aggregating project signals using established deterministic formulas.

---

## 22. Summary Recommendation

* **Adopt Option B via Governed Synchronization:** All team members are fundamentally **Employees**. When assigned as Lead for a Product/Project, their capability permissions are activated and strictly scoped to that product/project.
* **Onboarding Security:** Secure SHA-256 token hashing, 72h expiration, salted 6-digit OTP with 10-minute validity, 5-attempt brute-force lockout, and full audit logging.
* **Safe SMTP Fallback:** Unconfigured SMTP logs to `EmailLog` without crashing, maintaining strict security without premature activation.

---

ONBOARDING ARCHITECTURE PLAN COMPLETE — IMPLEMENTATION HALTED PENDING EXPLICIT APPROVAL.
