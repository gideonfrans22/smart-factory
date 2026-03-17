import * as fs from "fs";
import * as path from "path";
const ROOT_DIR = path.resolve(__dirname, "..");
const MODULES_DIR = path.join(ROOT_DIR, "src", "modules");
function toPascalCase(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function writeFileIfNotExists(filePath: string, content: string) {
  if (fs.existsSync(filePath)) {
    console.log(`SKIP  ${path.relative(ROOT_DIR, filePath)} (already exists)`);
    return;
  }
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
  console.log(`CREATE ${path.relative(ROOT_DIR, filePath)}`);
}
function generateModule(moduleRawName: string) {
  const moduleKebab = toKebabCase(moduleRawName);
  const modulePascal = toPascalCase(moduleRawName);
  const moduleCamel =
    modulePascal.charAt(0).toLowerCase() + modulePascal.slice(1);
  const moduleDir = path.join(MODULES_DIR, moduleKebab);
  ensureDir(moduleDir);
  const baseRoutePath = `/api/${moduleKebab}`;
  // ---- types ----
  const typesContent = `export interface ${modulePascal}DTO {
    // TODO: define DTO fields
    // example:
    // name: string;
  }
  export interface ${modulePascal}Filters {
    // TODO: define filter fields
    // example:
    // search?: string;
  }
  `;
  // ---- model ----
  const modelContent = `import mongoose, { Schema, Document } from "mongoose";
  export interface ${modulePascal}Document extends Document {
    // TODO: define document fields
    // name: string;
    // createdAt: Date;
    // updatedAt: Date;
  }
  const ${modulePascal}Schema = new Schema<${modulePascal}Document>(
    {
      // name: { type: String, required: true },
    },
    {
      timestamps: true,
    }
  );
  export const ${modulePascal} = mongoose.model<${modulePascal}Document>(
    "${modulePascal}",
    ${modulePascal}Schema
  );
  `;
  // ---- service ----
  const serviceContent = `import { ${modulePascal}, ${modulePascal}Document } from "./${moduleKebab}.model";
  import { ${modulePascal}DTO, ${modulePascal}Filters } from "./${moduleKebab}.types";
  export class ${modulePascal}Service {
    async list(filters: ${modulePascal}Filters = {}): Promise<${modulePascal}Document[]> {
      // TODO: apply filters
      return ${modulePascal}.find().exec();
    }
    async getById(id: string): Promise<${modulePascal}Document | null> {
      return ${modulePascal}.findById(id).exec();
    }
    async create(data: ${modulePascal}DTO): Promise<${modulePascal}Document> {
      const doc = new ${modulePascal}(data);
      return doc.save();
    }
    async update(id: string, data: Partial<${modulePascal}DTO>): Promise<${modulePascal}Document | null> {
      return ${modulePascal}.findByIdAndUpdate(id, data, { new: true }).exec();
    }
    async remove(id: string): Promise<${modulePascal}Document | null> {
      return ${modulePascal}.findByIdAndDelete(id).exec();
    }
  }
  export const ${moduleCamel}Service = new ${modulePascal}Service();
  `;
  // ---- controller ----
  const controllerContent = `import { Request, Response, NextFunction } from "express";
  import { ${moduleCamel}Service } from "./${moduleKebab}.service";
  export class ${modulePascal}Controller {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        const items = await ${moduleCamel}Service.list(req.query as any);
        res.json({ success: true, data: items });
      } catch (error) {
        next(error);
      }
    }
    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await ${moduleCamel}Service.getById(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "${modulePascal} not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async create(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await ${moduleCamel}Service.create(req.body);
        res.status(201).json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async update(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await ${moduleCamel}Service.update(req.params.id, req.body);
        if (!item) {
          return res.status(404).json({ success: false, message: "${modulePascal} not found" });
        }
        res.json({ success: true, data: item });
      } catch (error) {
        next(error);
      }
    }
    async remove(req: Request, res: Response, next: NextFunction) {
      try {
        const item = await ${moduleCamel}Service.remove(req.params.id);
        if (!item) {
          return res.status(404).json({ success: false, message: "${modulePascal} not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  }
  export const ${moduleCamel}Controller = new ${modulePascal}Controller();
  `;
  // ---- routes ----
  const routesContent = `import { Router } from "express";
  import { ${moduleCamel}Controller } from "./${moduleKebab}.controller";
  // import { authMiddleware } from "../../shared/middleware/auth"; // example
  const router = Router();
  // router.use(authMiddleware); // enable if needed
  router.get("/", ${moduleCamel}Controller.list);
  router.get("/:id", ${moduleCamel}Controller.getById);
  router.post("/", ${moduleCamel}Controller.create);
  router.put("/:id", ${moduleCamel}Controller.update);
  router.delete("/:id", ${moduleCamel}Controller.remove);
  export default router;
  `;
  // ---- index (barrel) ----
  const indexContent = `export * from "./${moduleKebab}.types";
  export * from "./${moduleKebab}.model";
  export * from "./${moduleKebab}.service";
  export * from "./${moduleKebab}.controller";
  export { default as ${moduleCamel}Routes } from "./${moduleKebab}.routes";
  `;
  writeFileIfNotExists(
    path.join(moduleDir, `${moduleKebab}.types.ts`),
    typesContent
  );
  writeFileIfNotExists(
    path.join(moduleDir, `${moduleKebab}.model.ts`),
    modelContent
  );
  writeFileIfNotExists(
    path.join(moduleDir, `${moduleKebab}.service.ts`),
    serviceContent
  );
  writeFileIfNotExists(
    path.join(moduleDir, `${moduleKebab}.controller.ts`),
    controllerContent
  );
  writeFileIfNotExists(
    path.join(moduleDir, `${moduleKebab}.routes.ts`),
    routesContent
  );
  writeFileIfNotExists(path.join(moduleDir, `index.ts`), indexContent);
  console.log(
    `\nModule "${moduleKebab}" generated under src/modules/${moduleKebab}`
  );
  console.log(`Base route suggestion: ${baseRoutePath}`);
}
function main() {
  const [, , moduleName] = process.argv;
  if (!moduleName) {
    console.error("Usage: ts-node scripts/generate-module.ts <module-name>");
    process.exit(1);
  }
  generateModule(moduleName);
}
main();
