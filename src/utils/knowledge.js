const { connectToDatabase } = require('./database');
const { v4: uuidv4 } = require('uuid');

// We still need the embedding and similarity logic locally
async function getEmbedding(text) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const vector = {};
  words.forEach(word => {
    vector[word] = (vector[word] || 0) + 1;
  });
  return vector;
}

function cosineSimilarity(vecA, vecB) {
    const terms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    for (const term of terms) {
        const valA = vecA[term] || 0;
        const valB = vecB[term] || 0;
        dotProduct += valA * valB;
        magA += valA * valA;
        magB += valB * valB;
    }
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

async function getKnowledgeCollection() {
  const db = await connectToDatabase();
  return db.collection('knowledge');
}

async function readKnowledgeBase() {
  const knowledgeCollection = await getKnowledgeCollection();
  return knowledgeCollection.find({}).toArray();
}

async function writeKnowledgeBase(data) {
    // This function is now a proxy for bulk-inserting, though not used in the app.
    // In a real scenario, you'd handle migrations or bulk inserts differently.
    const knowledgeCollection = await getKnowledgeCollection();
    await knowledgeCollection.deleteMany({});
    if (data.length > 0) {
        await knowledgeCollection.insertMany(data);
    }
}

async function upsertKnowledge(topic, newText) {
  const knowledgeCollection = await getKnowledgeCollection();
  const newEmbedding = await getEmbedding(newText);
  
  // For simplicity, we'll just add new knowledge. 
  // A more robust system would check for duplicates.
  const newEntry = {
    _id: uuidv4(),
    topic: topic,
    text: newText,
    embedding: newEmbedding,
    createdAt: new Date(),
  };
  await knowledgeCollection.insertOne(newEntry);
  console.log(`Knowledge for topic "${topic}" inserted into database.`);
}

async function findRelevantKnowledge(query, topK = 1) {
  const knowledgeBase = await readKnowledgeBase();
  if (knowledgeBase.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);

  const scoredKnowledge = knowledgeBase.map(item => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  scoredKnowledge.sort((a, b) => b.score - a.score);
  return scoredKnowledge.slice(0, topK);
}

module.exports = {
  upsertKnowledge,
  findRelevantKnowledge,
  getEmbedding,
  readKnowledgeBase,
  writeKnowledgeBase,
  getKnowledgeCollection
};
