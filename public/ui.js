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

  // Settings modal has been removed as keys are now server-side.

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
    // Disabled for debugging
    historyList.innerHTML = '<p class="empty-history">Riwayat dinonaktifkan untuk tes.</p>';
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
    // Disabled for debugging
    chatWindow.innerHTML = '';
    showWelcomeMessage();
    return 'temp-chat';
  };

  const switchChat = async (chatId) => { /* Disabled for debugging */ };

  const renameChat = async (chatId) => { /* Disabled for debugging */ };

  const deleteChat = async (chatId) => { /* Disabled for debugging */ };

  const showTyping = (isTyping) => {
    typingIndicator.style.display = isTyping ? 'flex' : 'none';
  };

  const sendMessage = async () => {
    const message = userInput.value.trim();
    if (!message) return;

    const welcomeMessage = chatWindow.querySelector('.welcome-message');
    if (welcomeMessage) {
      chatWindow.innerHTML = '';
    }

    appendMessage('user', message, false);
    userInput.value = '';
    showTyping(true);

    // No history is saved on the client for this test
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      
      if (data.error) {
        await appendMessage('model', data.error, true);
      } else {
        // No history is saved on the client for this test
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
  const initializeApp = () => {
    // In this debug version, we just show the welcome message and enable the input.
    showWelcomeMessage();
    renderHistoryList(); // Will show the disabled message
    setChatInputDisabled(false);
    currentChatId = 'temp-chat'; // Set a dummy ID to allow sending messages
  };

  initializeApp();

  // Set initial sidebar state for large screens
  if (window.innerWidth > 768) {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
      appContainer.classList.add('sidebar-collapsed');
    }
  }
});
