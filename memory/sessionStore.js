let session = {
  lastFileName: null,
  lastFileContent: null,
  history: []
};

function updateFile(fileName, content) {
  session.lastFileName = fileName;
  session.lastFileContent = content;
  session.history.push({
    role: 'aura',
    content: `File "${fileName}" sudah dianalisis dan siap digunakan.`
  });
}

function resetSession() {
  session = {
    lastFileName: null,
    lastFileContent: null,
    history: []
  };
}

function get() {
  return session;
}

module.exports = {
  updateFile,
  resetSession,
  get
};