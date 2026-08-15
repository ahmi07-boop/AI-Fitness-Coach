require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: npm run reset-password -- user@example.com NewPassword');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exitCode = 1;
    return;
  }

  await connectDB();
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
    return;
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();

  console.log(`Password updated for ${user.name} (${user.email}).`);
  console.log(`Role: ${user.role}`);
}

main()
  .catch((error) => {
    console.error('Could not reset password:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await disconnectDB();
  });
