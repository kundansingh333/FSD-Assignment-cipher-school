# Engineering Report

## Executive Summary

During the investigation of BugForge, several critical security vulnerabilities were discovered alongside minor configuration defects. The primary issues identified were systemic Insecure Direct Object Reference (IDOR) vulnerabilities across the project, task, and comment controllers, as well as Mass Assignment risks. All identified defects were resolved through targeted, incremental commits that preserve the existing behavior while securely enforcing authorization.

## Issues Found, Severity, Impact, and Root Cause

1. **IDOR in Project Controller**
   - **Severity**: High
   - **Impact**: Any authenticated user could view the details of any project simply by guessing its `projectId`.
   - **Root Cause**: The `getProject` method fetched projects from the database without filtering by the requesting user's ownership or membership.
2. **IDOR and Mass Assignment in Task Controller**
   - **Severity**: High
   - **Impact**: Users could read, update, and delete tasks in projects they didn't have access to. Additionally, arbitrary fields could be updated due to a lack of schema validation in the `updateTask` payload.
   - **Root Cause**: The `getTask`, `updateTask`, and `deleteTask` methods failed to check whether the user had access to the parent project. `updateTask` directly passed the raw `req.body` into `findByIdAndUpdate`.
3. **IDOR in Comment Controller**
   - **Severity**: High
   - **Impact**: Unauthorized users could view and post comments to tasks in projects they did not have access to.
   - **Root Cause**: `listComments` and `createComment` relied on `req.params.taskId` without validating the user's authorization to the underlying project.
4. **Duplicate Mongoose Index Warning**
   - **Severity**: Low
   - **Impact**: Unnecessary logging noise on startup and redundant index creation attempts.
   - **Root Cause**: The `email` field in the User model was marked as `unique: true` and an explicit `userSchema.index({ email: 1 }, { unique: true });` was declared right after.

## Fixes Made and Alternatives Considered

- **Project Controller**: Updated the Mongoose `findOne` query to filter by `_id` and ensure the `owner` or `members` array contained `req.user.id`.
- **Task & Comment Controllers**: Introduced a shared helper query `availableProject` to ensure the task's parent project was accessible by the user before performing any read, update, or delete operations. _Alternative Considered_: I considered creating an Express middleware for ownership validation, but since the application was structured to handle lookups inside the controllers, injecting inline checks preserved existing architectural patterns better.
- **Mass Assignment**: Leveraged the existing `taskSchema` from Zod with `.partial().parse(req.body)` to safely filter inputs before passing them to the database.
- **Duplicate Index**: Removed the explicit `userSchema.index` call, letting the `unique: true` attribute handle indexing natively.

## Tests and Manual Verification Performed

- Started the application locally (`pnpm dev`) successfully without missing environment variable issues.
- Verified that MongoDB connected without duplicate index warnings.
- Inspected the patched endpoints in the codebase to ensure that the Mongoose schemas correctly execute the authorization filtering rules and Zod schemas strictly parse input objects.

## Remaining Risks and Recommended Follow-up Work

- **Further IDOR Reviews**: Other endpoints (like notifications or dashboard metrics) might still implicitly leak data if not rigorously checked. A complete audit using a standardized permission model (like Casl or specialized middleware) is recommended.
- **Rate Limiting**: No rate-limiting mechanisms were observed for login, registration, or password-reset flows, leaving the service vulnerable to brute-force attacks and enumeration.
- **Testing**: Automated end-to-end integration tests (using Jest or Supertest) should be introduced to continuously enforce authorization rules and prevent regressions.
