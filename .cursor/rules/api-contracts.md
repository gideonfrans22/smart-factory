# API Contracts and Code Style

## Git Submodule: `api_spec/`

The `api_spec/` directory is a **shared Git submodule** between frontend and backend:

```bash
# Initialize submodule
git submodule update --init --recursive

# Update submodule
cd api_spec && git pull origin main && cd ..
git add api_spec && git commit -m "Update api_spec"
```

**Always update TypeScript interfaces in `api_spec/types/` when modifying models or API responses.**

## Response Format

All endpoints return `APIResponse<T>` with:
- `success`: boolean
- `message`: string
- `data`: T (optional)

## Code Style

- **TypeScript strict mode** enabled
- **Interface naming**: Prefix with `I` (e.g., `ITask`, `IProject`)
- **Populate**: Use `.populate()` for referenced documents, but prefer snapshots in project context
- **Error handling**: Always wrap in try-catch, return appropriate HTTP status codes

## MQTT Real-Time Communication

MQTT broker handles real-time bidirectional communication between backend and devices:

**Backend publishes:**
- New task assignments to devices
- KPI updates

**Backend subscribes to:**
- Alerts from devices
- Task status updates from devices

**Configuration:** `src/config/mqtt.ts` - Set `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` in `.env`

## Media File Handling

Files uploaded via Multer are stored in `uploads/media/` with standardized naming:

**Naming Convention:** `{timestamp}-{randomhash}-{sanitizedOriginalName}`

Example: `1698765432000-a3f8b2c1d4e5-blueprint.pdf`

**Implementation:**
- `src/middleware/upload.ts`: Multer configuration with storage and file filters
- Supported: Images (jpeg, png, gif, webp, svg), Documents (pdf, docx, xlsx, pptx), Videos (mp4, avi, mov)
- Max file size: 50MB (configurable)
- Files linked to tasks/recipes via Media model with metadata

**Rules:**
- Don't manually construct file paths; use the naming pattern from `upload.ts`
- Always sanitize original filenames (replace special chars with underscores)

## Authentication State

**⚠️ AUTHENTICATION CURRENTLY DISABLED** (as of Oct 29, 2025)

- `src/middleware/auth.ts`: `authenticateToken` and `requireRole` middleware bypass all checks
- All routes are accessible without authentication tokens
- Console warnings indicate disabled state
- See `AUTH_TEMPORARILY_DISABLED.md` for re-enable instructions

When implementing auth-dependent features, be aware routes are currently open.

