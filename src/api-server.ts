// Simple Express server to expose resolveBuildingData as API
import '../loadEnv.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { resolveBuildingData } from '../services/building-info-service/index.js';
import { energyRatingService } from './services/energyRatingService.js';
import { csvService } from './services/csvService.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Address lookup endpoint
app.post('/api/address-lookup', async (req, res) => {
  const { address, useImprovedSelection = false, debug = false } = req.body;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      error: 'Address is required and must be a string' 
    });
  }

  console.log(`[API Server] Looking up address: ${address}`);
  if (useImprovedSelection) {
    console.log(`[API Server] Using improved building selection`);
  }
  const startTime = Date.now();

  try {
    const result = await resolveBuildingData(address, { useImprovedSelection, debug });
    const duration = Date.now() - startTime;
    
    console.log(`[API Server] Lookup successful in ${duration}ms`);
    res.json({
      ...result,
      adresse: address,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Lookup failed after ${duration}ms:`, error);
    
    // Handle authentication errors specially
    if (error instanceof Error && error.message.includes('401')) {
      res.status(503).json({ 
        error: 'Matrikkel API authentication failed. Using test data instead.',
        address,
        testMode: true,
        _meta: {
          duration,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        address,
        _meta: {
          duration,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
});

// Address suggestions endpoint
app.get('/api/address-suggestions', async (req, res) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string' || query.length < 3) {
    return res.status(400).json({ 
      error: 'Query must be at least 3 characters long' 
    });
  }

  console.log(`[API Server] Fetching address suggestions for: ${query}`);
  const startTime = Date.now();

  try {
    // Call Geonorge API with fuzzy search
    const response = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?` +
      new URLSearchParams({ 
        sok: query, 
        fuzzy: 'true',
        kommunenummer: '0301' // Oslo kommune
      }).toString().replace(/\+/g, '%20'),
      { headers: { 'User-Agent': 'Energitiltak/1.0' } }
    );

    if (!response.ok) {
      throw new Error(`Geonorge API returned ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;
    
    // Format addresses for frontend - ensure we have complete address with postal code and city
    const suggestions = data.adresser?.map((addr: any) => {
      // Build complete address string
      const streetAndNumber = `${addr.adressenavn} ${addr.nummer}${addr.bokstav || ''}`;
      const postalAndCity = `${addr.postnummer || ''} ${addr.poststed || 'Oslo'}`.trim();
      
      return {
        adressetekst: addr.adressetekst || `${streetAndNumber}, ${postalAndCity}`,
        adresse: `${streetAndNumber}, ${postalAndCity}`,
        kommunenummer: addr.kommunenummer,
        gardsnummer: addr.gardsnummer,
        bruksnummer: addr.bruksnummer,
        adressekode: addr.adressekode,
        nummer: addr.nummer,
        bokstav: addr.bokstav || null,
        postnummer: addr.postnummer,
        poststed: addr.poststed || 'Oslo'
      };
    }) || [];

    console.log(`[API Server] Found ${suggestions.length} suggestions in ${duration}ms`);
    res.json({
      suggestions,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Address suggestions failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      query,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Energy rating calculation endpoint
app.post('/api/energy-rating', async (req, res) => {
  const { address, yearlyConsumption } = req.body;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      error: 'Address is required and must be a string' 
    });
  }
  
  if (!yearlyConsumption || typeof yearlyConsumption !== 'number' || yearlyConsumption <= 0) {
    return res.status(400).json({ 
      error: 'Yearly consumption is required and must be a positive number' 
    });
  }

  console.log(`[API Server] Calculating energy rating for: ${address}, consumption: ${yearlyConsumption} kWh/year`);
  const startTime = Date.now();

  try {
    // First, get building data to find BRA
    const buildingData = await resolveBuildingData(address, { useImprovedSelection: true });
    
    if (!buildingData || buildingData.length === 0) {
      throw new Error('No building data found for address');
    }

    // Use the first building result
    const building = buildingData[0];
    const bruksareal = building.bruksarealM2;

    if (!bruksareal || bruksareal <= 0) {
      throw new Error('Invalid or missing BRA (bruksareal) for building');
    }

    // Calculate energy rating
    const ratingResult = energyRatingService.calculateEnergyRating({
      yearlyConsumption,
      bruksareal
    });

    const duration = Date.now() - startTime;
    
    console.log(`[API Server] Energy rating calculated in ${duration}ms: ${ratingResult.rating}`);
    res.json({
      address,
      bygningsnummer: building.bygningsnummer,
      bruksareal,
      yearlyConsumption,
      ...ratingResult,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Energy rating calculation failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      address,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Støtteordninger endpoint - kjører Python script direkte
app.get('/api/stotteordninger', async (req, res) => {
  const { gulliste, tiltak, bygningstype } = req.query;
  
  if (!tiltak || !bygningstype) {
    return res.status(400).json({ 
      error: 'Missing required parameters: tiltak and bygningstype' 
    });
  }

  const gullisteParam = gulliste === 'true' ? 'true' : 'false';
  
  console.log(`[API Server] Fetching støtteordninger: gulliste=${gullisteParam}, tiltak=${tiltak}, bygningstype=${bygningstype}`);
  const startTime = Date.now();

  try {
    // Kjør Python script med UTF-8 encoding
    const { stdout, stderr } = await execAsync(
      `python hent_stotteordninger_api.py ${gullisteParam} ${tiltak} ${bygningstype}`,
      { encoding: 'utf8' }
    );
    
    if (stderr) {
      console.error('[API Server] Python stderr:', stderr);
    }
    
    // Parse JSON output
    const data = JSON.parse(stdout);
    const duration = Date.now() - startTime;
    
    console.log(`[API Server] Found ${Array.isArray(data) ? data.length : 0} støtteordninger in ${duration}ms`);
    res.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Støtteordninger fetch failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get støtteordninger directly from Excel
app.get('/api/stotteordninger-live', async (req, res) => {
  const { gulliste, tiltak, bygningstype } = req.query;
  
  if (!tiltak || !bygningstype) {
    return res.status(400).json({ 
      error: 'Mangler påkrevde parametre: tiltak og bygningstype' 
    });
  }
  
  console.log(`[API Server] Henter støtteordninger direkte fra Excel: gulliste=${gulliste}, tiltak=${tiltak}, bygningstype=${bygningstype}`);
  const startTime = Date.now();
  
  try {
    const { stdout, stderr } = await execAsync(
      `python hent_stotteordninger_direkte.py ${gulliste || 'false'} "${tiltak}" "${bygningstype}"`,
      { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
    );
    
    if (stderr) {
      console.error('[API Server] Python stderr:', stderr);
    }
    
    const data = JSON.parse(stdout);
    const duration = Date.now() - startTime;
    
    console.log(`[API Server] Hentet støtteordninger direkte i ${duration}ms`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(data);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Direkte henting feilet etter ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Update støtteordninger cache endpoint
app.post('/api/update-stotteordninger', async (req, res) => {
  console.log('[API Server] Updating støtteordninger cache...');
  const startTime = Date.now();
  
  try {
    // Run the Python script to update cache
    const { stdout, stderr } = await execAsync(
      'python stotteordning_cache.py',
      { encoding: 'utf8' }
    );
    
    if (stderr) {
      console.error('[API Server] Python stderr:', stderr);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[API Server] Støtteordninger cache updated in ${duration}ms`);
    
    res.json({
      success: true,
      message: 'Støtteordninger cache updated successfully',
      output: stdout,
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API Server] Cache update failed after ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      _meta: {
        duration,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[API Server] Running on http://localhost:${PORT}`);
  console.log(`[API Server] Environment: ${process.env.LIVE ? 'LIVE (real APIs)' : 'MOCK'}`);
  console.log(`[API Server] Try: POST http://localhost:${PORT}/api/address-lookup`);
  console.log(`[API Server] Try: GET http://localhost:${PORT}/api/address-suggestions?query=karl`);
  console.log(`[API Server] Try: POST http://localhost:${PORT}/api/energy-rating`);
});