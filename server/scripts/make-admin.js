require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-admin -- user@example.com');
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin' } },
    { new: true, runValidators: true }
  ).select('-passwordHash');

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Admin role assigned to ${user.name} (${user.email}).`);
  console.log(`User ID: ${user._id}`);
}

main()
  .catch((error) => {
    console.error('Could not assign admin role:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDB();
  });
