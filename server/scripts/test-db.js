require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');

async function main() {
  try {
    await connectDB();
    console.log('MongoDB test: OK');
  } catch (error) {
    console.error(`MongoDB test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
}

main();
