const { connectToDatabase } = require('./database');
const { getEmbedding } = require('./sendToAI'); // Import the new embedding function

/**
 * Gets the MongoDB collection for the knowledge base.
 * @returns {Promise<import('mongodb').Collection>}
 */
async function getKnowledgeCollection() {
  const db = await connectToDatabase();
  return db.collection('knowledge');
}

/**
 * Finds relevant knowledge base entries using MongoDB's Atlas Vector Search.
 *
 * @param {string} query - The user's query to search for.
 * @param {number} [topK=3] - The number of top results to return.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of relevant knowledge entries with a 'score' field.
 */
async function findRelevantKnowledge(query, topK = 3) {
  try {
    const knowledgeCollection = await getKnowledgeCollection();

    // 1. Create an embedding for the user's query.
    const queryEmbedding = await getEmbedding(query);
    if (!queryEmbedding) {
      console.error("Failed to create query embedding. Aborting search.");
      return [];
    }

    // 2. Define the Atlas Vector Search aggregation pipeline.
    //    Make sure you have a search index named 'vector_index' on the 'knowledge' collection.
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index', // The name of your Atlas Search Index
          path: 'embedding',     // The field in your documents that contains the vector
          queryVector: queryEmbedding,
          numCandidates: 100,    // Number of candidates to consider
          limit: topK            // Number of top results to return
        }
      },
      {
        $project: {
          _id: 1,
          topic: 1,
          text: 1,
          createdAt: 1,
          score: { $meta: 'vectorSearchScore' } // Project the search score
        }
      }
    ];

    // 3. Execute the search.
    const results = await knowledgeCollection.aggregate(pipeline).toArray();
    
    console.log(`Vector search found ${results.length} relevant documents for query: "${query}"`);
    return results;

  } catch (error) {
    console.error('❌ Error during vector search in findRelevantKnowledge:', error);
    // If the error is about the index not existing, provide a helpful message.
    if (error.message.includes('index not found')) {
        console.error("---");
        console.error("❗ HINT: The Atlas Vector Search index 'vector_index' might be missing.");
        console.error("   Please create it in your MongoDB Atlas dashboard on the `Asisten-Pribadi.knowledge` collection.");
        console.error("   Index configuration should be: { \"fields\": [ { \"type\": \"vector\", \"path\": \"embedding\", \"numDimensions\": 768, \"similarity\": \"cosine\" } ] }");
        console.error("---");
    }
    return []; // Return empty array on error
  }
}

/**
 * Creates an embedding for a text and stores it in the knowledge base.
 * @param {string} topic - The topic or filename for the content.
 * @param {string} content - The text content to learn.
 * @returns {Promise<void>}
 */
async function learnContent(topic, content) {
  try {
    if (!topic || !content) {
      console.warn("Skipping learning: topic or content is empty.");
      return;
    }

    const knowledgeCollection = await getKnowledgeCollection();
    
    console.log(`Learning content for topic: "${topic}"...`);
    const embedding = await getEmbedding(content);

    if (!embedding) {
      throw new Error('Failed to create text embedding for learning.');
    }

    // Using updateOne with upsert is a robust way to add or replace knowledge
    await knowledgeCollection.updateOne(
      { topic: topic }, // Find document by topic
      {
        $set: {
          text: content,
          embedding: embedding,
          updatedAt: new Date()
        },
        $setOnInsert: { // Set createdAt only if it's a new document
          createdAt: new Date()
        }
      },
      { upsert: true } // Create the document if it doesn't exist
    );

    console.log(`Successfully learned and stored knowledge for topic: "${topic}".`);

  } catch (error) {
    console.error(`❌ Error in learnContent for topic "${topic}":`, error);
    // We don't re-throw here to avoid crashing the entire analysis if only learning fails.
  }
}

module.exports = {
  getKnowledgeCollection,
  findRelevantKnowledge,
  getEmbedding, // Re-export for convenience
  learnContent
};
