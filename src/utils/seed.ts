import mongoose from 'mongoose';
import { ProcessLine } from '../models/ProcessLine';
import { User } from '../models/User';
import { connectDB } from '../config/database';
import { hashPassword } from '../utils/helpers';

const seedProcessLines = async (): Promise<void> => {
  try {
    console.log('🌱 Seeding process lines...');
    
    const processLinesData = [
      { lineNumber: 1, name: 'Initial Processing', description: 'First stage component preparation', maxCapacity: 10 },
      { lineNumber: 2, name: 'Quality Inspection', description: 'Initial quality check and sorting', maxCapacity: 8 },
      { lineNumber: 3, name: 'Component Assembly', description: 'Basic component assembly', maxCapacity: 12 },
      { lineNumber: 4, name: 'Precision Machining', description: 'High precision machining operations', maxCapacity: 6 },
      { lineNumber: 5, name: 'Surface Treatment', description: 'Surface coating and treatment', maxCapacity: 15 },
      { lineNumber: 6, name: 'Heat Treatment', description: 'Thermal processing and hardening', maxCapacity: 10 },
      { lineNumber: 7, name: 'Advanced Assembly', description: 'Complex component assembly', maxCapacity: 8 },
      { lineNumber: 8, name: 'Testing Station', description: 'Functional and performance testing', maxCapacity: 12 },
      { lineNumber: 9, name: 'Calibration', description: 'Precision calibration and adjustment', maxCapacity: 6 },
      { lineNumber: 10, name: 'Final Inspection', description: 'Final quality assurance check', maxCapacity: 10 },
      { lineNumber: 11, name: 'Packaging Prep', description: 'Preparation for packaging', maxCapacity: 20 },
      { lineNumber: 12, name: 'Documentation', description: 'Technical documentation and labeling', maxCapacity: 15 },
      { lineNumber: 13, name: 'Special Processing', description: 'Specialized processing operations', maxCapacity: 5 },
      { lineNumber: 14, name: 'Rework Station', description: 'Component rework and repair', maxCapacity: 8 },
      { lineNumber: 15, name: 'Advanced Testing', description: 'Specialized testing procedures', maxCapacity: 6 },
      { lineNumber: 16, name: 'Clean Room Assembly', description: 'Clean environment assembly', maxCapacity: 4 },
      { lineNumber: 17, name: 'Micro Processing', description: 'Microscopic component processing', maxCapacity: 3 },
      { lineNumber: 18, name: 'Final Assembly', description: 'Final product assembly', maxCapacity: 10 },
      { lineNumber: 19, name: 'Quality Certification', description: 'Final quality certification', maxCapacity: 8 },
      { lineNumber: 20, name: 'Shipping Prep', description: 'Final packaging and shipping preparation', maxCapacity: 25 }
    ];

    for (const lineData of processLinesData) {
      await ProcessLine.findOneAndUpdate(
        { lineNumber: lineData.lineNumber },
        lineData,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Process lines seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding process lines:', error);
  }
};

const seedDefaultUsers = async (): Promise<void> => {
  try {
    console.log('👥 Seeding default users...');

    // Create default manager
    const managerExists = await User.findOne({ username: 'manager' });
    if (!managerExists) {
      const managerPassword = await hashPassword('manager123');
      await User.create({
        username: 'manager',
        email: 'manager@smartfactory.com',
        password: managerPassword,
        role: 'manager',
        firstName: 'Factory',
        lastName: 'Manager'
      });
      console.log('✅ Default manager created (username: manager, password: manager123)');
    }

    // Create sample workers for first 5 process lines
    for (let i = 1; i <= 5; i++) {
      const workerExists = await User.findOne({ username: `worker${i}` });
      if (!workerExists) {
        const workerPassword = await hashPassword('worker123');
        await User.create({
          username: `worker${i}`,
          email: `worker${i}@smartfactory.com`,
          password: workerPassword,
          role: 'worker',
          assignedProcessLine: i,
          firstName: `Worker`,
          lastName: `${i}`
        });
      }
    }
    
    console.log('✅ Default workers created (username: worker1-5, password: worker123)');
  } catch (error) {
    console.error('❌ Error seeding users:', error);
  }
};

const runSeeder = async (): Promise<void> => {
  try {
    await connectDB();
    await seedProcessLines();
    await seedDefaultUsers();
    console.log('🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run seeder if called directly
if (require.main === module) {
  runSeeder();
}

export { seedProcessLines, seedDefaultUsers, runSeeder };
