# Session Rotation Strategy

## Goals

- Reduce risk of session fixation.
- Refresh session data on sensitive events.

## Rotation Events

- Successful login
- Password change
- Role change

## Implementation Notes

- Regenerate session data and CSRF token on login.
- Force re-login on role change (invalidate session).
- Consider short session TTL for admin accounts.
