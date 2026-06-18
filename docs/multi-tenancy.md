# GroundedDesk Multi-Tenancy Design & Threat Model

This document outlines the multi-tenant isolation architecture for GroundedDesk, detailing how PostgreSQL Row-Level Security (RLS), Qdrant payload-based partitioning, API key security, and connection pooling prevent cross-tenant data leakage.

---

## 1. Architectural Overview

GroundedDesk is a multi-tenant SaaS application that isolates each client's (tenant's) data at the database and vector search layers. Rather than maintaining separate databases or vector collections per tenant—which degrades performance and scaling limits—we implement a **shared-database, shared-collection** architecture enforced by strict application and database-level isolation policies.

```
                  ┌─────────────────────────────┐
                  │      Incoming Request       │
                  └──────────────┬──────────────┘
                                 │
                     [ TenantMiddleware / Guard ]
                                 │
                   (Resolves JWT / API Key to Tenant)
                                 │
                       [ AsyncLocalStorage ]
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
     [ PostgreSQL (RLS) ]                 [ Qdrant Vector DB ]
┌───────────────────────────┐         ┌───────────────────────────┐
│ Set: app.current_tenant   │         │ Filter: tenant_id == ID   │
├───────────────────────────┤         ├───────────────────────────┤
│ Enforced by DB-level      │         │ Enforced by Qdrant        │
│ SELECT/INSERT/UPDATE      │         │ payload match index       │
└───────────────────────────┘         └───────────────────────────┘
```

---

## 2. PostgreSQL Row-Level Security (RLS)

PostgreSQL RLS ensures that SQL queries cannot read or write data belonging to another tenant, even if the application code lacks a `where tenantId = ...` clause.

### Configuration
1. **Enable RLS on tables**:
   ```sql
   ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "chunks" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
   ...
   ```
2. **Force Security for Table Owners**:
   ```sql
   ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
   ```
   *Note: Table owners and superusers bypass RLS by default. `FORCE ROW LEVEL SECURITY` ensures even the application database user is subject to the policies.*

3. **Session Variable Context Resolver**:
   We define a PostgreSQL helper function to retrieve the transaction-scoped tenant ID:
   ```sql
   CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
   BEGIN
     RETURN NULLIF(current_setting('app.current_tenant', true), '')::uuid;
   EXCEPTION
     WHEN OTHERS THEN RETURN NULL;
   END;
   $$ LANGUAGE plpgsql STABLE;
   ```

4. **Security Policy**:
   ```sql
   CREATE POLICY tenant_isolation ON "users"
     USING ("tenant_id" = current_tenant_id())
     WITH CHECK ("tenant_id" = current_tenant_id());
   ```
   - `USING` controls which existing rows are visible (`SELECT`, `UPDATE`, `DELETE`).
   - `WITH CHECK` controls which new rows can be inserted or modified (`INSERT`, `UPDATE`).

### Prisma Integration (`TenantAwarePrismaService`)
To propagate the tenant ID safely, the backend wraps every database transaction in a scoped block that sets the `app.current_tenant` setting:
```typescript
async withTenantScope<T>(callback: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const tenantId = this.getCurrentTenantId(); // Extracted from AsyncLocalStorage
  
  return this.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_tenant', $1, true)`,
      tenantId,
    );
    return callback(tx as unknown as PrismaClient);
  });
}
```
*Note: Setting `set_config(..., true)` scopes the configuration variable strictly to the transaction. When the transaction finishes (commit or rollback), the variable is automatically cleared.*

### Administrative Bypass
For database migrations, system metrics logging, and seeding scripts, we define an admin bypass policy:
```sql
CREATE POLICY admin_bypass ON "users"
  USING (current_setting('app.bypass_rls', true) = 'true');
```
We execute admin scripts inside:
```typescript
await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'true', true)`);
```

---

## 3. Qdrant Vector Partitioning

Instead of maintaining a separate Qdrant collection per tenant (which causes high overhead and indexing issues at scale), we use **payload-based partitioning** in a single `groundeddesk_chunks` collection.

### Payload Indexing
We configure a payload index on the `tenant_id` field using keyword schema settings, enabling Qdrant to optimize searches:
```typescript
await client.createPayloadIndex(COLLECTION_NAME, {
  field_name: 'tenant_id',
  field_schema: {
    type: 'keyword',
    is_tenant: true, // Optimizes memory allocation and clustering for tenant partitions
  },
});
```

### Retrieval Filter Enforcements
Every vector search query must specify the `tenant_id` payload filter. Qdrant restricts similarity searches strictly within matching payloads:
```typescript
async search(tenantId: string, vector: number[], limit: number = 5) {
  return this.client.search(COLLECTION_NAME, {
    vector,
    limit,
    filter: {
      must: [
        {
          key: 'tenant_id',
          match: { value: tenantId },
        },
      ],
    },
    with_payload: true,
  });
}
```

---

## 4. API Key Security

To support embedding the chat widget on tenant websites, GroundedDesk validates requests via hashed API keys.

1. **Format**: Keys are generated as `gd_live_[32 random alphanumeric characters]`.
2. **Prefix Storage**: We save the first 16 characters (`gd_live_xxxxxxxx`) as plain-text `keyPrefix` for database lookup.
3. **Bcrypt Hash**: The full API key is hashed using `bcrypt` (10 rounds) and stored in `keyHash`.
4. **Validation Pipeline**:
   - The middleware extracts the key from headers or queries.
   - We query the database by the unique `keyPrefix` to fetch the specific API key record.
   - We compare the client-supplied raw key against the stored `keyHash` via `bcrypt.compare`.
   - On success, we resolve the tenant scope and initialize `AsyncLocalStorage` with the resolved `tenantId`.

This design protects against database breaches (as api keys are stored as non-reversible bcrypt hashes) while maintaining high lookup efficiency.

---

## 5. Threat Model & Mitigations

| Threat | Description | Mitigation |
| :--- | :--- | :--- |
| **SQL Injection to Bypass Tenant Filter** | An attacker injects malicious inputs to read cross-tenant database rows. | Enforced at Postgres database level via RLS policies; even raw SQL queries fail to bypass policies since they are evaluated per-row at database level. |
| **Cross-Tenant Vector Lookup** | An attacker guesses or manipulates parameters to query vectors of another tenant. | The NestJS retrieval service enforces the `tenant_id` filter using `AsyncLocalStorage` context. Direct client socket connections are validated on connection. |
| **Bypass context via connection pooling** | In a connection-pooled environment (e.g. PgBouncer), session variables set by one request may leak to another request. | We use transaction-scoped variables (`set_config(..., true)`) and wrap all RLS queries inside a single `$transaction` block. This guarantees settings are discarded immediately upon transaction termination. |
| **API Key Database Leak** | An attacker compromises the database and reads customer API keys. | API keys are hashed using `bcrypt` (one-way hashing). Compromising the database does not reveal the raw keys required to authenticate widget chats. |
| **Unauthorized Widget Embedding** | Tenant B embeds Tenant A's widget API key on their website. | The admin panel allows configuring permitted CORS origins. The backend Chat Gateway validates origin headers against the tenant's permitted URLs during Socket.io handshakes. |
