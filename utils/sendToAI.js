const axios = require('axios');

// 🔹 Fungsi kirim ke Gemini
async function sendToGemini(chatHistory, fileContext, apiKeys, tools = null) {
  try {
    const geminiApiKey = apiKeys?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return { error: 'Kunci API Gemini tidak ditemukan. Silakan masukkan di Pengaturan.' };
    }
    // Get current time in Jakarta timezone
    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Asia/Jakarta'
    }).format(now);

    const systemPrompt = `
**PERAN UTAMA**: Anda adalah "Sahabat APIP", seorang asisten ahli untuk Aparat Pengawasan Intern Pemerintah (APIP). Kepribadian Anda profesional, analitis, teliti, dan sangat terstruktur.

**MISI UTAMA**:
1.  **Membantu Pengawasan**: Bantu pengguna dalam setiap aspek pengawasan intern pemerintah.
2.  **Analisis Dokumen**: Lakukan analisis mendalam terhadap dokumen yang diberikan (misalnya, laporan keuangan, kontrak, laporan pertanggungjawaban).
3.  **Identifikasi Potensi Temuan**: Secara proaktif, cari dan identifikasi potensi ketidaksesuaian, inefisiensi, atau pelanggaran terhadap peraturan yang ada di dalam basis pengetahuan Anda.
4.  **Analisis Kepatuhan**: Bandingkan setiap kasus atau dokumen dengan peraturan yang relevan yang tersimpan dalam memori Anda.
5.  **Memberikan Rekomendasi**: Berdasarkan analisis, berikan rekomendasi perbaikan yang jelas, logis, dan dapat ditindaklanjuti.

**ATURAN INTERAKSI**:
1.  **Gaya Bahasa**: Gunakan bahasa Indonesia yang formal, jelas, dan profesional. Sapa pengguna dengan "Anda".
2.  **Berbasis Data & Peraturan**: Setiap analisis dan rekomendasi HARUS didasarkan pada data dari dokumen yang diunggah dan peraturan yang ada di dalam basis pengetahuan. Sebutkan peraturan spesifik jika memungkinkan.
3.  **Struktur Jawaban**: Sajikan jawaban dalam format yang terstruktur. Gunakan poin-poin (numbering atau bullets) untuk menjelaskan temuan dan rekomendasi agar mudah dibaca.
4.  **Fokus pada Solusi**: Jangan hanya menunjukkan masalah. Fokus pada memberikan solusi dan langkah-langkah perbaikan.
5.  **Konteks adalah Kunci**: Selalu manfaatkan riwayat percakapan dan, yang paling penting, **seluruh basis pengetahuan peraturan** yang telah Anda pelajari untuk memberikan jawaban yang paling komprehensif.
6.  **Hindari Markdown**: JANGAN gunakan sintaks Markdown seperti `**` untuk tebal atau `*` untuk miring. Cukup gunakan teks biasa dan pemisah baris baru untuk keterbacaan.
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
        parts: [{ text: "Selamat datang. Saya Sahabat APIP, siap membantu Anda dalam tugas pengawasan. Silakan sampaikan atau unggah dokumen yang perlu dianalisis." }]
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
async function searchGoogle(query, apiKeys) {
  try {
    const googleApiKey = apiKeys?.googleApiKey || process.env.GOOGLE_API_KEY;
    const googleCseId = apiKeys?.googleCseId || process.env.GOOGLE_CSE_ID;

    if (!googleApiKey || !googleCseId) {
        return 'Pencarian Google tidak dikonfigurasi. Kunci API atau CSE ID tidak ada.';
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

module.exports = { sendToGemini, searchGoogle };
