# Cursor Rules for Smart Factory Backend

This directory contains cursor rules organized by topic. These rules are derived from `.github/copilot-instructions.md` and provide guidance for AI coding assistants.

## Rule Files

- **`architecture.md`**: System overview, components, and key files
- **`snapshots.md`**: Deferred snapshot pattern (CRITICAL - most important pattern)
- **`tasks.md`**: Task generation, execution tracking, and workflow
- **`quantity-tracking.md`**: Quantity calculation and producedQuantity logic
- **`api-contracts.md`**: API response format, code style, MQTT, file handling
- **`pitfalls.md`**: Common mistakes to avoid and best practices

## Quick Reference

### Most Critical Rules

1. **Snapshots are created at task generation time, NOT at project creation**
2. **Always use SnapshotService for snapshot creation**
3. **Projects store live references only - no embedded snapshots**
4. **Maintain execution number through task chains**
5. **Update `api_spec/types/` when changing API contracts**

### When Working With Tasks

- Tasks are auto-generated on project activation (ALL first-step tasks upfront)
- Task completion triggers next step creation with SAME execution number
- Only increment producedQuantity when `isLastStepInRecipe === true`
- Tasks require `deviceTypeId` at creation, `deviceId` assigned when ONGOING

### When Working With Snapshots

- Use `SnapshotService.getOrCreateRecipeSnapshot(recipeId)`
- Use `SnapshotService.getOrCreateProductSnapshot(productId)`
- Never look for embedded snapshots in projects
- Always reference snapshots via `task.recipeSnapshotId`

### Code Style

- TypeScript strict mode enabled
- Interface naming: Prefix with `I` (e.g., `ITask`, `IProject`)
- All endpoints return `APIResponse<T>` format
- Always wrap in try-catch, return appropriate HTTP status codes

## Architecture Version

**Last Updated:** November 2025  
**Architecture Version:** Deferred snapshots with execution tracking and quantity management

