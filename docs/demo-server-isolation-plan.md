# Demo Server Isolation Plan (Same Host as Production)

> **Goal:** Run demo backend on the same machine as production without realtime event leakage (MQTT/WebSocket/Redis) into production clients.
>  
> **Current risk in this codebase:** High if both environments share MQTT topic namespace, Redis keys/channels, and frontend WS URL.

---

## 1) Non-Negotiable Isolation Rules

1. **Database isolation**
   - Demo must use a different MongoDB database (or cluster) than production.
2. **MQTT isolation**
   - Use either a separate broker for demo **or** a strict environment topic prefix (recommended even with separate brokers).
3. **Redis isolation**
   - Use separate Redis DB/index/instance for demo, and separate Socket.IO adapter channel key/prefix.
4. **WebSocket/API endpoint isolation**
   - Demo frontend must point only to demo API/WS endpoints.
   - Production frontend must never reference demo endpoints.
5. **Origin isolation**
   - `CORS_ORIGIN` for demo only includes demo domains/IPs.

If any one of these is skipped, cross-environment bleed can still happen.

---

## 2) Proposed Environment Topology

### Production
- API: `https://api.prod.example.com`
- WS: `wss://api.prod.example.com/ws`
- Mongo DB: `smart_factory_prod`
- Redis: `redis://127.0.0.1:6379/0`
- MQTT Broker: `mqtt://127.0.0.1:1883`
- MQTT topic prefix: `prod`

### Demo
- API: `https://api.demo.example.com`
- WS: `wss://api.demo.example.com/ws`
- Mongo DB: `smart_factory_demo`
- Redis: `redis://127.0.0.1:6379/1`
- MQTT Broker: `mqtt://127.0.0.1:1884` (preferred) or same broker with strict prefix
- MQTT topic prefix: `demo`

---

## 3) Concrete Configuration Plan

## 3.1 Backend `.env` (Demo)

Create a dedicated demo env file (`.env.demo`) and run the demo process with it.

```env
# Runtime
PORT=3012
NODE_ENV=production

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/smart_factory_demo?replicaSet=rs0
DB_NAME=smart_factory_demo

# Redis (separate db index or instance)
REDIS_URL=redis://127.0.0.1:6379/1

# MQTT
MQTT_BROKER_URL=mqtt://127.0.0.1:1884
MQTT_USERNAME=smart_factory_demo
MQTT_PASSWORD=change_me
MQTT_CLIENT_ID=smart_factory_backend_demo
MQTT_TOPIC_PREFIX=demo

# WebSocket/Socket.IO/Redis namespacing
SOCKET_IO_REDIS_KEY=socket.io:demo
REDIS_KEY_PREFIX=demo

# Security/CORS
JWT_SECRET=separate_demo_secret
CORS_ORIGIN=https://demo.example.com,https://monitor-demo.example.com
```

## 3.2 Backend `.env` (Production)

Keep production explicit and separate:

```env
PORT=3002
NODE_ENV=production
MONGODB_URI=mongodb://127.0.0.1:27017/smart_factory_prod?replicaSet=rs0
DB_NAME=smart_factory_prod
REDIS_URL=redis://127.0.0.1:6379/0
MQTT_BROKER_URL=mqtt://127.0.0.1:1883
MQTT_CLIENT_ID=smart_factory_backend_prod
MQTT_TOPIC_PREFIX=prod
SOCKET_IO_REDIS_KEY=socket.io:prod
REDIS_KEY_PREFIX=prod
CORS_ORIGIN=https://prod.example.com,https://monitor.prod.example.com
```

## 3.3 Frontend (Demo)

Set demo FE build/runtime variables:

```env
NEXT_PUBLIC_API_URL=https://api.demo.example.com/api
NEXT_PUBLIC_WS_URL=https://api.demo.example.com
```

## 3.4 Frontend (Production)

Set prod FE build/runtime variables:

```env
NEXT_PUBLIC_API_URL=https://api.prod.example.com/api
NEXT_PUBLIC_WS_URL=https://api.prod.example.com
```

---

## 4) Required Code-Level Hardening (Before Demo Goes Live)

1. **MQTT topic prefixing helper**
   - Add a helper that prepends `MQTT_TOPIC_PREFIX` to every publish/subscribe topic.
   - Example result:
     - `demo/device/123/status`
     - `prod/device/123/status`

2. **Socket.IO Redis adapter key separation**
   - Configure adapter channel key via `SOCKET_IO_REDIS_KEY` so demo and prod do not share pub/sub channels.

3. **Redis key prefix for app services**
   - Prefix keys used by:
     - device occupation (`device:occupied:*`)
     - online users (`online_users`, `socket_to_user`)
   - Example:
     - `demo:device:occupied:<id>`
     - `prod:online_users`

4. **Optional but recommended: room prefix strategy**
   - If shared WS infrastructure grows, add env room namespace:
     - `demo:global`, `prod:global`, etc.

---

## 5) Deployment Steps (Runbook)

1. **Prepare infra**
   - Create demo DB, Redis namespace, MQTT listener/broker.
2. **Set demo env file**
   - Verify all demo values differ from production.
3. **Deploy backend demo process**
   - Run with `.env.demo` and unique process/service name.
4. **Deploy demo frontend**
   - Ensure `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` point to demo backend.
5. **Lock inbound access**
   - Use Nginx/domain routing so prod domains never proxy to demo backend.
6. **Smoke test in isolation**
   - Connect demo FE only; verify demo websocket events appear only in demo FE.
7. **Cross-check no leakage**
   - Trigger demo actions and verify prod FE receives zero unexpected updates.

---

## 6) Validation Checklist (Go/No-Go)

- [ ] Demo API health endpoint is reachable via demo domain only.
- [ ] Demo FE connects to demo WS endpoint (check browser network tab).
- [ ] Demo MQTT messages include `demo/` topic prefix.
- [ ] Prod MQTT messages include `prod/` topic prefix.
- [ ] Redis keys for demo and prod are separated by DB index/prefix.
- [ ] Socket.IO adapter channels are separated by `SOCKET_IO_REDIS_KEY`.
- [ ] Production FE shows no updates during demo test traffic.
- [ ] Production logs show no demo-origin connections.

---

## 7) Rollback Plan

If leakage is detected:

1. Stop demo backend process immediately.
2. Disable demo domain upstream routing.
3. Rotate demo credentials (`JWT_SECRET`, MQTT user/password) if shared accidentally.
4. Flush demo Redis namespace only (never flush prod DB).
5. Re-verify environment variables and redeploy only after checklist passes.

---

## 8) Ownership and Timing

- **Infra owner:** creates isolated Redis/MQTT/Mongo resources.
- **Backend owner:** implements env prefixing + adapter key configuration.
- **Frontend owner:** enforces separate demo/prod `NEXT_PUBLIC_*` endpoints.
- **QA owner:** executes leakage checklist before stakeholder demo.

Target: complete sections 3-6 before first external demo session.

