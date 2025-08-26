// Simplified analysis of building types for problematic addresses
import { resolveBuildingData } from '../services/building-info-service';

async function analyzeSimpleBuildingTypes() {
  process.env.LIVE = '1';
  
  // Test addresses that are problematic
  const testAddresses = [
    "Strømsborgveien 42, Oslo",
    "Strømsborgveien 25, Oslo", 
    "Museumsveien 7, Oslo"
  ];
  
  console.log('=== ANALYZING BUILDING TYPES FOR PROBLEMATIC ADDRESSES ===\n');
  
  for (const address of testAddresses) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Address: ${address}`);
    console.log(`${'='.repeat(60)}`);
    
    try {
      // Get result with debug enabled to see what buildings are available
      const result = await resolveBuildingData(address, { 
        useImprovedSelection: true, 
        debug: true 
      });
      
      console.log(`\nSelected building: ${result.bygningsnummer}`);
      
      // Also test without improved selection
      const standardResult = await resolveBuildingData(address, { 
        useImprovedSelection: false, 
        debug: false 
      });
      
      console.log(`Standard selection: ${standardResult.bygningsnummer}`);
      
    } catch (error) {
      console.error('Error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

analyzeSimpleBuildingTypes().catch(console.error);