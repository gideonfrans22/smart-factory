import { User } from "../models/User";
import { connectDB } from "../config/database";
import { hashPassword } from "../utils/helpers";

const seedDefaultUsers = async (): Promise<void> => {
  try {
    console.log("👥 Seeding default users...");

    // Create default admin user
    const adminExists = await User.findOne({ email: "admin@smartfactory.com" });
    if (!adminExists) {
      const adminPassword = await hashPassword("admin123");
      await User.create({
        name: "Factory Administrator",
        email: "admin@smartfactory.com",
        password: adminPassword,
        role: "admin"
      });
      console.log(
        "✅ Default admin created (email: admin@smartfactory.com, password: admin123)"
      );
    }

    // Create additional admin user
    const managerExists = await User.findOne({
      email: "manager@smartfactory.com"
    });
    if (!managerExists) {
      const managerPassword = await hashPassword("manager123");
      await User.create({
        name: "Production Manager",
        email: "manager@smartfactory.com",
        password: managerPassword,
        role: "admin"
      });
      console.log(
        "✅ Production manager created (email: manager@smartfactory.com, password: manager123)"
      );
    }

    // Create sample workers with employee numbers
    const workerNames = [
      "John Smith",
      "Maria Garcia",
      "Chen Wei",
      "Ahmed Hassan",
      "Anna Kowalski"
    ];

    for (let i = 1; i <= 5; i++) {
      const empNo = `EMP${String(i).padStart(3, "0")}`;
      const workerExists = await User.findOne({ empNo });
      if (!workerExists) {
        const workerPassword = await hashPassword("worker123");
        await User.create({
          empNo,
          name: workerNames[i - 1],
          password: workerPassword,
          role: "worker"
        });
      }
    }

    console.log(
      "✅ Default workers created (empNo: EMP001-EMP005, password: worker123)"
    );
    console.log("📋 Worker credentials:");
    console.log("   - EMP001 (John Smith)");
    console.log("   - EMP002 (Maria Garcia)");
    console.log("   - EMP003 (Chen Wei)");
    console.log("   - EMP004 (Ahmed Hassan)");
    console.log("   - EMP005 (Anna Kowalski)");
  } catch (error) {
    console.error("❌ Error seeding users:", error);
  }
};

const runSeeder = async (): Promise<void> => {
  try {
    await connectDB();
    await seedDefaultUsers();
    console.log("🎉 Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Run seeder if called directly
if (require.main === module) {
  runSeeder();
}

export { seedDefaultUsers, runSeeder };
