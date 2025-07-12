const express = require("express");
const router = express.Router();
const { sendToGemini, searchGoogle } = require("../utils/sendToAI");
const { findRelevantKnowledge } = require("../utils/knowledge");
const { checkAndIncrementQuota } = require("../utils/quota");

// --- TEMPORARY DEBUGGING STATE (NO SESSIONS) ---
let tempHistory = [];
let tempFileContext = [];
// --- END TEMPORARY DEBUGGING STATE ---


// Middleware to initialize chat structure
// router.use((req, res, next) => {
//   if (!req.session.chats) {
//     req.session.chats = {};
//     const initialChatId = `chat-${Date.now()}`;
//     req.session.chats[initialChatId] = {
//       name: "Percakapan Baru",
//       history: [],
//     };
//     req.session.currentChatId = initialChatId;
//   }
//   next();
// });

// GET all chat sessions
router.get("/sessions", (req, res) => {
  // Return a dummy response as sessions are disabled
  res.json({
    chats: { 'temp-chat': { name: 'Temporary Chat', history: [] } },
    currentChatId: 'temp-chat',
  });
});

// POST a new message to the current chat
router.post("/", async (req, res) => {
  const { message } = req.body;
  // Using temporary state instead of session
  const fileContext = tempFileContext; 

  if (!message) {
    return res.status(400).json({ response: "⚠️ Tidak ada pesan yang dikirim." });
  }
  
  try {
    // Using temporary state instead of session
    tempHistory.push({ role: 'user', parts: [{ text: message }] });

    // Define the specialized tools for APIP
    const tools = [{
      "functionDeclarations": [
        {
          "name": "cari_peraturan_relevan",
          "description": "Mencari peraturan, standar, atau pedoman spesifik dari dalam basis pengetahuan (memori) berdasarkan topik atau kata kunci.",
          "parameters": {
            "type": "OBJECT",
            "properties": { "topik": { "type": "STRING", "description": "Topik, kata kunci, atau nomor peraturan yang ingin dicari." } },
            "required": ["topik"]
          }
        },
        {
          "name": "analisis_lintas_dokumen",
          "description": "Melakukan analisis mendalam dengan membandingkan semua dokumen yang aktif dalam sesi ini (misalnya DPA, Renja, Laporan Keuangan) satu sama lain dan dengan peraturan yang relevan di basis pengetahuan untuk menemukan ketidaksesuaian, potensi temuan, atau menjawab pertanyaan kompleks.",
          "parameters": {
            "type": "OBJECT",
            "properties": { "ringkasan_kasus": { "type": "STRING", "description": "Deskripsi singkat mengenai tujuan analisis atau pertanyaan spesifik yang perlu dijawab dari perbandingan dokumen." } },
            "required": ["ringkasan_kasus"]
          }
        },
        // {
        //   "name": "search_google",
        //   "description": "Gunakan fungsi ini jika Anda tidak dapat menemukan jawaban di basis pengetahuan internal dan memerlukan informasi eksternal dari internet, seperti peraturan terbaru, berita, atau data harga pasar.",
        //   "parameters": {
        //     "type": "OBJECT",
        //     "properties": { "query": { "type": "STRING", "description": "Kueri pencarian yang jelas dan ringkas untuk Google." } },
        //     "required": ["query"]
        //   }
        // },
        {
          "name": "buat_dokumen_laporan",
          "description": "Gunakan fungsi ini SETELAH Anda menghasilkan teks lengkap untuk sebuah laporan, program kerja, atau dokumen formal lainnya. Fungsi ini akan mengubah teks tersebut menjadi format yang dapat diunduh oleh pengguna.",
          "parameters": {
            "type": "OBJECT",
            "properties": {
              "judul_dokumen": { "type": "STRING", "description": "Judul singkat untuk dokumen, misalnya 'Laporan Hasil Pemeriksaan'." },
              "konten_lengkap": { "type": "STRING", "description": "Seluruh teks dari laporan atau dokumen yang telah Anda buat, diformat dengan newline." }
            },
            "required": ["judul_dokumen", "konten_lengkap"]
          }
        }
      ]
    }];

    // --- Agentic Loop for APIP ---
    console.log("Asking model to decide on a tool for APIP analysis...");
    const firstResponse = await sendToGemini(tempHistory, fileContext, tools);

    if (firstResponse.error) {
      return res.status(500).json({ response: firstResponse.error });
    }

    const candidate = firstResponse.content;
    let finalResponse;

    // Add a safety check for the candidate and its parts
    if (candidate && Array.isArray(candidate.parts) && candidate.parts.length > 0 && candidate.parts[0].functionCall) {
      const functionCall = candidate.parts[0].functionCall;
      const functionName = functionCall.name;
      const functionArgs = functionCall.args;
      console.log(`Model wants to call APIP tool: ${functionName} with args:`, functionArgs);

      let toolResultContent = '';

      if (functionName === 'cari_peraturan_relevan') {
        const relevantKnowledge = await findRelevantKnowledge(functionArgs.topik, 3); // Get top 3 relevant regulations
        if (relevantKnowledge.length > 0) {
          toolResultContent = "Berikut adalah peraturan relevan yang ditemukan dari basis pengetahuan:\n\n" +
            relevantKnowledge.map(item => `Peraturan: ${item.topic}\nSkor Relevansi: ${item.score.toFixed(2)}\nRingkasan:\n${item.text}\n---`).join('\n');
        } else {
          toolResultContent = "Tidak ada peraturan yang relevan ditemukan di basis pengetahuan untuk topik tersebut.";
        }
      } else if (functionName === 'analisis_lintas_dokumen') {
        if (Array.isArray(fileContext) && fileContext.length > 0) {
          toolResultContent = "Memulai analisis lintas dokumen. Berikut adalah konteks yang akan digunakan:\n\n" +
            fileContext.map(doc => `DOKUMEN: ${doc.name}\nKONTEN:\n${doc.content.substring(0, 5000)}...`).join('\n\n---\n');
          // Note: We don't need to add more here, the main context is already in the next call via the session. This tool's purpose is to trigger the deep analysis mode.
        } else {
          toolResultContent = "Tidak ada dokumen aktif dalam sesi ini untuk dianalisis. Silakan unggah dokumen terlebih dahulu.";
        }
      } else if (functionName === 'search_google') {
        const quotaStatus = await checkAndIncrementQuota();
        if (quotaStatus.canSearch) {
          toolResultContent = await searchGoogle(functionArgs.query);
          toolResultContent += `\n\n(Sisa kuota pencarian hari ini: ${quotaStatus.remaining})`;
        } else {
          toolResultContent = "Kuota pencarian Google harian (100) telah tercapai. Fungsi pencarian akan tersedia kembali besok.";
        }
      } else if (functionName === 'buat_dokumen_laporan') {
        // Instead of generating the file here, we'll send a special signal to the frontend.
        // The frontend will then make the actual request to the generation endpoint.
        const docData = {
          isDownloadable: true,
          title: functionArgs.judul_dokumen,
          content: functionArgs.konten_lengkap
        };
        // We send this structured data as the final response, bypassing the second AI call.
        // The frontend will know how to render this.
        const finalResponse = `Dokumen "${functionArgs.judul_dokumen}" siap untuk diunduh.\n\n${functionArgs.konten_lengkap}`;
        tempHistory.push({ role: 'model', parts: [{ text: finalResponse, documentData: docData }] });
        return res.json({ response: finalResponse, documentData: docData });
      }

      const toolResult = {
        role: "tool",
        parts: [{ functionResponse: { name: functionName, response: { content: toolResultContent } } }]
      };

      tempHistory.push(candidate);
      tempHistory.push(toolResult);

      console.log("Sending tool result back to model for final synthesis...");
      const secondResponse = await sendToGemini(tempHistory, fileContext);
      finalResponse = secondResponse.content?.parts?.[0]?.text || "Maaf, terjadi kesalahan saat mensintesis hasil analisis.";

    } else {
      console.log("Model answered directly without tools.");
      finalResponse = candidate?.parts?.[0]?.text || "Maaf, saya tidak dapat memproses permintaan Anda saat ini.";
    }

    tempHistory.push({ role: 'model', parts: [{ text: finalResponse }] });

    const historyLimit = 20;
    if (tempHistory.length > historyLimit) {
      // Keep history trimmed
      tempHistory = tempHistory.slice(tempHistory.length - historyLimit);
    }

    res.json({ response: finalResponse });

  } catch (error) {
    console.error("❌ Error di chat.js:", error);
    res.status(500).json({ response: "⚠️ Maaf, terjadi kesalahan internal." });
  }
});

// POST to create a new chat session
router.post("/new", (req, res) => {
  // Reset temporary history for this test
  tempHistory = [];
  res.json({
    success: true,
    newChatId: 'temp-chat',
    chats: { 'temp-chat': { name: 'Temporary Chat', history: [] } },
  });
});

// All other routes are disabled for this test as they rely on sessions

module.exports = router;
