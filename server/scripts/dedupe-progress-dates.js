require('dotenv').config();
const { connectDB, disconnectDB } = require('../config/db');
const Progress = require('../models/Progress');

async function main() {
  await connectDB();
  const duplicates = await Progress.aggregate([
    { $group: { _id: { user: '$user', date: '$date' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);

  let removed = 0;
  for (const group of duplicates) {
    const [keep, ...remove] = group.ids;
    if (remove.length) {
      const result = await Progress.deleteMany({ _id: { $in: remove } });
      removed += result.deletedCount || 0;
    }
  }

  await Progress.collection.createIndex({ user: 1, date: 1 }, { unique: true, name: 'user_date_unique' });
  console.log(`Progress deduplication complete. Groups: ${duplicates.length}; removed: ${removed}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB().catch(() => {});
  });
