document.addEventListener('DOMContentLoaded', () => {
  // --- THEME MANAGEMENT ---
  // This is duplicated from ui.js to make the page standalone.
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
  };
  const savedTheme = localStorage.getItem('apip_theme') || 'light';
  applyTheme(savedTheme);

  // --- DOM ELEMENTS ---
  const knowledgeListContainer = document.getElementById('knowledge-list-container');
  const searchInput = document.getElementById('search-input');
  const addKnowledgeBtn = document.getElementById('add-knowledge-btn');
  const modal = document.getElementById('knowledge-modal');
  const modalTitle = document.getElementById('modal-title');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const knowledgeForm = document.getElementById('knowledge-form');
  const knowledgeIdInput = document.getElementById('knowledge-id');
  const knowledgeTopicInput = document.getElementById('knowledge-topic');
  const knowledgeContentInput = document.getElementById('knowledge-content');

  let allKnowledge = []; // To store the full list for searching

  // --- API FUNCTIONS ---
  const fetchKnowledge = async () => {
    try {
      const response = await fetch('/api/knowledge');
      if (!response.ok) throw new Error('Failed to fetch knowledge base.');
      const data = await response.json();
      allKnowledge = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderKnowledgeList(allKnowledge);
    } catch (error) {
      console.error(error);
      knowledgeListContainer.innerHTML = '<p class="empty-history">Gagal memuat data. Silakan coba lagi.</p>';
    }
  };

  const saveKnowledge = async (id, topic, content) => {
    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, topic, content }),
      });
      if (!response.ok) throw new Error('Failed to save knowledge.');
      await response.json();
      closeModal();
      await fetchKnowledge(); // Refresh the list
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan pengetahuan.');
    }
  };

  const deleteKnowledge = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus entri ini?')) return;
    try {
      const response = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete knowledge.');
      await response.json();
      await fetchKnowledge(); // Refresh the list
    } catch (error) {
      console.error(error);
      alert('Gagal menghapus pengetahuan.');
    }
  };

  // --- RENDERING ---
  const renderKnowledgeList = (items) => {
    knowledgeListContainer.innerHTML = '';
    if (items.length === 0) {
      knowledgeListContainer.innerHTML = '<p class="empty-history">Basis pengetahuan masih kosong.</p>';
      return;
    }

    items.forEach(item => {
      const date = new Date(item.createdAt).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
      });

      const itemDiv = document.createElement('div');
      itemDiv.className = 'knowledge-item';
      itemDiv.innerHTML = `
        <h3>${item.topic}</h3>
        <p>${item.text}</p>
        <div class="knowledge-item-footer">
          <span class="knowledge-item-date">Dibuat pada: ${date}</span>
          <div class="knowledge-item-actions">
            <button class="edit-btn" data-id="${item._id}" title="Ubah"><i class="fa-solid fa-pen-to-square"></i></button>
            <button class="delete-btn" data-id="${item._id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;

      // Add event listeners for edit and delete buttons
      itemDiv.querySelector('.edit-btn').addEventListener('click', () => openModalForEdit(item));
      itemDiv.querySelector('.delete-btn').addEventListener('click', () => deleteKnowledge(item._id));

      knowledgeListContainer.appendChild(itemDiv);
    });
  };

  // --- MODAL & FORM HANDLING ---
  const openModalForEdit = (item) => {
    modalTitle.textContent = 'Ubah Pengetahuan';
    knowledgeIdInput.value = item._id;
    knowledgeTopicInput.value = item.topic;
    knowledgeContentInput.value = item.text;
    modal.style.display = 'flex';
  };

  const openModalForAdd = () => {
    modalTitle.textContent = 'Tambah Pengetahuan Baru';
    knowledgeForm.reset();
    knowledgeIdInput.value = '';
    modal.style.display = 'flex';
  };

  const closeModal = () => {
    modal.style.display = 'none';
    knowledgeForm.reset();
  };

  knowledgeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = knowledgeIdInput.value;
    const topic = knowledgeTopicInput.value.trim();
    const content = knowledgeContentInput.value.trim();
    if (topic && content) {
      saveKnowledge(id || null, topic, content);
    }
  });

  // --- EVENT LISTENERS ---
  addKnowledgeBtn.addEventListener('click', openModalForAdd);
  closeModalBtn.addEventListener('click', closeModal);
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredKnowledge = allKnowledge.filter(item => 
      item.topic.toLowerCase().includes(searchTerm)
    );
    renderKnowledgeList(filteredKnowledge);
  });

  // --- INITIALIZATION ---
  fetchKnowledge();
});
