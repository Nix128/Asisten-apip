document.addEventListener('DOMContentLoaded', () => {
  // --- DOM ELEMENT SELECTION ---
  const chatWindow = document.getElementById('chat-window');
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const fileUpload = document.getElementById('file-upload');
  const typingIndicator = document.getElementById('typing-indicator');
  const appContainer = document.querySelector('.app-container');
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menu-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const historyList = document.getElementById('history-list');
  const mainChat = document.querySelector('.main-chat');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const geminiApiKeyInput = document.getElementById('gemini-api-key');
  const googleApiKeyInput = document.getElementById('google-api-key');
  const googleCseIdInput = document.getElementById('google-cse-id');

  // --- STATE MANAGEMENT ---
  let chats = {};
  let currentChatId = null;

  // --- THEME MANAGEMENT ---
  const themeIcon = themeToggleBtn.querySelector('i');
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    localStorage.setItem('apip_theme', theme);
  };
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  });
  const savedTheme = localStorage.getItem('apip_theme') || 'light';
  applyTheme(savedTheme);

  // --- SETTINGS MODAL MANAGEMENT ---
  const showSettingsModal = (show) => {
    settingsModal.style.display = show ? 'flex' : 'none';
  };

  settingsBtn.addEventListener('click', () => showSettingsModal(true));
  closeSettingsBtn.addEventListener('click', () => showSettingsModal(false));
  saveSettingsBtn.addEventListener('click', () => {
    localStorage.setItem('gemini_api_key', geminiApiKeyInput.value);
    localStorage.setItem('google_api_key', googleApiKeyInput.value);
    localStorage.setItem('google_cse_id', googleCseIdInput.value);
    showSettingsModal(false);
    // Optionally, add a notification for the user that settings are saved
  });

  const loadSettings = () => {
    geminiApiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
    googleApiKeyInput.value = localStorage.getItem('google_api_key') || '';
    googleCseIdInput.value = localStorage.getItem('google_cse_id') || '';
  };

  const setChatInputDisabled = (disabled) => {
    userInput.disabled = disabled;
    sendBtn.disabled = disabled;
    userInput.placeholder = disabled ? "Menunggu inisialisasi..." : "Ajukan pertanyaan atau unggah dokumen untuk dianalisis...";
  };

  // --- SIDEBAR MANAGEMENT ---
  const handleMenuClick = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('show');
    } else {
      appContainer.classList.toggle('sidebar-collapsed');
      // Save the state for large screens
      localStorage.setItem('sidebar_collapsed', appContainer.classList.contains('sidebar-collapsed'));
    }
  };

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleMenuClick();
  });

  mainChat.addEventListener('click', () => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('show')) {
      sidebar.classList.remove('show');
    }
  });

  // --- CHAT & HISTORY LOGIC ---
  const typewriter = async (element, text) => {
    element.textContent = '';
    for (let i = 0; i < text.length; i++) {
      element.textContent += text[i];
      await new Promise(resolve => setTimeout(resolve, 10)); // Adjust speed here
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  };

  const downloadDocx = async (textContent, button) => {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunduh...';

    try {
      const response = await fetch('/api/generate/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent }),
      });

      if (!response.ok) {
        throw new Error('Gagal membuat dokumen di server.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'Laporan_Sahabat_APIP.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      button.innerHTML = '<i class="fa-solid fa-check"></i> Terunduh';
      setTimeout(() => {
        button.innerHTML = '<i class="fa-solid fa-file-word"></i> Unduh Laporan (.docx)';
        button.disabled = false;
      }, 2000);

    } catch (error) {
      console.error('Error downloading DOCX:', error);
      button.innerHTML = '<i class="fa-solid fa-times"></i> Gagal';
       setTimeout(() => {
        button.innerHTML = '<i class="fa-solid fa-file-word"></i> Unduh Laporan (.docx)';
        button.disabled = false;
      }, 2000);
    }
  };

  const appendMessage = async (role, text, isTypingEffect = false, documentData = null) => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = role === 'user' ? 'Anda' : 'Sahabat APIP';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'bubble';

    const bubbleContent = document.createElement('div');
    bubbleContent.className = 'bubble-content';

    bubbleDiv.appendChild(bubbleContent);
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(bubbleDiv);
    chatWindow.appendChild(messageDiv);

    if (role === 'model') {
      const bubbleFooter = document.createElement('div');
      bubbleFooter.className = 'bubble-footer';

      const copyBtn = document.createElement('i');
      copyBtn.className = 'fa-solid fa-copy copy-btn';
      copyBtn.title = 'Salin teks';
      bubbleFooter.appendChild(copyBtn);

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.className = 'fa-solid fa-check';
          setTimeout(() => {
            copyBtn.className = 'fa-solid fa-copy copy-btn';
          }, 1500);
        });
      });

      if (documentData && documentData.isDownloadable) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = `<i class="fa-solid fa-file-word"></i> Unduh ${documentData.title || 'Laporan'} (.docx)`;
        downloadBtn.addEventListener('click', () => downloadDocx(documentData.content, downloadBtn));
        bubbleFooter.appendChild(downloadBtn);
      }
      
      bubbleDiv.appendChild(bubbleFooter);
    }

    if (role === 'model' && isTypingEffect) {
      await typewriter(bubbleContent, text);
    } else {
      bubbleContent.innerText = text;
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
  };

  const renderCurrentChat = () => {
    chatWindow.innerHTML = '';
    const currentChat = chats[currentChatId];
    if (currentChat && currentChat.history.length > 0) {
      currentChat.history.forEach(msg => {
        const part = msg.parts[0];
        appendMessage(msg.role, part.text, false, part.documentData);
      });
    } else {
      showWelcomeMessage();
    }
  };

  const renderHistoryList = () => {
    historyList.innerHTML = '';
    if (Object.keys(chats).length === 0) {
      historyList.innerHTML = '<p class="empty-history">Tidak ada riwayat.</p>';
      return;
    }
    
    Object.entries(chats).forEach(([id, chat]) => {
      const item = document.createElement('div');
      item.className = `history-item ${id === currentChatId ? 'active' : ''}`;
      item.dataset.id = id;
      item.innerHTML = `
        <span class="history-title">${chat.name}</span>
        <div class="history-actions">
          <i class="fa-solid fa-pen-to-square edit-btn" title="Ubah Nama"></i>
          <i class="fa-solid fa-trash delete-btn" title="Hapus"></i>
        </div>
      `;
      
      item.querySelector('.history-title').addEventListener('click', () => switchChat(id));
      item.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        renameChat(id);
      });
      item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(id);
      });

      historyList.appendChild(item);
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const showWelcomeMessage = () => {
    chatWindow.innerHTML = `
      <div class="welcome-message">
        <i class="fa-solid fa-shield-halved"></i>
        <h2>Sahabat APIP</h2>
        <p>Sistem Asisten Ahli untuk Aparat Pengawasan Intern Pemerintah. Ajukan pertanyaan atau mulai dengan mengunggah dokumen untuk dianalisis.</p>
      </div>
    `;
  };

  const startNewChat = async () => {
    try {
      const response = await fetch('/api/chat/new', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        chats = data.chats;
        currentChatId = data.newChatId;
        renderHistoryList();
        renderCurrentChat();
        if (window.innerWidth <= 768) sidebar.classList.remove('show');
        return data.newChatId; // Return the new ID
      }
      return null;
    } catch (error) {
      console.error('Error starting new chat:', error);
      // Show an error message to the user
      appendMessage('model', '⚠️ Gagal memulai percakapan baru. Silakan coba lagi.', false);
    } finally {
      // Always enable the input after attempting to start a new chat
      setChatInputDisabled(false);
    }
  };

  const switchChat = async (chatId) => {
    if (chatId === currentChatId) return;
    try {
      const response = await fetch('/api/chat/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });
      const data = await response.json();
      if (data.success) {
        currentChatId = data.currentChatId;
        renderHistoryList();
        renderCurrentChat();
        if (window.innerWidth <= 768) sidebar.classList.remove('show');
      }
    } catch (error) {
      console.error('Error switching chat:', error);
    }
  };

  const renameChat = async (chatId) => {
    const chat = chats[chatId];
    if (!chat) return;
    const newName = prompt('Masukkan nama baru untuk percakapan ini:', chat.name);
    if (newName && newName.trim() !== '') {
      try {
        const response = await fetch(`/api/chat/${chatId}/rename`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: newName.trim() })
        });
        const data = await response.json();
        if (data.success) {
          chats = data.chats;
          renderHistoryList();
        }
      } catch (error) {
        console.error('Error renaming chat:', error);
      }
    }
  };

  const deleteChat = async (chatId) => {
    if (confirm('Apakah Anda yakin ingin menghapus percakapan ini?')) {
      try {
        const response = await fetch(`/api/chat/${chatId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
          chats = data.chats;
          currentChatId = data.currentChatId;
          renderHistoryList();
          renderCurrentChat();
        }
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const showTyping = (isTyping) => {
    typingIndicator.style.display = isTyping ? 'flex' : 'none';
  };

  const getApiKeys = () => ({
    geminiApiKey: localStorage.getItem('gemini_api_key'),
    googleApiKey: localStorage.getItem('google_api_key'),
    googleCseId: localStorage.getItem('google_cse_id'),
  });

  const sendMessage = async () => {
    const message = userInput.value.trim();
    if (!message) return;

    let chatId = currentChatId;

    // If there's no active chat, create one first
    if (!chatId) {
      chatId = await startNewChat();
      if (!chatId) {
        appendMessage('model', '⚠️ Gagal memulai percakapan baru. Silakan periksa pengaturan API Anda dan coba lagi.', false);
        return;
      }
    }

    const welcomeMessage = chatWindow.querySelector('.welcome-message');
    if (welcomeMessage) {
      chatWindow.innerHTML = '';
    }

    appendMessage('user', message, false);
    userInput.value = '';
    showTyping(true);

    chats[currentChatId].history.push({ role: 'user', parts: [{ text: message }] });
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message,
          apiKeys: getApiKeys() 
        })
      });
      const data = await response.json();
      
      if (data.error) {
        await appendMessage('model', data.error, true);
      } else {
        const part = { text: data.response, documentData: data.documentData };
        chats[currentChatId].history.push({ role: 'model', parts: [part] });
        await appendMessage('model', data.response, true, data.documentData);
      }

    } catch (err) {
      await appendMessage('model', '⚠️ Maaf, terjadi kesalahan.', true);
    } finally {
      showTyping(false);
    }
  };

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
  });

  newChatBtn.addEventListener('click', startNewChat);

  // --- FILE UPLOAD LOGIC ---
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    // Append API keys to the form data
    const apiKeys = getApiKeys();
    formData.append('apiKeys', JSON.stringify(apiKeys));

    const tempMsgId = `temp-${Date.now()}`;
    appendMessage('model', `Menganalisis file: ${file.name}...`, false);
    const tempMsgElement = chatWindow.lastChild;
    showTyping(true);


    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      // Remove the temporary "uploading" message
      tempMsgElement.remove();

      if (data.success && data.result) {
        appendMessage('model', `✅ ${data.result.note}`, false);
      } else {
        appendMessage('model', `⚠️ Gagal menganalisis file: ${data.error || 'Error tidak diketahui.'}`, false);
      }
    } catch (error) {
      tempMsgElement.remove();
      appendMessage('model', '⚠️ Terjadi kesalahan kritis saat mengunggah file.', false);
      console.error('File upload error:', error);
    } finally {
      showTyping(false);
    }

    // Reset the file input so the same file can be uploaded again
    event.target.value = '';
  };

  fileUpload.addEventListener('change', handleFileUpload);

  // --- INITIALIZATION ---
  const loadInitialData = async () => {
    try {
      const response = await fetch('/api/chat/sessions');
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const data = await response.json();
      chats = data.chats;
      currentChatId = data.currentChatId;
      renderHistoryList();
      renderCurrentChat();

      // Jika tidak ada chat yang aktif, tampilkan pesan selamat datang
      if (!currentChatId) {
        showWelcomeMessage();
      }
      // We no longer auto-start a chat. The user will trigger it.
      setChatInputDisabled(false); // Always enable the input
    } catch (error) {
      console.error('Error loading initial data:', error);
      showWelcomeMessage();
      appendMessage('model', '⚠️ Gagal memuat sesi chat. Periksa koneksi server dan coba muat ulang halaman.', false);
      setChatInputDisabled(true); // Keep disabled on critical error
    }
  };

  loadSettings();
  loadInitialData();

  // Set initial sidebar state for large screens
  if (window.innerWidth > 768) {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
      appContainer.classList.add('sidebar-collapsed');
    }
  }
});
