const express = require("express");
const router = express.Router();
const { sendToGemini, searchGoogle } = require("../utils/sendToAI");
const { findRelevantKnowledge } = require("../utils/knowledge");
const { checkAndIncrementQuota } = require("../utils/quota");

// Middleware to initialize chat structure
router.use((req, res, next) => {
  if (!req.session.chats) {
    req.session.chats = {};
    const initialChatId = `chat-${Date.now()}`;
    req.session.chats[initialChatId] = {
      name: "Percakapan Baru",
      history: [],
    };
    req.session.currentChatId = initialChatId;
  }
  next();
});

// GET all chat sessions
router.get("/sessions", (req, res) => {
  res.json({
    chats: req.session.chats,
    currentChatId: req.session.currentChatId,
  });
});

// POST a new message to the current chat
router.post("/", async (req, res) => {
  const { message, apiKeys } = req.body;
  const { currentChatId, chats, fileContext } = req.session;

  if (!message) {
    return res.status(400).json({ response: "⚠️ Tidak ada pesan yang dikirim." });
  }
  if (!currentChatId || !chats[currentChatId]) {
    return res.status(400).json({ response: "⚠️ Sesi chat tidak valid." });
  }

  try {
    const currentChat = chats[currentChatId];
    currentChat.history.push({ role: 'user', parts: [{ text: message }] });

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
    const firstResponse = await sendToGemini(currentChat.history, fileContext, apiKeys, tools);

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
          toolResultContent = await searchGoogle(functionArgs.query, apiKeys);
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
        currentChat.history.push({ role: 'model', parts: [{ text: finalResponse, documentData: docData }] });
        return res.json({ response: finalResponse, documentData: docData });
      }

      const toolResult = {
        role: "tool",
        parts: [{ functionResponse: { name: functionName, response: { content: toolResultContent } } }]
      };

      currentChat.history.push(candidate);
      currentChat.history.push(toolResult);

      console.log("Sending tool result back to model for final synthesis...");
      const secondResponse = await sendToGemini(currentChat.history, fileContext, apiKeys);
      finalResponse = secondResponse.content?.parts?.[0]?.text || "Maaf, terjadi kesalahan saat mensintesis hasil analisis.";

    } else {
      console.log("Model answered directly without tools.");
      finalResponse = candidate?.parts?.[0]?.text || "Maaf, saya tidak dapat memproses permintaan Anda saat ini.";
    }

    currentChat.history.push({ role: 'model', parts: [{ text: finalResponse }] });

    const historyLimit = 20;
    if (currentChat.history.length > historyLimit) {
      currentChat.history = currentChat.history.slice(currentChat.history.length - historyLimit);
    }

    res.json({ response: finalResponse });

  } catch (error) {
    console.error("❌ Error di chat.js:", error);
    res.status(500).json({ response: "⚠️ Maaf, terjadi kesalahan internal." });
  }
});

// POST to create a new chat session
router.post("/new", (req, res) => {
  const newChatId = `chat-${Date.now()}`;
  req.session.chats[newChatId] = {
    name: "Percakapan Baru",
    history: [],
  };
  req.session.currentChatId = newChatId;
  res.json({
    success: true,
    newChatId,
    chats: req.session.chats,
  });
});

// POST to switch the current chat session
router.post("/switch", (req, res) => {
  const { chatId } = req.body;
  if (req.session.chats[chatId]) {
    req.session.currentChatId = chatId;
    res.json({ success: true, currentChatId: chatId });
  } else {
    res.status(404).json({ success: false, message: "Chat tidak ditemukan." });
  }
});

// DELETE a chat session
router.delete("/:chatId", (req, res) => {
  const { chatId } = req.params;
  if (req.session.chats[chatId]) {
    delete req.session.chats[chatId];

    // If the deleted chat was the current one, switch to another or create a new one
    if (req.session.currentChatId === chatId) {
      const remainingChatIds = Object.keys(req.session.chats);
      if (remainingChatIds.length > 0) {
        req.session.currentChatId = remainingChatIds[0];
      } else {
        // If no chats are left, create a new one
        const newChatId = `chat-${Date.now()}`;
        req.session.chats[newChatId] = { name: "Percakapan Baru", history: [] };
        req.session.currentChatId = newChatId;
      }
    }
    res.json({ success: true, chats: req.session.chats, currentChatId: req.session.currentChatId });
  } else {
    res.status(404).json({ success: false, message: "Chat tidak ditemukan." });
  }
});

// PUT to rename a chat session
router.put("/:chatId/rename", (req, res) => {
  const { chatId } = req.params;
  const { newName } = req.body;

  if (!newName || newName.trim() === "") {
    return res.status(400).json({ success: false, message: "Nama baru tidak boleh kosong." });
  }

  if (req.session.chats[chatId]) {
    req.session.chats[chatId].name = newName;
    res.json({ success: true, chats: req.session.chats });
  } else {
    res.status(404).json({ success: false, message: "Chat tidak ditemukan." });
  }
});

// Endpoint to clear file context (if needed)
router.post("/reset", (req, res) => {
  req.session.fileContext = null;
  res.json({ success: true, message: "Konteks file direset." });
});

module.exports = router;
