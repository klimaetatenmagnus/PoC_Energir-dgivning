// Simple Express server to expose resolveBuildingData as API
import express from 'express';
import cors from 'cors';
import { resolveBuildingData } from '../services/building-info-service/index.js';
import '../loadEnv.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Address lookup endpoint
app.post('/api/address-lookup', async (req, res) => {
  const { address } = req.body;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ 
      error: 'Address is required and must be a string' 
    });
  }

  console.log(`[API Server] Looking up address: ${address}`);
  const startTime = Date.now();

  try {
    const result = await resolveBuildingData(address);
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

// Start server
app.listen(PORT, () => {
  console.log(`[API Server] Running on http://localhost:${PORT}`);
  console.log(`[API Server] Environment: ${process.env.LIVE ? 'LIVE (real APIs)' : 'MOCK'}`);
  console.log(`[API Server] Try: POST http://localhost:${PORT}/api/address-lookup`);
});