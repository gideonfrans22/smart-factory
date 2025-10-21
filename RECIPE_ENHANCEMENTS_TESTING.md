# Recipe Enhancements Testing Guide

## Test Suite: Step Dependencies

### Test 1: Create Recipe with Valid Dependencies ✅

**Request:**

```http
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "productCode": "TEST-001",
  "version": 1,
  "name": "Test Recipe with Dependencies",
  "description": "Testing dependency validation",
  "steps": [
    {
      "stepId": "STEP_1",
      "order": 1,
      "name": "Preparation",
      "description": "Prepare materials",
      "estimatedDuration": 10,
      "requiredDevices": ["TABLET_001"],
      "qualityChecks": ["Material check"],
      "dependsOn": []
    },
    {
      "stepId": "STEP_2",
      "order": 2,
      "name": "Assembly",
      "description": "Assemble components",
      "estimatedDuration": 20,
      "requiredDevices": ["TABLET_001"],
      "qualityChecks": ["Assembly check"],
      "dependsOn": ["STEP_1"]
    },
    {
      "stepId": "STEP_3",
      "order": 3,
      "name": "Testing",
      "description": "Test final product",
      "estimatedDuration": 15,
      "requiredDevices": ["TABLET_001"],
      "qualityChecks": ["Function test"],
      "dependsOn": ["STEP_2"]
    }
  ]
}
```

**Expected Result:**

- Status: 201 Created
- Recipe created successfully
- Total estimatedDuration = 45 minutes
- Save recipeId for next tests

---

### Test 2: Get Dependency Graph ✅

**Request:**

```http
GET /api/recipes/:recipeId/dependency-graph
Authorization: Bearer <token>
```

**Expected Result:**

```json
{
  "success": true,
  "message": "Dependency graph retrieved successfully",
  "data": {
    "recipeId": "...",
    "productCode": "TEST-001",
    "version": 1,
    "topologicalOrder": [
      {
        "stepId": "STEP_1",
        "name": "Preparation",
        "order": 1,
        "dependsOn": [],
        "level": 0
      },
      {
        "stepId": "STEP_2",
        "name": "Assembly",
        "order": 2,
        "dependsOn": ["STEP_1"],
        "level": 1
      },
      {
        "stepId": "STEP_3",
        "name": "Testing",
        "order": 3,
        "dependsOn": ["STEP_2"],
        "level": 2
      }
    ],
    "dependencyGraph": {
      "STEP_1": [],
      "STEP_2": ["STEP_1"],
      "STEP_3": ["STEP_2"]
    }
  }
}
```

---

### Test 3: Create Recipe with Circular Dependency ❌

**Request:**

```http
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "productCode": "TEST-002",
  "version": 1,
  "name": "Invalid Recipe - Circular",
  "steps": [
    {
      "stepId": "STEP_A",
      "name": "Step A",
      "estimatedDuration": 10,
      "dependsOn": ["STEP_C"]
    },
    {
      "stepId": "STEP_B",
      "name": "Step B",
      "estimatedDuration": 10,
      "dependsOn": ["STEP_A"]
    },
    {
      "stepId": "STEP_C",
      "name": "Step C",
      "estimatedDuration": 10,
      "dependsOn": ["STEP_B"]
    }
  ]
}
```

**Expected Result:**

- Status: 500 Internal Server Error
- Error message: "Circular dependency detected involving step '...'"
- Recipe NOT created

---

### Test 4: Create Recipe with Non-Existent Dependency ❌

**Request:**

```http
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "productCode": "TEST-003",
  "version": 1,
  "name": "Invalid Recipe - Missing Dependency",
  "steps": [
    {
      "stepId": "STEP_1",
      "name": "Step 1",
      "estimatedDuration": 10,
      "dependsOn": []
    },
    {
      "stepId": "STEP_2",
      "name": "Step 2",
      "estimatedDuration": 10,
      "dependsOn": ["STEP_DOES_NOT_EXIST"]
    }
  ]
}
```

**Expected Result:**

- Status: 500 Internal Server Error
- Error message: "Step 'STEP_2' depends on non-existent step 'STEP_DOES_NOT_EXIST'"
- Recipe NOT created

---

### Test 5: Parallel Steps with Shared Dependency ✅

**Request:**

```http
POST /api/recipes
Authorization: Bearer <token>
Content-Type: application/json

{
  "productCode": "TEST-004",
  "version": 1,
  "name": "Parallel Steps Recipe",
  "steps": [
    {
      "stepId": "PREP",
      "name": "Preparation",
      "estimatedDuration": 10,
      "dependsOn": []
    },
    {
      "stepId": "TASK_A",
      "name": "Task A (Parallel)",
      "estimatedDuration": 20,
      "dependsOn": ["PREP"]
    },
    {
      "stepId": "TASK_B",
      "name": "Task B (Parallel)",
      "estimatedDuration": 20,
      "dependsOn": ["PREP"]
    },
    {
      "stepId": "FINAL",
      "name": "Final Assembly",
      "estimatedDuration": 15,
      "dependsOn": ["TASK_A", "TASK_B"]
    }
  ]
}
```

**Expected Result:**

- Status: 201 Created
- Recipe created successfully
- Dependency graph shows:
  - Level 0: PREP
  - Level 1: TASK_A, TASK_B (can run in parallel)
  - Level 2: FINAL (waits for both)

---

## Test Suite: Step Media

### Test 6: Upload Instruction Document ✅

**Request:**

```http
POST /api/recipes/:recipeId/steps/STEP_1/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: [Upload a PDF file, e.g., "instruction_manual.pdf"]
- mediaType: INSTRUCTION
- description: Complete step-by-step instruction manual
```

**Expected Result:**

- Status: 201 Created
- Returns media object with mediaId, filename, originalName, etc.
- File saved to uploads/task-media/
- Save mediaId for next tests

---

### Test 7: Upload Multiple Diagrams ✅

**Request:**

```http
POST /api/recipes/:recipeId/steps/STEP_2/media/multiple
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- files: [Upload image 1, e.g., "diagram1.png"]
- files: [Upload image 2, e.g., "diagram2.png"]
- files: [Upload image 3, e.g., "diagram3.png"]
- mediaType: DIAGRAM
- description: Assembly process diagrams
```

**Expected Result:**

- Status: 201 Created
- Returns array of 3 media objects
- Message: "3 media files uploaded successfully"

---

### Test 8: Get All Media for a Step ✅

**Request:**

```http
GET /api/recipes/:recipeId/steps/STEP_1/media
Authorization: Bearer <token>
```

**Expected Result:**

- Status: 200 OK
- Returns array of all media for STEP_1
- Should include the instruction document from Test 6

---

### Test 9: Download Media File ✅

**Request:**

```http
GET /api/recipes/:recipeId/steps/STEP_1/media/:mediaId/download
Authorization: Bearer <token>
```

**Expected Result:**

- Status: 200 OK
- File downloads with original filename
- Content-Type header matches file type

---

### Test 10: Update Media Metadata ✅

**Request:**

```http
PUT /api/recipes/:recipeId/steps/STEP_1/media/:mediaId
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaType": "QUALITY_CHECK",
  "description": "Updated: Now classified as quality check document"
}
```

**Expected Result:**

- Status: 200 OK
- Media type changed to QUALITY_CHECK
- Description updated

---

### Test 11: Delete Media File ✅

**Request:**

```http
DELETE /api/recipes/:recipeId/steps/STEP_1/media/:mediaId
Authorization: Bearer <token>
```

**Expected Result:**

- Status: 200 OK
- Message: "Media deleted successfully"
- File removed from filesystem
- GET request to same media returns 404

---

### Test 12: Upload Without File ❌

**Request:**

```http
POST /api/recipes/:recipeId/steps/STEP_1/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- mediaType: INSTRUCTION
- description: Test without file
```

**Expected Result:**

- Status: 400 Bad Request
- Error: "No file uploaded"

---

### Test 13: Upload with Invalid Media Type ❌

**Request:**

```http
POST /api/recipes/:recipeId/steps/STEP_1/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: [Upload a file]
- mediaType: INVALID_TYPE
- description: Testing validation
```

**Expected Result:**

- Status: 400 Bad Request
- Error: "Invalid media type. Must be one of: INSTRUCTION, DIAGRAM, VIDEO, QUALITY_CHECK"

---

### Test 14: Upload to Non-Existent Recipe ❌

**Request:**

```http
POST /api/recipes/000000000000000000000000/steps/STEP_1/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: [Upload a file]
- mediaType: INSTRUCTION
```

**Expected Result:**

- Status: 404 Not Found
- Error: "Recipe not found"

---

### Test 15: Upload to Non-Existent Step ❌

**Request:**

```http
POST /api/recipes/:recipeId/steps/STEP_999/media
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: [Upload a file]
- mediaType: INSTRUCTION
```

**Expected Result:**

- Status: 404 Not Found
- Error: "Recipe step not found"

---

## Integration Test: Complete Workflow

### Workflow Test: Create Recipe with Dependencies and Media ✅

**Step 1: Create Recipe**

```http
POST /api/recipes
{
  "productCode": "WORKFLOW-001",
  "version": 1,
  "name": "Complete Workflow Test",
  "steps": [
    { "stepId": "PREP", "dependsOn": [], ... },
    { "stepId": "ASSEMBLE", "dependsOn": ["PREP"], ... },
    { "stepId": "TEST", "dependsOn": ["ASSEMBLE"], ... }
  ]
}
```

**Step 2: Verify Dependency Graph**

```http
GET /api/recipes/:recipeId/dependency-graph
```

**Step 3: Upload Media to Each Step**

```http
POST /api/recipes/:recipeId/steps/PREP/media
POST /api/recipes/:recipeId/steps/ASSEMBLE/media/multiple
POST /api/recipes/:recipeId/steps/TEST/media
```

**Step 4: Get All Recipe Data**

```http
GET /api/recipes/:recipeId
```

**Step 5: Verify Media for Each Step**

```http
GET /api/recipes/:recipeId/steps/PREP/media
GET /api/recipes/:recipeId/steps/ASSEMBLE/media
GET /api/recipes/:recipeId/steps/TEST/media
```

**Step 6: Create Project Using Recipe**

```http
POST /api/projects
{
  "name": "Test Project",
  "recipeId": ":recipeId"
}
```

**Step 7: Create Tasks Following Dependency Order**

```http
POST /api/tasks { "recipeStepId": "PREP", ... }
POST /api/tasks { "recipeStepId": "ASSEMBLE", ... }
POST /api/tasks { "recipeStepId": "TEST", ... }
```

**Expected Result:**

- All steps complete successfully
- Recipe has complete dependency graph
- Each step has attached media
- Project and tasks created with correct relationships

---

## Manual Testing Checklist

### Dependencies

- [ ] Create recipe with valid linear dependencies
- [ ] Create recipe with parallel steps
- [ ] Create recipe with multiple dependencies per step
- [ ] Try to create recipe with circular dependency (should fail)
- [ ] Try to create recipe with non-existent dependency (should fail)
- [ ] Get dependency graph and verify topological order
- [ ] Verify level assignments in topological order

### Media Upload

- [ ] Upload PDF instruction document
- [ ] Upload PNG diagram image
- [ ] Upload JPEG photo
- [ ] Upload MP4 video
- [ ] Upload multiple files at once (2-5 files)
- [ ] Upload maximum files (10 files)
- [ ] Try to upload without file (should fail)
- [ ] Try to upload with invalid media type (should fail)

### Media Management

- [ ] Get all media for a step
- [ ] Download media file
- [ ] Update media metadata (type and description)
- [ ] Delete media file
- [ ] Verify file is removed from filesystem
- [ ] Try to access deleted media (should fail)

### Edge Cases

- [ ] Upload to non-existent recipe (should fail)
- [ ] Upload to non-existent step (should fail)
- [ ] Download non-existent media (should fail)
- [ ] Update non-existent media (should fail)
- [ ] Delete non-existent media (should fail)
- [ ] Upload very large file (test size limit)
- [ ] Upload file with special characters in name

### Integration

- [ ] Create recipe with dependencies
- [ ] Add media to all steps
- [ ] Get complete recipe data
- [ ] Create project using recipe
- [ ] Create tasks for each step
- [ ] Verify tasks follow dependency order
- [ ] Access step media from task context

---

## Automated Test Script (Optional)

```bash
#!/bin/bash

# Set variables
BASE_URL="http://localhost:3000"
TOKEN="your-access-token"
RECIPE_ID=""

echo "=== Recipe Enhancements Test Suite ==="

# Test 1: Create recipe with dependencies
echo "Test 1: Creating recipe with dependencies..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/recipes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productCode": "AUTO-TEST-001",
    "version": 1,
    "name": "Automated Test Recipe",
    "steps": [
      {
        "stepId": "STEP_1",
        "name": "Prep",
        "estimatedDuration": 10,
        "dependsOn": []
      },
      {
        "stepId": "STEP_2",
        "name": "Assembly",
        "estimatedDuration": 20,
        "dependsOn": ["STEP_1"]
      }
    ]
  }')

RECIPE_ID=$(echo $RESPONSE | jq -r '.data._id')
echo "✅ Recipe created: $RECIPE_ID"

# Test 2: Get dependency graph
echo "Test 2: Getting dependency graph..."
curl -s -X GET "$BASE_URL/api/recipes/$RECIPE_ID/dependency-graph" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo "✅ Dependency graph retrieved"

# Test 3: Upload media
echo "Test 3: Uploading media..."
curl -s -X POST "$BASE_URL/api/recipes/$RECIPE_ID/steps/STEP_1/media" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.pdf" \
  -F "mediaType=INSTRUCTION" \
  -F "description=Test document" | jq .
echo "✅ Media uploaded"

# Test 4: Get step media
echo "Test 4: Getting step media..."
curl -s -X GET "$BASE_URL/api/recipes/$RECIPE_ID/steps/STEP_1/media" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo "✅ Media retrieved"

echo "=== All tests completed ==="
```

---

## Performance Testing

### Load Test: Dependency Validation

```bash
# Test dependency validation performance
# Create 100 recipes with 10 steps each, varying dependencies

for i in {1..100}; do
  curl -X POST /api/recipes \
    -H "Authorization: Bearer $TOKEN" \
    -d "{ recipe with 10 steps }"
done

# Measure: Average response time should be < 200ms
```

### Load Test: Media Upload

```bash
# Test media upload performance
# Upload 100 files in parallel

for i in {1..100}; do
  curl -X POST /api/recipes/:id/steps/STEP_1/media \
    -F "file=@test${i}.pdf" &
done
wait

# Measure: All uploads should complete within 30 seconds
```

---

## Success Criteria

### Dependencies

✅ Valid dependencies are accepted
✅ Circular dependencies are rejected with clear error
✅ Non-existent dependencies are rejected with clear error
✅ Topological order is calculated correctly
✅ Parallel steps are identified (same level)

### Media

✅ All file types are accepted (images, documents, videos)
✅ Multiple files can be uploaded at once
✅ Media can be downloaded with original filename
✅ Media metadata can be updated
✅ Media files are deleted from filesystem
✅ Invalid uploads are rejected with clear errors

### Performance

✅ Dependency validation < 200ms
✅ Media upload < 2s per file
✅ Dependency graph calculation < 100ms

---

**Ready for testing! 🚀**
