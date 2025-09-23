const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const port = 3002;

const infoLog = (...args) => console.warn('[legacy-api]', ...args);
const errorLog = (...args) => console.error('[legacy-api:error]', ...args);

app.use(cors());
app.use(express.json());

// Endpoint for å hente støtteordninger
app.get('/api/stotteordninger', (req, res) => {
  const { gulliste, tiltak, bygningstype } = req.query;
  
  if (!tiltak || !bygningstype) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  const gullisteParam = gulliste === 'true' ? 'true' : 'false';
  
  exec(`python hent_stotteordninger_api_google.py ${gullisteParam} ${tiltak} ${bygningstype}`, (error, stdout, stderr) => {
    if (error) {
      errorLog('Python script feilet', error);
      return res.status(500).json({ error: error.message });
    }

    if (stderr) {
      errorLog('Python script stderr', stderr);
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (parseError) {
      errorLog('Kunne ikke parse Python-output', parseError);
      res.status(500).json({ error: 'Failed to parse Python output' });
    }
  });
});

// Endpoint for å hente alle støtteordninger
app.get('/api/alle-stotteordninger', (req, res) => {
  const { bygningstype } = req.query;
  
  if (!bygningstype) {
    return res.status(400).json({ error: 'Missing bygningstype parameter' });
  }
  
  exec(`python hent_alle_stotteordninger_api_google.py ${bygningstype}`, (error, stdout, stderr) => {
    if (error) {
      errorLog('Python script feilet', error);
      return res.status(500).json({ error: error.message });
    }

    if (stderr) {
      errorLog('Python script stderr', stderr);
    }

    try {
      const result = JSON.parse(stdout);
      res.json(result);
    } catch (parseError) {
      errorLog('Kunne ikke parse Python-output', parseError);
      res.status(500).json({ error: 'Failed to parse Python output' });
    }
  });
});

app.listen(port, () => {
  infoLog(`API server lytter på http://localhost:${port}`);
});
