import type {
  AreaUnit,
  ConstructionQuality,
  StructureType,
  ConcreteGrade,
  SteelGrade,
} from '../db/types';

export interface ParsedVoiceEstimate {
  plotArea?: number;
  plotAreaUnit?: AreaUnit;
  builtUpArea?: number;
  builtUpAreaUnit?: AreaUnit;
  lengthFt?: number;
  widthFt?: number;
  floors?: number;
  buildingType?: string;
  quality?: ConstructionQuality;
  structureType?: StructureType;
  concreteGrade?: ConcreteGrade;
  steelGrade?: SteelGrade;
  includeRiverSand?: boolean;
  transcript: string;
  confidenceNotes: string[];
}

/**
 * Natural language voice query parser for construction site specifications
 */
export function parseVoiceInput(transcript: string): ParsedVoiceEstimate {
  const result: ParsedVoiceEstimate = {
    transcript,
    confidenceNotes: [],
  };

  const text = transcript.toLowerCase();

  // 1. Check Dimensions: e.g. "40 by 30", "length 40 width 30", "40x30", "40 feet by 30 feet"
  const dimMatch = text.match(/(?:length\s*)?(\d+(?:\.\d+)?)\s*(?:feet|ft)?\s*(?:by|x|\*)\s*(?:width\s*)?(\d+(?:\.\d+)?)\s*(?:feet|ft)?/i);
  if (dimMatch) {
    const l = parseFloat(dimMatch[1]);
    const w = parseFloat(dimMatch[2]);
    if (!isNaN(l) && !isNaN(w) && l > 0 && w > 0) {
      result.lengthFt = l;
      result.widthFt = w;
      result.plotArea = Math.round(l * w);
      result.plotAreaUnit = 'sq.ft';
      result.confidenceNotes.push(`Detected dimensions: ${l} ft × ${w} ft = ${result.plotArea} sq.ft`);
    }
  }

  // 2. Area parsing if not already captured by dimensions
  if (!result.plotArea) {
    // Cent: e.g. "3 cent", "3.5 cents", "two cent"
    const centMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cents?)/i);
    if (centMatch) {
      result.plotArea = parseFloat(centMatch[1]);
      result.plotAreaUnit = 'cent';
      result.confidenceNotes.push(`Detected plot area: ${result.plotArea} Cent`);
    } else {
      // Ground: e.g. "1 ground", "1.5 grounds"
      const groundMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:grounds?)/i);
      if (groundMatch) {
        result.plotArea = parseFloat(groundMatch[1]);
        result.plotAreaUnit = 'ground';
        result.confidenceNotes.push(`Detected plot area: ${result.plotArea} Ground`);
      } else {
        // Sq.M: e.g. "150 sq m", "150 square meters"
        const sqmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m(?:eters?|etres?)?|square\s*m(?:eters?|etres?)?)/i);
        if (sqmMatch) {
          result.plotArea = parseFloat(sqmMatch[1]);
          result.plotAreaUnit = 'sq.m';
          result.confidenceNotes.push(`Detected plot area: ${result.plotArea} Sq.M`);
        } else {
          // Sq.Ft: e.g. "1200 sq ft", "1200 square feet", "1200 sqft"
          const sqftMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|square\s*feet|sqft)/i);
          if (sqftMatch) {
            result.plotArea = parseFloat(sqftMatch[1]);
            result.plotAreaUnit = 'sq.ft';
            result.confidenceNotes.push(`Detected plot area: ${result.plotArea} Sq.Ft`);
          }
        }
      }
    }
  }

  // 3. Floors detection: e.g. "G+1", "G plus 1", "G plus one", "ground floor", "3 floors", "two floors"
  if (text.includes('g+3') || text.includes('g plus three') || text.includes('g plus 3') || text.includes('4 floors')) {
    result.floors = 4;
    result.confidenceNotes.push('Detected G+3 (4 Floors)');
  } else if (text.includes('g+2') || text.includes('g plus two') || text.includes('g plus 2') || text.includes('3 floors') || text.includes('three floors')) {
    result.floors = 3;
    result.confidenceNotes.push('Detected G+2 (3 Floors)');
  } else if (text.includes('g+1') || text.includes('g plus one') || text.includes('g plus 1') || text.includes('2 floors') || text.includes('two floors') || text.includes('first floor')) {
    result.floors = 2;
    result.confidenceNotes.push('Detected G+1 (2 Floors)');
  } else if (text.includes('ground floor') || text.includes('single floor') || text.includes('one floor') || text.includes('g+0')) {
    result.floors = 1;
    result.confidenceNotes.push('Detected Ground Floor only (1 Floor)');
  } else {
    const floorNumberMatch = text.match(/(\d+)\s*(?:floors?|storeys?|stories?)/i);
    if (floorNumberMatch) {
      result.floors = parseInt(floorNumberMatch[1], 10);
      result.confidenceNotes.push(`Detected ${result.floors} floors`);
    }
  }

  // 4. Building Type detection
  if (text.includes('villa') || text.includes('independent house') || text.includes('kodu')) {
    result.buildingType = 'Residential Villa';
    result.confidenceNotes.push('Detected Building Type: Residential Villa');
  } else if (text.includes('commercial') || text.includes('shop') || text.includes('office') || text.includes('complex')) {
    result.buildingType = 'Commercial Complex';
    result.confidenceNotes.push('Detected Building Type: Commercial Complex');
  } else if (text.includes('apartment') || text.includes('flat')) {
    result.buildingType = 'Residential Apartment';
    result.confidenceNotes.push('Detected Building Type: Residential Apartment');
  } else if (text.includes('duplex')) {
    result.buildingType = 'Duplex House';
    result.confidenceNotes.push('Detected Building Type: Duplex House');
  } else if (text.includes('residential') || text.includes('house') || text.includes('home') || text.includes('illam') || text.includes('veedu')) {
    result.buildingType = 'Residential Building';
    result.confidenceNotes.push('Detected Building Type: Residential Building');
  }

  // 5. Construction Quality detection
  if (text.includes('premium') || text.includes('luxury') || text.includes('first class') || text.includes('high end')) {
    result.quality = 'Premium';
    result.confidenceNotes.push('Detected Construction Quality: Premium');
  } else if (text.includes('economy') || text.includes('budget') || text.includes('low cost')) {
    result.quality = 'Economy';
    result.confidenceNotes.push('Detected Construction Quality: Economy');
  } else if (text.includes('standard') || text.includes('normal') || text.includes('medium')) {
    result.quality = 'Standard';
    result.confidenceNotes.push('Detected Construction Quality: Standard');
  }

  // 6. Structure Type
  if (text.includes('load bearing') || text.includes('loadbearing')) {
    result.structureType = 'Load Bearing';
    result.confidenceNotes.push('Detected Structure: Load Bearing');
  } else if (text.includes('steel frame') || text.includes('pre-engineered') || text.includes('peb')) {
    result.structureType = 'Steel Frame';
    result.confidenceNotes.push('Detected Structure: Steel Frame');
  } else if (text.includes('composite')) {
    result.structureType = 'Composite';
    result.confidenceNotes.push('Detected Structure: Composite');
  } else if (text.includes('rcc') || text.includes('framed') || text.includes('concrete frame')) {
    result.structureType = 'Framed Structure (RCC)';
    result.confidenceNotes.push('Detected Structure: Framed Structure (RCC)');
  }

  // 7. Concrete Grade
  if (text.includes('m30') || text.includes('m 30')) {
    result.concreteGrade = 'M30';
    result.confidenceNotes.push('Concrete Grade: M30');
  } else if (text.includes('m25') || text.includes('m 25')) {
    result.concreteGrade = 'M25';
    result.confidenceNotes.push('Concrete Grade: M25');
  } else if (text.includes('m20') || text.includes('m 20')) {
    result.concreteGrade = 'M20';
    result.confidenceNotes.push('Concrete Grade: M20');
  } else if (text.includes('m15') || text.includes('m 15')) {
    result.concreteGrade = 'M15';
    result.confidenceNotes.push('Concrete Grade: M15');
  }

  // 8. Steel Grade
  if (text.includes('550') || text.includes('fe550') || text.includes('fe 550')) {
    result.steelGrade = 'Fe550';
    result.confidenceNotes.push('Steel Grade: Fe550');
  } else if (text.includes('500') || text.includes('fe500') || text.includes('fe 500')) {
    result.steelGrade = 'Fe500';
    result.confidenceNotes.push('Steel Grade: Fe500');
  } else if (text.includes('415') || text.includes('fe415') || text.includes('fe 415')) {
    result.steelGrade = 'Fe415';
    result.confidenceNotes.push('Steel Grade: Fe415');
  }

  // 9. River Sand vs 100% M-Sand
  if (text.includes('river sand') || text.includes('screened sand')) {
    result.includeRiverSand = true;
    result.confidenceNotes.push('Include River Sand: Yes (Plastering)');
  } else if (text.includes('only m sand') || text.includes('m-sand only') || text.includes('no river sand') || text.includes('100% m-sand')) {
    result.includeRiverSand = false;
    result.confidenceNotes.push('River Sand: Excluded (100% M-Sand)');
  }

  return result;
}

/**
 * Checks if browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

/**
 * Creates and starts a SpeechRecognition instance with callbacks
 */
export function startVoiceRecognition(options: {
  onResult: (transcript: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}): any {
  if (!isSpeechRecognitionSupported()) {
    options.onError('Speech recognition is not supported in this browser.');
    return null;
  }

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-IN'; // Optimized for Indian English accent & Tamil Nadu civil vocabulary

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    options.onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    options.onError(event.error || 'Voice recognition error.');
  };

  recognition.onend = () => {
    options.onEnd();
  };

  try {
    recognition.start();
    return recognition;
  } catch (err: any) {
    options.onError(err.message || 'Could not start microphone.');
    return null;
  }
}

export interface ParsedVoiceSite {
  name?: string;
  ownerName?: string;
  ownerPhone?: string;
  address?: string;
  area?: string;
  district?: string;
  buildingType?: string;
  notes?: string;
  transcript: string;
  confidenceNotes: string[];
}

/**
 * Natural language voice parser for new Construction Sites
 */
export function parseSiteVoiceInput(transcript: string): ParsedVoiceSite {
  const result: ParsedVoiceSite = {
    transcript,
    confidenceNotes: [],
  };

  const text = transcript.trim();

  // 1. Phone number detection (10 digits)
  const phoneMatch = text.match(/(?:phone|mobile|cell|contact)?\s*([6-9]\d{4}\s*\d{5})/i) ||
                     text.match(/\b([6-9]\d{9})\b/);
  if (phoneMatch) {
    result.ownerPhone = phoneMatch[1].replace(/\s+/g, '');
    result.confidenceNotes.push(`Phone: ${result.ownerPhone}`);
  }

  // 2. Area detection
  const areaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cents?|ground|sq\.?\s*ft|square\s*feet|sqft)/i);
  if (areaMatch) {
    result.area = areaMatch[0];
    result.confidenceNotes.push(`Area: ${result.area}`);
  }

  // 3. Building type detection
  if (/commercial|office|complex|shop|mall/i.test(text)) {
    result.buildingType = 'Commercial';
    result.confidenceNotes.push('Building Type: Commercial');
  } else if (/villa|duplex|bungalow|individual/i.test(text)) {
    result.buildingType = 'Residential Villa (G+1)';
    result.confidenceNotes.push('Building Type: Residential Villa');
  } else if (/apartment|flat/i.test(text)) {
    result.buildingType = 'Apartment';
    result.confidenceNotes.push('Building Type: Apartment');
  } else if (/industrial|factory|warehouse|shed/i.test(text)) {
    result.buildingType = 'Industrial';
    result.confidenceNotes.push('Building Type: Industrial');
  } else if (/residential|house|veedu|illam/i.test(text)) {
    result.buildingType = 'Residential';
    result.confidenceNotes.push('Building Type: Residential');
  }

  // 4. District / Location
  const districts = [
    'Chennai', 'Tambaram', 'Chengalpattu', 'Kanchipuram', 'Tiruvallur', 'Coimbatore',
    'Madurai', 'Trichy', 'Salem', 'Tirunelveli', 'Erode', 'Vellore', 'Thanjavur',
    'Dindigul', 'Theni', 'Karur', 'Namakkal', 'Tiruppur', 'Cuddalore', 'Villupuram'
  ];
  for (const d of districts) {
    if (new RegExp(`\\b${d}\\b`, 'i').test(text)) {
      result.district = d;
      result.address = d;
      result.confidenceNotes.push(`Location: ${d}`);
      break;
    }
  }

  // 5. Owner name extraction
  const ownerMatch = text.match(/(?:owner|client|party)\s+(?:name\s+is\s+|is\s+|is\s+called\s+|)?([a-zA-Z\s.]+?)(?=\s+(?:phone|mobile|site|area|building|at|in|,|\.|$))/i);
  if (ownerMatch && ownerMatch[1].trim().length > 1) {
    result.ownerName = ownerMatch[1].trim();
    result.confidenceNotes.push(`Owner: ${result.ownerName}`);
  }

  // 6. Site name extraction
  const siteMatch = text.match(/(?:site\s+(?:name\s+is\s+|is\s+|called\s+)?|project\s+)([a-zA-Z0-9\s.]+?)(?=\s+(?:owner|client|phone|area|at|in|,|\.|$))/i);
  if (siteMatch && siteMatch[1].trim().length > 1) {
    result.name = siteMatch[1].trim();
    result.confidenceNotes.push(`Site Name: ${result.name}`);
  } else if (!result.name && result.ownerName) {
    result.name = `${result.ownerName} Residence`;
  }

  return result;
}

