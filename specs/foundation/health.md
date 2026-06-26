# Health Check Specification

## Purpose
Expose status metrics to load balancer probes.

## Responsibilities
* Check local disk availability.
* Check Redis connections.
* Expose diagnostics payloads.

## Dependencies
* External: `fastify`.
* Internal: `RedisConnectionClient`.

## Folder Structure
```text
src/presentation/web/routes/
└── health.ts         # Route handler for /health checks
```

## Data Flow
```mermaid
graph TD
    LB[Load Balancer / Probe] -->|GET /health| Route[Health Route Handler]
    Route --> Disk[Disk Write Checker]
    Route --> Redis[Redis Connection Checker]
    Disk --> Return{Status Code}
    Redis --> Return
    Return -->|All Healthy| ResponseOK[200 OK Status]
    Return -->|Any Down| ResponseErr[503 Service Unavailable]
```
