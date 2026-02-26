

## Problem

There is a logical conflict in the current code:

1. When a login is purchased, `marcarComoVendido()` sets `ativo = 0`
2. The model's `listLogins()` query filters `WHERE a.ativo = 1`
3. The controller then tries to check purchases, but the sold logins are already excluded from the query results
4. Result: purchased logins disappear for the buyer too

## Solution

**Model (`LoginHotmail.php`)** — Update `listLogins` and `countLogins` to accept `$userId` and include logins that are either active OR purchased by the current user:

```sql
-- Current:
WHERE a.ativo = 1

-- New:
WHERE (a.ativo = 1 OR a.id IN (
  SELECT login_id FROM login_hotmail_compras WHERE user_id = ?
))
```

This ensures:
- Active (unsold) logins appear for everyone
- Inactive (sold) logins only appear for the user who bought them
- The controller's existing filtering logic then handles masking passwords and hiding other users' purchases

**Controller (`LoginHotmailController.php`)** — Pass `$userId` to both `listLogins()` and `countLogins()` calls.

## Files to change

1. **`api/src/models/LoginHotmail.php`** — Add `$userId` parameter to `listLogins()` and `countLogins()`, update SQL queries
2. **`api/src/controllers/LoginHotmailController.php`** — Pass `$userId` to model calls

## Files to upload after update

- `api/src/models/LoginHotmail.php`
- `api/src/controllers/LoginHotmailController.php`

