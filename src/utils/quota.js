const fs = require('fs/promises');
const path = require('path');

const QUOTA_FILE_PATH = path.join(__dirname, '../memory/search_quota.json');
const DAILY_LIMIT = 100;

async function readQuota() {
  try {
    const data = await fs.readFile(QUOTA_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, create a new one
    if (error.code === 'ENOENT') {
      const today = new Date().toISOString().split('T')[0];
      return { date: today, count: 0 };
    }
    throw error;
  }
}

async function writeQuota(quotaData) {
  await fs.writeFile(QUOTA_FILE_PATH, JSON.stringify(quotaData, null, 2));
}

async function checkAndIncrementQuota() {
  const quota = await readQuota();
  const today = new Date().toISOString().split('T')[0];

  // Reset count if it's a new day
  if (quota.date !== today) {
    quota.date = today;
    quota.count = 0;
  }

  if (quota.count >= DAILY_LIMIT) {
    return { canSearch: false, remaining: 0 };
  }

  quota.count++;
  await writeQuota(quota);

  return { canSearch: true, remaining: DAILY_LIMIT - quota.count };
}

module.exports = { checkAndIncrementQuota };
