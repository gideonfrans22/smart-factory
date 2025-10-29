# Authentication Temporarily Disabled

## ⚠️ Current Status: AUTHENTICATION DISABLED

**Date Disabled:** October 29, 2025  
**Reason:** Project requirements changed - routes may not need authentication

---

## 🔓 What Was Changed

### File Modified: `src/middleware/auth.ts`

#### Changes Made:
1. ✅ **`authenticateToken` middleware** - Now bypasses all authentication checks
2. ✅ **`requireRole` middleware** - Now bypasses all role-based authorization checks
3. ✅ **All route protection** - Effectively disabled across the entire application

#### Warning Messages:
The middleware now logs warnings to console:
- `⚠️  WARNING: Authentication is temporarily disabled`
- `⚠️  WARNING: Role check for [admin, worker] is temporarily disabled`

---

## 🔒 How to Re-Enable Authentication

### Step 1: Open the auth middleware file
```bash
src/middleware/auth.ts
```

### Step 2: Restore `authenticateToken` function

**Find this section (around line 15-23):**
```typescript
export const authenticateToken = async (
  _req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // TEMPORARY BYPASS: Skip all authentication checks
  console.log("⚠️  WARNING: Authentication is temporarily disabled");
  next();
  return;
```

**Delete lines 20-22** (the bypass logic) and **uncomment the original implementation** below it (lines 25-79).

**Change the function signature back:**
```typescript
// Change from:
export const authenticateToken = async (
  _req: AuthenticatedRequest,  // Remove underscore
  _res: Response,               // Remove underscore
  next: NextFunction
): Promise<void> => {

// Change to:
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
```

### Step 3: Restore `requireRole` function

**Find this section (around line 84-92):**
```typescript
export const requireRole = (roles: string[]) => {
  return (
    _req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    // TEMPORARY BYPASS: Skip all role checks
    console.log(`⚠️  WARNING: Role check...`);
    next();
    return;
```

**Delete lines 93-95** (the bypass logic) and **uncomment the original implementation** below it (lines 97-120).

**Change the function signature back:**
```typescript
// Change from:
return (
  _req: AuthenticatedRequest,  // Remove underscore
  _res: Response,               // Remove underscore
  next: NextFunction
): void => {

// Change to:
return (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
```

### Step 4: Restore imports

**At the top of the file (lines 2-6), uncomment:**
```typescript
// Change from:
// Commented out unused imports during temporary auth bypass
// import * as jwt from "jsonwebtoken";
// import { User } from "../models/User";
import { AuthenticatedRequest } from "../types";
// import { JWTPayload, APIResponse } from "../types";

// Change to:
import * as jwt from "jsonwebtoken";
import { User } from "../models/User";
import { AuthenticatedRequest, JWTPayload, APIResponse } from "../types";
```

### Step 5: Verify changes
```bash
npm run build
npm run dev
```

---

## 📋 Quick Re-Enable Checklist

- [ ] Uncomment imports: `jwt`, `User`, `JWTPayload`, `APIResponse`
- [ ] Remove underscore prefix from parameters: `_req` → `req`, `_res` → `res`
- [ ] Delete bypass logic in `authenticateToken` (lines 20-22)
- [ ] Uncomment original `authenticateToken` implementation
- [ ] Delete bypass logic in `requireRole` (lines 93-95)
- [ ] Uncomment original `requireRole` implementation
- [ ] Run `npm run build` to verify
- [ ] Test authentication endpoints
- [ ] Remove this document

---

## 🛡️ Security Note

**IMPORTANT:** This configuration allows **unrestricted access** to all routes, including:
- User management endpoints
- Device control endpoints
- Project and task management
- Alert systems
- Reports and KPI data

**Do not deploy this configuration to production!**

---

## 📝 Original Implementation Preserved

The original authentication and authorization logic is **preserved as comments** in the middleware file. No code was deleted, only bypassed.

### Original Features (Currently Disabled):
- ✅ JWT token validation
- ✅ Access token vs refresh token differentiation
- ✅ User existence and active status checks
- ✅ Role-based access control (admin, worker)
- ✅ Proper error responses with standardized error codes
- ✅ Middleware chaining (`authenticateToken` → `requireRole`)

---

## 🔄 Affected Routes

All routes that previously required authentication now allow unrestricted access:

### User Routes (`/api/users`)
- GET / - List users
- GET /:id - Get user by ID
- POST / - Create user
- PUT /:id - Update user
- DELETE /:id - Delete user

### Auth Routes (`/api/auth`)
- POST /logout - Logout (still works, but doesn't verify token)
- GET /profile - Get profile (returns without user data)

### Device Routes (`/api/devices`)
- GET /:id - Get device
- PUT /:id - Update device
- DELETE /:id - Delete device

### Alert Routes (`/api/alerts`)
- GET / - List alerts
- GET /:id - Get alert
- POST / - Create alert
- PUT /:id/acknowledge - Acknowledge alert
- DELETE /:id - Delete alert

### Other Protected Routes
- Device Types (`/api/device-types`) - All operations
- KPI endpoints - All operations
- Any other routes using `authenticateToken` middleware

---

## 💡 Alternative: Conditional Authentication

If you need to selectively enable/disable authentication, consider using an environment variable:

```typescript
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Check if authentication is disabled via environment variable
  if (process.env.DISABLE_AUTH === 'true') {
    console.log("⚠️  WARNING: Authentication is disabled via DISABLE_AUTH env var");
    next();
    return;
  }
  
  // Normal authentication logic...
};
```

Then in `.env`:
```
DISABLE_AUTH=true   # Disable authentication
# DISABLE_AUTH=false  # Enable authentication
```

---

## 📞 Support

If you need help re-enabling authentication or have questions:
1. Check the `CONTROLLER_DEVELOPMENT_GUIDE.md` for authentication patterns
2. Review the commented code in `src/middleware/auth.ts`
3. Test with Postman collection after re-enabling

---

**Remember:** Delete this file after re-enabling authentication!
