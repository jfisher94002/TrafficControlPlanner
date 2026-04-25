# Frontend layout (modularization)

The main canvas experience lives in `my-app/src/traffic-control-planner.tsx`. That file is intentionally being split **incrementally** so drawing behavior, UI chrome, and static catalogs do not all share one module (see GitHub issue #192).

**Where new code should go:** Presentational pieces and hooks colocated under `my-app/src/features/tcp/` (for example `tcpCatalog.ts` for sign/device/road/tool data). Shared domain types stay in `my-app/src/types.ts`; Konva rendering stays at the edges. For full product and infrastructure context, see `TCP_Architecture.md` at the repository root.
