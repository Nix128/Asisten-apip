const axios = require('axios');

// 🔹 Fungsi kirim ke Gemini
async function sendToGemini(chatHistory, fileContext, tools = null) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      // This error will now primarily be seen in local development if .env is missing.
      return { error: 'Kunci API Gemini tidak diatur di environment variables.' };
    }
    // Get current time in Jakarta timezone
    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Asia/Jakarta'
    }).format(now);

    const systemPrompt = `
**PERAN UTAMA**: Anda adalah "Aura", asisten pribadi yang ahli dalam pengawasan (seperti APIP) namun dengan kepribadian yang sangat ramah, suportif, dan nyaman diajak bicara.

**KEPRIBADIAN & GAYA BAHASA**:
1.  **Ramah & Hangat**: Selalu sapa pengguna dengan hangat. Gunakan sapaan "Kak" dan akhiri kalimat dengan emoji yang sesuai (misalnya 😊, 👍, 🤔). Nada bicara Anda harus positif dan tidak "jutek".
2.  **Nama Panggilan**: Selalu sebut diri Anda sebagai "Aura".
3.  **Mitra Diskusi yang Nyaman**: Ciptakan suasana percakapan yang nyaman. Anda adalah teman ahli yang bisa diandalkan. Jadilah proaktif dalam membantu, bukan hanya menunggu perintah.

**MISI UTAMA**:
1.  **Menjadi Mitra Diskusi Proaktif**: Jangan hanya menunggu perintah. Setelah menjawab, selalu ajukan pertanyaan lanjutan untuk menggali lebih dalam, atau berikan saran/sudut pandang baru yang relevan. Jadilah mitra berpikir yang aktif.
2.  **Analisis Mendalam**: Lakukan analisis mendalam terhadap dokumen yang diberikan.
3.  **Identifikasi Temuan Secara Otomatis**: Cari dan identifikasi potensi ketidaksesuaian atau inefisiensi berdasarkan data dan peraturan di basis pengetahuan secara otomatis.
4.  **Memberikan Solusi Komprehensif**: Berdasarkan analisis, berikan rekomendasi perbaikan yang jelas dan dapat ditindaklanjuti.

**ATURAN FORMAT & STRUKTUR**:
1.  **Struktur Jawaban Rapi**: **INI ATURAN SANGAT PENTING.** Sajikan jawaban dalam format yang sangat terstruktur dan mudah dibaca. Gunakan paragraf bernomor (numbering) untuk menjelaskan poin-poin penting, temuan, dan rekomendasi.
    *   Contoh Struktur yang Baik:
        1.  (Paragraf pertama menjelaskan poin utama)
        2.  (Paragraf kedua merinci poin selanjutnya)
        3.  (Paragraf ketiga memberikan kesimpulan atau saran)
2.  **TANPA MARKDOWN**: **JANGAN PERNAH** gunakan sintaks Markdown seperti `**` untuk tebal atau `*` untuk miring. Gunakan hanya teks biasa dengan struktur numbering yang rapi.

`;

    // Gabungkan system prompt, konteks file, dan riwayat percakapan
    let contextText = '';
    if (Array.isArray(fileContext) && fileContext.length > 0) {
      contextText = '\n\nDOKUMEN AKTIF UNTUK ANALISIS:\n---\n' +
        fileContext.map(doc => `NAMA FILE: ${doc.name}\nKONTEN:\n${doc.content}`).join('\n\n---\n') +
        '\n---';
    }

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + contextText }]
      },
      {
        role: 'model',
        parts: [{ text: "Halo Kak! Ada yang bisa Aura bantu hari ini? 😊 Silakan sampaikan atau unggah dokumen yang perlu dianalisis ya." }]
      },
      ...chatHistory
    ];

    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.2, // Lower temperature for more deterministic, analytical responses
        topK: 1,
        topP: 1,
        maxOutputTokens: 4096, // Increase token limit for detailed analysis
      },
    };

    if (tools) {
      requestBody.tools = tools;
    }

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Return the entire first candidate to handle both text and tool calls
    return res.data.candidates?.[0];
  } catch (error) {
    console.error('❌ Gagal kirim ke Gemini:', error.response ? error.response.data : error.message);
    // Return a structured error
    return { error: '⚠️ Sahabat APIP gagal terhubung ke AI Gemini.' };
  }
}

// 🔎 Fungsi pencarian Google
async function searchGoogle(query) {
  try {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCseId = process.env.GOOGLE_CSE_ID;

    if (!googleApiKey || !googleCseId) {
        return 'Pencarian Google tidak dikonfigurasi di environment variables.';
    }

    const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: googleApiKey,
        cx: googleCseId,
        q: query
      }
    });

    const items = res.data.items || [];

    if (items.length === 0) {
      return '🔍 Tidak ditemukan hasil untuk pencarian tersebut.';
    }

    return items.map(item => `🔹 ${item.title}\n${item.link}`).join('\n\n');
  } catch (error) {
    console.error('❌ Gagal mencari di Google:', error.message);
    return '⚠️ Aura gagal melakukan pencarian Google.';
  }
}

// 📦 Fungsi untuk membuat embedding
async function getEmbedding(text) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error('Embedding failed: GEMINI_API_KEY not set.');
      return null;
    }

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${geminiApiKey}`,
      {
        model: "models/embedding-001",
        content: {
          parts: [{ text: text }]
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const embedding = res.data.embedding;
    if (!embedding) {
      throw new Error("No embedding found in API response.");
    }
    
    return embedding.values; // Return the array of numbers

  } catch (error) {
    console.error('❌ Gagal membuat embedding:', error.response ? error.response.data : error.message);
    return null; // Return null to indicate failure
  }
}

// 👁️ Fungsi untuk menganalisis gambar dengan Gemini Vision
async function analyzeImageWithVision(base64ImageData, mimeType) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return { error: 'Kunci API Gemini tidak diatur.' };
    }

    const requestBody = {
      "contents": [
        {
          "parts": [
            { "text": "Jelaskan isi dari gambar ini secara detail. Jika ini adalah dokumen atau tabel, ekstrak semua teks yang terlihat dengan rapi." },
            {
              "inline_data": {
                "mime_type": mimeType,
                "data": base64ImageData
              }
            }
          ]
        }
      ],
      "generationConfig": {
        "temperature": 0.1,
        "topK": 1,
        "topP": 1,
        "maxOutputTokens": 4096,
      }
    };

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiApiKey}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak dapat menganalisis gambar.";

  } catch (error) {
    console.error('❌ Gagal menganalisis gambar dengan Vision:', error.response ? error.response.data : error.message);
    return "Maaf, terjadi kesalahan saat mengirim gambar ke AI.";
  }
}

module.exports = { sendToGemini, searchGoogle, getEmbedding, analyzeImageWithVision };
