const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from src
app.use(express.static(path.join(__dirname, '../src')));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/index.html'));
});

app.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
