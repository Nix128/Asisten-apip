const { connectToDatabase } = require('./database');

const DAILY_LIMIT = 100;

async function getQuotaCollection() {
  const db = await connectToDatabase();
  return db.collection('quota');
}

async function checkAndIncrementQuota() {
  const quotaCollection = await getQuotaCollection();
  const today = new Date().toISOString().split('T')[0];

  let quota = await quotaCollection.findOne({ _id: 'search_quota' });

  // Reset count if it's a new day or doesn't exist
  if (!quota || quota.date !== today) {
    await quotaCollection.updateOne(
      { _id: 'search_quota' },
      { $set: { date: today, count: 0 } },
      { upsert: true }
    );
    quota = { date: today, count: 0 };
  }

  if (quota.count >= DAILY_LIMIT) {
    return { canSearch: false, remaining: 0 };
  }

  // Increment the count
  const result = await quotaCollection.updateOne(
    { _id: 'search_quota' },
    { $inc: { count: 1 } }
  );

  return { canSearch: true, remaining: DAILY_LIMIT - (quota.count + 1) };
}

module.exports = { checkAndIncrementQuota };
