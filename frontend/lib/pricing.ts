export type HouseInput = {
  area_sqft: number;
  bedrooms: number;
  bathrooms: number;
  property_age: number;
  parking_slots: number;
  floor_number: number;
  near_metro: number;
  balconies: number;
  location: string;
  furnishing: string;
  quality_grade: string;
};

export type PredictedRow = HouseInput & {
  source_id: string;
  predicted_price: number;
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function predictPrice(input: HouseInput, rules: any) {
  const base = input.area_sqft * rules.baseRatePerSqft * rules.locationMultiplier[input.location];
  const furnishing = rules.furnishingBonus[input.furnishing] ?? 0;
  const quality = rules.qualityBonus[input.quality_grade] ?? 0;
  const metro = input.near_metro ? rules.metroBonus : 0;
  const parking = input.parking_slots * rules.parkingBonus;
  const bathrooms = input.bathrooms * rules.bathroomBonus;
  const balconies = input.balconies * rules.balconyBonus;
  const floorPremium = input.floor_number >= 5 && input.floor_number <= 15 ? rules.floorPremium : rules.floorPremium * .55;
  const agePenalty = input.property_age * rules.agePenalty;
  return Math.max(1800000, base + furnishing + quality + metro + parking + bathrooms + balconies + floorPremium - agePenalty);
}

export function explainPrediction(input: HouseInput, rules: any) {
  return [
    { factor: 'Location premium', effect: input.area_sqft * rules.baseRatePerSqft * (rules.locationMultiplier[input.location] - 1) },
    { factor: 'Area contribution', effect: input.area_sqft * rules.baseRatePerSqft },
    { factor: 'Quality grade', effect: rules.qualityBonus[input.quality_grade] ?? 0 },
    { factor: 'Furnishing', effect: rules.furnishingBonus[input.furnishing] ?? 0 },
    { factor: 'Metro access', effect: input.near_metro ? rules.metroBonus : 0 },
    { factor: 'Parking slots', effect: input.parking_slots * rules.parkingBonus },
    { factor: 'Property age discount', effect: -input.property_age * rules.agePenalty },
  ].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

export function recommendation(input: HouseInput) {
  const tips: string[] = [];
  if (input.property_age > 12) tips.push('Renovation positioning is important because age is reducing the valuation.');
  if (!input.near_metro) tips.push('Metro/connectivity improvement can increase perceived buyer value.');
  if (input.parking_slots < 1) tips.push('Parking availability is a strong improvement area for resale appeal.');
  if (input.furnishing !== 'Fully Furnished') tips.push('Furnishing upgrade can improve valuation and rental readiness.');
  if (input.quality_grade === 'Standard') tips.push('Quality upgrade has high ROI potential in this valuation model.');
  if (!tips.length) tips.push('This property profile is strong: good quality, connectivity, and amenities support premium pricing.');
  return tips;
}

export function mapCsvRowToHouseInput(row: Record<string, unknown>, fallback: HouseInput): HouseInput {
  // Supports both this project schema and Ames/Kaggle-style fields.
  const grLivArea = safeNumber(row.GrLivArea, 0);
  const firstFloor = safeNumber(row['1stFlrSF'], 0);
  const secondFloor = safeNumber(row['2ndFlrSF'], 0);
  const area = safeNumber(row.area_sqft, grLivArea || firstFloor + secondFloor || safeNumber(row.LotArea, fallback.area_sqft));
  const fullBath = safeNumber(row.FullBath, 0);
  const halfBath = safeNumber(row.HalfBath, 0);
  const bathrooms = safeNumber(row.bathrooms, fullBath + halfBath * 0.5 || fallback.bathrooms);
  const builtYear = safeNumber(row.YearBuilt, 0);
  const soldYear = safeNumber(row.YrSold, 2026);
  const overallQual = safeNumber(row.OverallQual, 0);
  const neighborhood = String(row.Neighborhood || row.location || fallback.location);
  const quality = String(row.quality_grade || (overallQual >= 8 ? 'Luxury' : overallQual >= 6 ? 'Premium' : overallQual >= 4 ? 'Good' : 'Standard'));
  const furnishing = String(row.furnishing || (String(row.KitchenQual || '').match(/Ex|Gd/) ? 'Fully Furnished' : 'Semi-Furnished'));
  const location = String(row.location || (neighborhood.match(/NridgHt|NoRidge|StoneBr|Veenker/) ? 'Premium Central' : neighborhood.match(/Somerst|CollgCr|Crawfor|Timber/) ? 'IT Hub' : neighborhood.match(/NAmes|Sawyer|Gilbert/) ? 'Family Zone' : neighborhood.match(/Edwards|OldTown|BrkSide/) ? 'Developing Zone' : 'Budget Zone'));
  return {
    area_sqft: Math.round(area),
    bedrooms: safeNumber(row.bedrooms, safeNumber(row.BedroomAbvGr, fallback.bedrooms)),
    bathrooms,
    property_age: safeNumber(row.property_age, builtYear ? Math.max(0, soldYear - builtYear) : fallback.property_age),
    parking_slots: safeNumber(row.parking_slots, safeNumber(row.GarageCars, fallback.parking_slots)),
    floor_number: safeNumber(row.floor_number, fallback.floor_number),
    near_metro: safeNumber(row.near_metro, fallback.near_metro),
    balconies: safeNumber(row.balconies, fallback.balconies),
    location,
    furnishing,
    quality_grade: quality,
  };
}

export function summarizePredictions(rows: PredictedRow[]) {
  if (!rows.length) return null;
  const prices = rows.map(r => r.predicted_price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const premiumCount = rows.filter(r => r.predicted_price >= avg * 1.15).length;
  return { count: rows.length, avg, min, max, premiumCount };
}
