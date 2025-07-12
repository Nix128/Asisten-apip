const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { sendToGemini } = require('./sendToAI'); // We might need this for summarization

const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../memory/knowledge_base.json');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Vector Embedding ---
async function getEmbedding(text) {
  // In a real-world scenario, you'd use a proper embedding model.
  // For this example, we'll simulate it by creating a simple "bag-of-words" vector.
  // This is NOT a real embedding, but serves the purpose for our logic.
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const vector = {};
  words.forEach(word => {
    vector[word] = (vector[word] || 0) + 1;
  });
  return vector;
}

// --- Knowledge Base Management ---
async function readKnowledgeBase() {
  try {
    const data = await fs.readFile(KNOWLEDGE_BASE_PATH, 'utf-8');
    const knowledgeBase = JSON.parse(data);
    // Retroactively add IDs to entries that don't have one
    knowledgeBase.forEach(item => {
      if (!item.id) {
        item.id = uuidv4();
      }
    });
    return knowledgeBase;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // File doesn't exist, return empty array
    }
    throw error;
  }
}

async function writeKnowledgeBase(data) {
  await fs.writeFile(KNOWLEDGE_BASE_PATH, JSON.stringify(data, null, 2));
}

async function upsertKnowledge(topic, newText) {
  const knowledgeBase = await readKnowledgeBase();
  const newEmbedding = await getEmbedding(newText);
  const topicEmbedding = await getEmbedding(topic);

  // Find if a similar topic already exists
  let bestMatchIndex = -1;
  let highestSimilarity = 0.7; // Set a threshold to avoid updating unrelated entries

  knowledgeBase.forEach((item, index) => {
    const similarity = cosineSimilarity(topicEmbedding, item.embedding);
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatchIndex = index;
    }
  });

  if (bestMatchIndex !== -1) {
    // Update existing entry
    console.log(`Updating existing knowledge for topic: "${topic}"`);
    knowledgeBase[bestMatchIndex].text = newText;
    knowledgeBase[bestMatchIndex].embedding = newEmbedding;
    knowledgeBase[bestMatchIndex].createdAt = new Date().toISOString();
  } else {
    // Add new entry
    console.log(`Adding new knowledge for topic: "${topic}"`);
    knowledgeBase.push({
      id: uuidv4(), // Add a unique ID
      topic: topic, // Store the original topic for context
      text: newText,
      embedding: newEmbedding,
      createdAt: new Date().toISOString()
    });
  }

  await writeKnowledgeBase(knowledgeBase);
}

// --- Web Scraping ---
async function scrapeUrl(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);

    // Try to find the main content area, then fall back to simpler tags
    let mainContent = $('article').text() || $('.post-content').text() || $('.entry-content').text() || $('#main-content').text();

    if (!mainContent) {
      // Fallback to grabbing all paragraphs if specific containers aren't found
      $('p').each((i, elem) => {
        mainContent += $(elem).text() + '\n';
      });
    }
    
    // Clean up the text by removing extra whitespace and newlines
    const cleanedContent = mainContent.replace(/\s\s+/g, ' ').trim();

    if (cleanedContent.length < 100) {
        // If content is too short, it might be a soft-block or empty page, try just paragraphs
        let pContent = '';
        $('p').each((i, elem) => {
            pContent += $(elem).text() + '\n';
        });
        return pContent.replace(/\s\s+/g, ' ').trim();
    }

    return cleanedContent;
  } catch (error) {
    console.error(`❌ Gagal scrape URL: ${url}`, error.message);
    return null;
  }
}

// --- Search & Retrieval ---
function cosineSimilarity(vecA, vecB) {
    // This is a simplified cosine similarity for our bag-of-words model
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

    if (magA === 0 || magB === 0) {
        return 0;
    }
    return dotProduct / (magA * magB);
}


async function findRelevantKnowledge(query, topK = 1) {
  const knowledgeBase = await readKnowledgeBase();
  if (knowledgeBase.length === 0) {
    return [];
  }

  const queryEmbedding = await getEmbedding(query);

  const scoredKnowledge = knowledgeBase.map(item => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  scoredKnowledge.sort((a, b) => b.score - a.score);

  // Return the full object, not just the text
  return scoredKnowledge.slice(0, topK);
}


module.exports = {
  upsertKnowledge,
  scrapeUrl,
  findRelevantKnowledge,
  getEmbedding,
  readKnowledgeBase,
  writeKnowledgeBase
};
