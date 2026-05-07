'use client';

import reportJson from '../data/model-report.json';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Brain,
  Calculator,
  Database,
  FileUp,
  Gauge,
  Landmark,
  LineChart,
  PieChart as PieIcon,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards
} from 'lucide-react';
import Papa from 'papaparse';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import {
  explainPrediction,
  formatINR,
  HouseInput,
  mapCsvRowToHouseInput,
  predictPrice,
  recommendation,
  summarizePredictions,
  PredictedRow
} from '../lib/pricing';

const report: any = reportJson;
const locations = ['Budget Zone', 'Developing Zone', 'Family Zone', 'IT Hub', 'Premium Central'];
const furnishing = ['Unfurnished', 'Semi-Furnished', 'Fully Furnished'];
const quality = ['Standard', 'Good', 'Premium', 'Luxury'];
const chartColors = ['#14B8A6', '#3B82F6', '#EC4899', '#F97316', '#A855F7', '#22C55E', '#F59E0B', '#06B6D4', '#FB7185'];

type Tab = 'predict' | 'investment' | 'loaded' | 'upload' | 'models';

type MetricCardProps = {
  title: string;
  value: string;
  note: string;
  icon?: React.ReactNode;
  tone?: string;
};

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`light-card rounded-[2rem] p-5 md:p-6 ${className}`}>{children}</div>;
}

function MiniCard({ title, value, note, icon, tone = 'from-white via-sky-50 to-emerald-50' }: MetricCardProps) {
  return (
    <div className={`soft-card rounded-3xl bg-gradient-to-br ${tone} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">{value}</h3>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        {icon && <div className="rounded-2xl bg-white/70 p-2 text-slate-700 shadow-sm">{icon}</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-semibold text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon && <div className="rounded-2xl bg-white/70 p-2 shadow-sm">{icon}</div>}
      <div>
        <h2 className="text-xl font-black text-slate-900 md:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function PredictionSummary({ rows }: { rows: PredictedRow[] }) {
  const summary = summarizePredictions(rows);
  if (!summary) return <p className="text-sm text-slate-500">No rows loaded yet.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <MiniCard title="Rows predicted" value={String(summary.count)} note="CSV / loaded dataset" icon={<Database size={20} />} />
      <MiniCard title="Average price" value={formatINR(summary.avg)} note="portfolio valuation" icon={<Banknote size={20} />} tone="from-white via-emerald-50 to-teal-50" />
      <MiniCard title="Lowest price" value={formatINR(summary.min)} note="budget opportunity" icon={<Target size={20} />} tone="from-white via-orange-50 to-yellow-50" />
      <MiniCard title="Highest price" value={formatINR(summary.max)} note="premium property" icon={<Sparkles size={20} />} tone="from-white via-pink-50 to-rose-50" />
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Home() {
  const [input, setInput] = useState<HouseInput>(report.defaultInput as HouseInput);
  const [activeTab, setActiveTab] = useState<Tab>('predict');
  const [loadedRows, setLoadedRows] = useState<PredictedRow[]>([]);
  const [uploadedRows, setUploadedRows] = useState<PredictedRow[]>([]);

  const price = useMemo(() => predictPrice(input, report.pricingRules), [input]);
  const basePrice = useMemo(() => predictPrice(report.defaultInput as HouseInput, report.pricingRules), []);
  const explanations = useMemo(() => explainPrediction(input, report.pricingRules), [input]);
  const tips = useMemo(() => recommendation(input), [input]);

  const whatIfArea = useMemo(() => predictPrice({ ...input, area_sqft: Math.round(input.area_sqft * 1.1) }, report.pricingRules), [input]);
  const whatIfUpgrade = useMemo(() => predictPrice({ ...input, quality_grade: 'Premium', furnishing: 'Fully Furnished' }, report.pricingRules), [input]);
  const whatIfMetro = useMemo(() => predictPrice({ ...input, near_metro: 1 }, report.pricingRules), [input]);
  const whatIfParking = useMemo(() => predictPrice({ ...input, parking_slots: Math.max(input.parking_slots, 2) }, report.pricingRules), [input]);
  const whatIfRenovated = useMemo(() => predictPrice({ ...input, property_age: Math.max(0, input.property_age - 5), quality_grade: 'Premium' }, report.pricingRules), [input]);
  const whatIfBudget = useMemo(() => predictPrice({ ...input, location: 'Developing Zone', furnishing: 'Semi-Furnished' }, report.pricingRules), [input]);

  const locationPie = useMemo(() => report.locationSummary.map((x: any) => ({ name: x.location, value: Math.round(x.price_inr) })), []);
  const qualityPie = useMemo(() => report.qualitySummary.map((x: any) => ({ name: x.quality_grade, value: Math.round(x.price_inr) })), []);

  const investmentScore = useMemo(() => {
    const locScore = locations.indexOf(String(input.location)) + 1;
    const qualityScore = quality.indexOf(String(input.quality_grade)) + 1;
    const furnishScore = furnishing.indexOf(String(input.furnishing)) + 1;
    const score = locScore * 1.45 + qualityScore * 1.25 + furnishScore * 0.7 + input.near_metro * 1.2 + input.parking_slots * 0.45 - input.property_age * 0.05;
    return clamp(Number(score.toFixed(1)), 2.5, 10);
  }, [input]);

  const riskScore = useMemo(() => {
    const ageRisk = input.property_age > 20 ? 26 : input.property_age > 10 ? 16 : 7;
    const locRisk = input.location === 'Budget Zone' ? 20 : input.location === 'Developing Zone' ? 14 : 8;
    const accessRisk = input.near_metro ? -8 : 8;
    const qualityRisk = input.quality_grade === 'Standard' ? 16 : input.quality_grade === 'Good' ? 8 : -4;
    return clamp(ageRisk + locRisk + accessRisk + qualityRisk + 20, 8, 92);
  }, [input]);

  const riskLabel = riskScore < 35 ? 'Low Risk' : riskScore < 65 ? 'Moderate Risk' : 'High Risk';
  const riskColor = riskScore < 35 ? '#22C55E' : riskScore < 65 ? '#F59E0B' : '#EF4444';

  const expectedFiveYearValue = useMemo(() => {
    const annualGrowth = 0.055 + (investmentScore / 100) + (input.near_metro ? 0.008 : 0) - (riskScore / 1000);
    return Math.round(price * Math.pow(1 + annualGrowth, 5));
  }, [price, investmentScore, input.near_metro, riskScore]);

  const rentalYield = useMemo(() => clamp(2.8 + investmentScore * 0.25 + (input.location === 'IT Hub' ? 0.8 : 0) - input.property_age * 0.02, 2.2, 7.5), [investmentScore, input]);
  const monthlyRent = useMemo(() => Math.round((price * rentalYield) / 100 / 12), [price, rentalYield]);
  const emi = useMemo(() => {
    const principal = price * 0.8;
    const annualRate = 8.5;
    const monthlyRate = annualRate / 12 / 100;
    const months = 20 * 12;
    return Math.round((principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1));
  }, [price]);

  const affordabilityRatio = useMemo(() => Math.round((monthlyRent / emi) * 100), [monthlyRent, emi]);
  const set = (key: keyof HouseInput, value: string | number) => setInput(prev => ({ ...prev, [key]: value }));

  const trendData = useMemo(() => {
    const start = Math.round(price * 0.92);
    return Array.from({ length: 6 }, (_, i) => ({
      year: `Y${i}`,
      projected: Math.round(start * Math.pow(1.045 + investmentScore / 250, i)),
      conservative: Math.round(start * Math.pow(1.035, i))
    }));
  }, [price, investmentScore]);

  const locationIntelligence = useMemo(() => [
    { metric: 'Connectivity', score: input.near_metro ? 92 : 62 },
    { metric: 'Resale', score: clamp(Math.round(investmentScore * 9), 35, 96) },
    { metric: 'Lifestyle', score: input.location === 'Premium Central' ? 94 : input.location === 'IT Hub' ? 88 : input.location === 'Family Zone' ? 78 : 62 },
    { metric: 'Affordability', score: clamp(100 - Math.round(price / 250000), 35, 92) },
    { metric: 'Rental Demand', score: input.location === 'IT Hub' ? 95 : input.near_metro ? 82 : 64 }
  ], [input, investmentScore, price]);

  const propertyCompare = useMemo(() => {
    const propertyA = { name: 'Selected Property', value: price, roi: investmentScore, risk: 100 - riskScore };
    const propertyBInput = { ...input, location: 'Family Zone', quality_grade: 'Good', furnishing: 'Semi-Furnished', property_age: 8 } as HouseInput;
    const propertyBPrice = predictPrice(propertyBInput, report.pricingRules);
    const propertyB = { name: 'Benchmark Property', value: propertyBPrice, roi: 7.4, risk: 68 };
    return [propertyA, propertyB];
  }, [input, price, investmentScore, riskScore]);

  const riskDistribution = useMemo(() => [
    { name: 'Age Risk', value: input.property_age > 15 ? 35 : 18 },
    { name: 'Location Risk', value: input.location === 'Budget Zone' ? 30 : 14 },
    { name: 'Liquidity Risk', value: input.near_metro ? 12 : 25 },
    { name: 'Upgrade Risk', value: input.quality_grade === 'Standard' ? 28 : 14 }
  ], [input]);

  const listedPrice = useMemo(() => Math.round(price * (1.04 + riskScore / 900)), [price, riskScore]);
  const priceGap = useMemo(() => listedPrice - price, [listedPrice, price]);
  const pricingStatus = useMemo(() => {
    const gapPercent = (priceGap / price) * 100;
    if (gapPercent > 8) return { label: 'Overpriced', color: 'text-rose-600', bg: 'bg-rose-50', note: 'Listed price is noticeably above the model valuation.' };
    if (gapPercent < -5) return { label: 'Undervalued', color: 'text-emerald-600', bg: 'bg-emerald-50', note: 'Property appears cheaper than the model valuation.' };
    return { label: 'Fairly Priced', color: 'text-blue-600', bg: 'bg-sky-50', note: 'Listed price is close to the model valuation.' };
  }, [priceGap, price]);

  const buyerSuitability = useMemo(() => {
    const family = clamp(55 + input.bedrooms * 7 + input.bathrooms * 4 + (input.location === 'Family Zone' ? 18 : 0) + (input.near_metro ? 6 : 0), 35, 98);
    const investor = clamp(45 + investmentScore * 5 + rentalYield * 4 - riskScore * 0.25, 30, 98);
    const rental = clamp(42 + rentalYield * 8 + (input.location === 'IT Hub' ? 18 : 0) + (input.near_metro ? 10 : 0), 30, 98);
    const luxuryBuyer = clamp(35 + (input.quality_grade === 'Luxury' ? 30 : input.quality_grade === 'Premium' ? 20 : 8) + (input.furnishing === 'Fully Furnished' ? 16 : 6) + (input.location === 'Premium Central' ? 20 : 0), 25, 98);
    return [
      { persona: 'Family Buyer', score: Math.round(family) },
      { persona: 'Investor', score: Math.round(investor) },
      { persona: 'Rental Income', score: Math.round(rental) },
      { persona: 'Luxury Buyer', score: Math.round(luxuryBuyer) }
    ];
  }, [input, investmentScore, rentalYield, riskScore]);

  const topBuyer = useMemo(() => buyerSuitability.reduce((best, item) => item.score > best.score ? item : best, buyerSuitability[0]), [buyerSuitability]);

  const scenarioCards = [
    { title: 'Area +10%', value: whatIfArea, delta: whatIfArea - price, tone: 'bg-sky-50 text-blue-700' },
    { title: 'Premium + Furnished', value: whatIfUpgrade, delta: whatIfUpgrade - price, tone: 'bg-pink-50 text-pink-700' },
    { title: 'Metro Access Enabled', value: whatIfMetro, delta: whatIfMetro - price, tone: 'bg-emerald-50 text-emerald-700' },
    { title: '2 Parking Slots', value: whatIfParking, delta: whatIfParking - price, tone: 'bg-orange-50 text-orange-700' },
    { title: 'Renovated + Premium', value: whatIfRenovated, delta: whatIfRenovated - price, tone: 'bg-violet-50 text-violet-700' },
    { title: 'Budget Alternative', value: whatIfBudget, delta: whatIfBudget - price, tone: 'bg-yellow-50 text-yellow-700' }
  ];

  useEffect(() => {
    fetch('/data/synthetic_housing_data.csv')
      .then(res => res.text())
      .then(text => {
        const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
        const mapped = parsed.data.slice(0, 120).map((row, index) => {
          const house = mapCsvRowToHouseInput(row, report.defaultInput as HouseInput);
          return { ...house, source_id: `Loaded-${index + 1}`, predicted_price: predictPrice(house, report.pricingRules) };
        });
        setLoadedRows(mapped);
      });
  }, []);

  function handleUpload(file: File | null) {
    if (!file) return;
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const mapped = result.data.slice(0, 300).map((row, index) => {
          const house = mapCsvRowToHouseInput(row, report.defaultInput as HouseInput);
          return { ...house, source_id: `Upload-${index + 1}`, predicted_price: predictPrice(house, report.pricingRules) };
        });
        setUploadedRows(mapped);
        setActiveTab('upload');
      }
    });
  }

  return (
    <main className="min-h-screen bg-premium p-4 md:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <Card className="relative overflow-hidden">
            <div className="absolute -right-8 -top-8 rounded-full bg-gradient-to-br from-sky-200 via-pink-200 to-orange-200 p-10 opacity-60 blur-2xl"><Building2 size={130} /></div>
            <div className="badge inline-flex items-center gap-2 text-teal-700"><Sparkles size={16}/> Premium Real Estate ML SaaS</div>
            <h1 className="gradient-title mt-5 text-4xl font-black tracking-tight md:text-6xl">{report.project}</h1>
            <p className="mt-3 max-w-3xl text-lg text-slate-600">{report.subtitle}. Predict prices, compare regression models, explain value drivers, simulate upgrades, upload CSV files, and generate business recommendations.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
              <span className="badge">Next.js + Tailwind</span><span className="badge">Regression Modeling</span><span className="badge">CSV Upload</span><span className="badge">What-if Simulator</span><span className="badge">ROI + EMI Intelligence</span>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-white/90 via-sky-50/90 to-emerald-50/90">
            <p className="text-slate-500">Best regression model</p>
            <h2 className="mt-2 text-3xl font-black text-blue-700">{report.bestModel}</h2>
            <p className="mt-4 text-slate-500">Current real-time valuation</p>
            <div className="mt-2 text-4xl font-black text-emerald-600">{formatINR(price)}</div>
            <p className="mt-3 text-sm font-medium text-slate-500">Change vs default: {formatINR(price - basePrice)}</p>
          </Card>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniCard title="Investment Score" value={`${investmentScore}/10`} note="location + quality + liquidity" icon={<Gauge size={20} />} tone="from-white via-emerald-50 to-teal-50" />
          <MiniCard title="Risk Level" value={riskLabel} note={`${riskScore}/100 risk score`} icon={<ShieldCheck size={20} />} tone="from-white via-orange-50 to-yellow-50" />
          <MiniCard title="5-Year Value" value={formatINR(expectedFiveYearValue)} note="projected appreciation" icon={<TrendingUp size={20} />} tone="from-white via-pink-50 to-rose-50" />
          <MiniCard title="Rental Yield" value={`${rentalYield.toFixed(1)}%`} note={`${formatINR(monthlyRent)} estimated monthly rent`} icon={<WalletCards size={20} />} tone="from-white via-sky-50 to-blue-50" />
        </div>

        <Card>
          <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-3 rounded-[2rem] bg-white/55 p-2 shadow-inner">
            {([
              ['predict', Calculator, 'Live Prediction'],
              ['investment', WalletCards, 'Investment Tools'],
              ['loaded', Database, 'Loaded Dataset'],
              ['upload', FileUp, 'Upload CSV'],
              ['models', LineChart, 'Model Analytics']
            ] as const).map(([key, Icon, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`tab-btn ${activeTab === key ? 'tab-active' : ''}`}>
                <Icon size={17}/><span>{label}</span>
              </button>
            ))}
          </div>
        </Card>

        {activeTab === 'predict' && (
          <div className="space-y-6">
            <Card>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
                <div>
                  <SectionTitle icon={<Calculator className="text-orange-500" />} title="Live House Price Prediction" subtitle="Change any field and the predicted price updates instantly." />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Area sqft"><input className="input" type="number" value={input.area_sqft} onChange={e => set('area_sqft', +e.target.value)} /></Field>
                    <Field label="Bedrooms"><input className="input" type="number" value={input.bedrooms} onChange={e => set('bedrooms', +e.target.value)} /></Field>
                    <Field label="Bathrooms"><input className="input" type="number" value={input.bathrooms} onChange={e => set('bathrooms', +e.target.value)} /></Field>
                    <Field label="Property Age"><input className="input" type="number" value={input.property_age} onChange={e => set('property_age', +e.target.value)} /></Field>
                    <Field label="Parking Slots"><input className="input" type="number" value={input.parking_slots} onChange={e => set('parking_slots', +e.target.value)} /></Field>
                    <Field label="Floor Number"><input className="input" type="number" value={input.floor_number} onChange={e => set('floor_number', +e.target.value)} /></Field>
                    <Field label="Location"><select className="input" value={input.location} onChange={e => set('location', e.target.value)}>{locations.map(x => <option key={x}>{x}</option>)}</select></Field>
                    <Field label="Furnishing"><select className="input" value={input.furnishing} onChange={e => set('furnishing', e.target.value)}>{furnishing.map(x => <option key={x}>{x}</option>)}</select></Field>
                    <Field label="Quality Grade"><select className="input" value={input.quality_grade} onChange={e => set('quality_grade', e.target.value)}>{quality.map(x => <option key={x}>{x}</option>)}</select></Field>
                    <Field label="Near Metro"><select className="input" value={input.near_metro} onChange={e => set('near_metro', +e.target.value)}><option value={1}>Yes</option><option value={0}>No</option></select></Field>
                    <Field label="Balconies"><input className="input" type="number" value={input.balconies} onChange={e => set('balconies', +e.target.value)} /></Field>
                  </div>
                </div>

                <div className="space-y-5">
                  <Card className="!bg-gradient-to-br !from-emerald-50 !via-white !to-sky-50">
                    <p className="text-sm font-bold text-slate-500">Predicted Price</p>
                    <h3 className="mt-2 text-4xl font-black text-emerald-600">{formatINR(price)}</h3>
                    <p className="mt-2 text-sm text-slate-500">This value updates instantly using the exported ML pricing rules.</p>
                  </Card>
                  <Card>
                    <SectionTitle icon={<Brain className="text-pink-500" />} title="SHAP-style Explainability" subtitle="Shows which features increase or decrease the predicted price." />
                    <div className="space-y-3">
                      {explanations.slice(0, 6).map((x, i) => (
                        <div key={x.factor} className="flex items-center justify-between rounded-2xl bg-white/70 p-3 shadow-sm">
                          <span className="font-semibold text-slate-700">{i + 1}. {x.factor}</span>
                          <span className={x.effect >= 0 ? 'font-black text-emerald-600' : 'font-black text-rose-500'}>{formatINR(x.effect)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <SectionTitle icon={<TrendingUp className="text-emerald-500" />} title="Advanced What-if Simulator" subtitle="Six different valuation scenarios update from the live input." />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {scenarioCards.map(item => (
                    <div key={item.title} className={`rounded-2xl p-4 ${item.tone}`}>
                      <p className="text-sm font-semibold opacity-75">{item.title}</p>
                      <b className="text-2xl">{formatINR(item.value)}</b>
                      <p className={item.delta >= 0 ? 'text-sm font-black text-emerald-600' : 'text-sm font-black text-rose-600'}>Delta: {formatINR(item.delta)}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <SectionTitle icon={<Brain className="text-pink-500" />} title="Prediction Summary" subtitle="Short business interpretation." />
                <div className="space-y-3">
                  {tips.slice(0, 4).map((tip, i) => (
                    <p key={i} className="rounded-2xl bg-white/70 p-3 text-sm font-medium text-slate-700 shadow-sm">✅ {tip}</p>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'investment' && (
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-3">
              <Card>
                <SectionTitle icon={<WalletCards className="text-blue-500" />} title="EMI Calculator" subtitle="Loan feasibility and repayment estimate." />
                <div className="grid gap-3">
                  <div className="rounded-2xl bg-white/70 p-4 shadow-sm"><p className="text-sm text-slate-500">Estimated EMI</p><h3 className="text-2xl font-black text-blue-700">{formatINR(emi)}</h3><p className="text-xs text-slate-500">80% loan, 8.5% interest, 20 years</p></div>
                  <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-slate-500">Estimated Monthly Rent</p><h3 className="text-2xl font-black text-emerald-700">{formatINR(monthlyRent)}</h3><p className="text-xs text-slate-500">Yield-based rental prediction</p></div>
                  <div className="rounded-2xl bg-pink-50 p-4"><p className="text-sm text-slate-500">Rent-to-EMI Coverage</p><h3 className="text-2xl font-black text-pink-700">{affordabilityRatio}%</h3><p className="text-xs text-slate-500">Investor affordability indicator</p></div>
                </div>
              </Card>

              <Card>
                <SectionTitle icon={<ShieldCheck className="text-orange-500" />} title="Risk Detection" subtitle="Age, location, liquidity and upgrade risk." />
                <div className="h-52"><ResponsiveContainer width="100%" height="100%"><RadialBarChart innerRadius="62%" outerRadius="100%" data={[{ name: riskLabel, value: riskScore, fill: riskColor }]} startAngle={90} endAngle={-270}><RadialBar dataKey="value" cornerRadius={18} background /></RadialBarChart></ResponsiveContainer></div>
                <div className="text-center"><h3 className="text-3xl font-black" style={{ color: riskColor }}>{riskLabel}</h3><p className="text-sm text-slate-500">Risk score: {riskScore}/100</p></div>
              </Card>

              <Card>
                <SectionTitle icon={<AlertTriangle className="text-orange-500" />} title="Risk Distribution" subtitle="Different risk components." />
                <div className="h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip/><Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={4}>{riskDistribution.map((_, i) => <Cell key={i} fill={chartColors[(i + 4) % chartColors.length]} />)}</Pie></PieChart></ResponsiveContainer></div>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card>
                <SectionTitle icon={<TrendingUp className="text-emerald-500" />} title="Future Forecasting" subtitle="5-year conservative vs growth scenario." />
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData}><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis dataKey="year" tick={{ fill: '#475569' }}/><YAxis hide/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Area type="monotone" dataKey="projected" stroke="#14B8A6" fill="#99F6E4" strokeWidth={3}/><Area type="monotone" dataKey="conservative" stroke="#3B82F6" fill="#BFDBFE" strokeWidth={3}/></AreaChart></ResponsiveContainer></div>
              </Card>

              <Card>
                <SectionTitle icon={<Scale className="text-pink-500" />} title="Property Comparison Engine" subtitle="Selected property vs benchmark property." />
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={propertyCompare}><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }}/><YAxis hide/><Tooltip formatter={(v:any, n:any)=> n === 'value' ? formatINR(Number(v)) : v}/><Bar dataKey="value" radius={[12,12,0,0]} fill="#3B82F6"/><Bar dataKey="roi" radius={[12,12,0,0]} fill="#EC4899"/><Bar dataKey="risk" radius={[12,12,0,0]} fill="#F97316"/></BarChart></ResponsiveContainer></div>
              </Card>

              <Card>
                <SectionTitle icon={<Landmark className="text-violet-500" />} title="Location Intelligence" subtitle="Connectivity, resale, lifestyle and rental demand." />
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={locationIntelligence} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis type="number" domain={[0, 100]} hide/><YAxis type="category" dataKey="metric" tick={{ fill: '#475569', fontSize: 11 }} width={95}/><Tooltip/><Bar dataKey="score" radius={[0,12,12,0]}>{locationIntelligence.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <SectionTitle icon={<Target className="text-rose-500" />} title="Overpriced / Undervalued Detection" subtitle="Compares simulated listed price with model valuation." />
                <div className={`rounded-3xl p-5 ${pricingStatus.bg}`}>
                  <p className="text-sm font-bold text-slate-500">Pricing Status</p>
                  <h3 className={`mt-2 text-4xl font-black ${pricingStatus.color}`}>{pricingStatus.label}</h3>
                  <p className="mt-2 text-sm text-slate-600">{pricingStatus.note}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/70 p-4 shadow-sm"><p className="text-xs text-slate-500">Model Value</p><b className="text-slate-900">{formatINR(price)}</b></div>
                  <div className="rounded-2xl bg-white/70 p-4 shadow-sm"><p className="text-xs text-slate-500">Listed Price</p><b className="text-slate-900">{formatINR(listedPrice)}</b></div>
                  <div className="rounded-2xl bg-white/70 p-4 shadow-sm"><p className="text-xs text-slate-500">Gap</p><b className={priceGap >= 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatINR(priceGap)}</b></div>
                </div>
              </Card>

              <Card>
                <SectionTitle icon={<Scale className="text-blue-500" />} title="Buyer Suitability Score" subtitle="Finds which buyer category fits this property best." />
                <div className="mb-4 rounded-3xl bg-gradient-to-r from-sky-50 via-white to-pink-50 p-4">
                  <p className="text-sm text-slate-500">Best Match</p>
                  <h3 className="text-3xl font-black text-blue-700">{topBuyer.persona}</h3>
                  <p className="text-sm font-semibold text-emerald-600">Suitability: {topBuyer.score}/100</p>
                </div>
                <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={buyerSuitability} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis type="number" domain={[0, 100]} hide/><YAxis type="category" dataKey="persona" tick={{ fill: '#475569', fontSize: 11 }} width={100}/><Tooltip/><Bar dataKey="score" radius={[0,12,12,0]}>{buyerSuitability.map((_, i) => <Cell key={i} fill={chartColors[(i + 2) % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
              </Card>
            </div>

            <Card>
              <SectionTitle icon={<Brain className="text-pink-500" />} title="Investment Recommendation Engine" subtitle="Decision support based on price, yield, risk and 5-year projection." />
              <div className="grid gap-3 md:grid-cols-2">
                {[...tips, `Current investment score is ${investmentScore}/10, so this property is ${investmentScore >= 8 ? 'strong for portfolio positioning' : 'better for cautious comparison'}.`, `Estimated 5-year upside is ${formatINR(expectedFiveYearValue - price)} based on the current input scenario.`, `Estimated rental yield is ${rentalYield.toFixed(1)}%, with monthly rent around ${formatINR(monthlyRent)}.`].map((tip, i) => (
                  <p key={i} className="rounded-2xl bg-white/70 p-3 text-sm font-medium text-slate-700 shadow-sm">✅ {tip}</p>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'loaded' && (
          <div className="space-y-6">
            <Card>
              <div className="text-center"><h2 className="text-2xl font-black text-slate-900">Already Loaded Dataset Mode</h2><p className="text-slate-500">This opens the built-in CSV and predicts values immediately.</p></div>
              <div className="mt-5"><PredictionSummary rows={loadedRows} /></div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="h-80 rounded-3xl bg-white/60 p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={loadedRows.slice(0, 12)}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="source_id" tick={{ fontSize: 10 }}/><YAxis hide/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Bar dataKey="predicted_price" radius={[10,10,0,0]}>{loadedRows.slice(0, 12).map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
                <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/70"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">ID</th><th>Location</th><th>Area</th><th>Prediction</th></tr></thead><tbody>{loadedRows.slice(0, 8).map(row => <tr key={row.source_id} className="border-t border-slate-200"><td className="p-3 font-bold">{row.source_id}</td><td>{row.location}</td><td>{row.area_sqft}</td><td className="font-black text-emerald-600">{formatINR(row.predicted_price)}</td></tr>)}</tbody></table></div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card>
                <div className="flex items-center gap-2"><PieIcon className="text-teal-500"/><h2 className="text-xl font-black text-slate-900">Location Price Mix</h2></div>
                <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Pie data={locationPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>{locationPie.map((_: any, i: number) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Pie></PieChart></ResponsiveContainer></div>
              </Card>
              <Card>
                <div className="flex items-center gap-2"><Target className="text-orange-500"/><h2 className="text-xl font-black text-slate-900">Quality Grade Mix</h2></div>
                <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Pie data={qualityPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={95} paddingAngle={4}>{qualityPie.map((_: any, i: number) => <Cell key={i} fill={chartColors[(i + 2) % chartColors.length]} />)}</Pie></PieChart></ResponsiveContainer></div>
              </Card>
              <Card>
                <h2 className="text-xl font-black text-slate-900">Feature Importance Drivers</h2>
                <div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.featureImpact.slice(0, 7)} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis type="number" hide/><YAxis type="category" dataKey="feature" tick={{ fill: '#475569', fontSize: 11 }} width={95}/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Bar dataKey="impact" radius={[0,12,12,0]}>{report.featureImpact.slice(0, 7).map((_: any, i: number) => <Cell key={i} fill={chartColors[(i + 4) % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-6">
            <Card>
              <div className="mx-auto max-w-3xl rounded-[2rem] border-2 border-dashed border-sky-300 bg-sky-50/70 p-8 text-center">
                <FileUp className="mx-auto text-sky-600" size={42}/>
                <h2 className="mt-3 text-2xl font-black text-slate-900">Upload CSV for Real-Time Batch Prediction</h2>
                <p className="mt-2 text-slate-500">Supports this project schema and Ames/Kaggle-style columns such as GrLivArea, OverallQual, Neighborhood, GarageCars, FullBath, HalfBath, YearBuilt.</p>
                <input className="mx-auto mt-5 block rounded-2xl bg-white p-3 text-sm shadow" type="file" accept=".csv" onChange={e => handleUpload(e.target.files?.[0] ?? null)} />
              </div>
              <div className="mt-5"><PredictionSummary rows={uploadedRows} /></div>
            </Card>

            {!!uploadedRows.length ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <SectionTitle icon={<BarChart className="text-blue-500" />} title="Uploaded CSV Prediction Chart" subtitle="First 12 uploaded records with predicted value." />
                    <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={uploadedRows.slice(0, 12)}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="source_id" tick={{ fontSize: 10 }}/><YAxis hide/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Bar dataKey="predicted_price" radius={[10,10,0,0]}>{uploadedRows.slice(0, 12).map((_, i) => <Cell key={i} fill={chartColors[(i + 3) % chartColors.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
                  </Card>
                  <Card>
                    <SectionTitle icon={<Database className="text-emerald-500" />} title="Uploaded CSV Table" subtitle="Preview of uploaded property predictions." />
                    <div className="overflow-hidden rounded-3xl border border-white/80 bg-white/70"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">ID</th><th>Location</th><th>Quality</th><th>Prediction</th></tr></thead><tbody>{uploadedRows.slice(0, 8).map(row => <tr key={row.source_id} className="border-t border-slate-200"><td className="p-3 font-bold">{row.source_id}</td><td>{row.location}</td><td>{row.quality_grade}</td><td className="font-black text-emerald-600">{formatINR(row.predicted_price)}</td></tr>)}</tbody></table></div>
                  </Card>
                </div>
                <Card>
                  <SectionTitle icon={<Sparkles className="text-pink-500" />} title="CSV Upload Insights" subtitle="Business interpretation from uploaded batch prediction." />
                  <div className="grid gap-3 md:grid-cols-3">
                    <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">✅ Uploaded CSV converted into prediction-ready property inputs.</p>
                    <p className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold text-blue-700">✅ Batch prediction helps compare multiple properties at once.</p>
                    <p className="rounded-2xl bg-pink-50 p-4 text-sm font-semibold text-pink-700">✅ Use the highest predicted properties for premium investment targeting.</p>
                  </div>
                </Card>
              </>
            ) : (
              <Card><p className="text-center text-slate-500">Upload a CSV file to unlock CSV-specific charts, table preview and business insights.</p></Card>
            )}
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
              <Card>
                <div className="flex items-center gap-2"><LineChart className="text-blue-500"/><h2 className="text-2xl font-black text-slate-900">Regression Model Comparison</h2></div>
                <div className="mt-4 h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.leaderboard}><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis dataKey="model" tick={{ fill: '#475569', fontSize: 11 }}/><YAxis tick={{ fill: '#475569' }}/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Bar dataKey="RMSE" radius={[12,12,0,0]}>{report.leaderboard.map((_: any, i: number) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
              </Card>
              <Card>
                <h2 className="text-2xl font-black text-slate-900">Model Metrics Table</h2>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/80 bg-white/60"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">Model</th><th>MAE</th><th>RMSE</th><th>R²</th></tr></thead><tbody>{report.leaderboard.map((r: any) => <tr key={r.model} className="border-t border-slate-200"><td className="p-3 font-bold text-slate-800">{r.model}</td><td>{formatINR(r.MAE)}</td><td>{formatINR(r.RMSE)}</td><td className="font-bold text-emerald-600">{r.R2}</td></tr>)}</tbody></table></div>
              </Card>
            </div>

            <Card>
              <h2 className="text-2xl font-black text-slate-900">Actual vs Predicted Price</h2>
              <div className="mt-4 h-80"><ResponsiveContainer width="100%" height="100%"><RLineChart data={report.actualVsPredicted}><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis tick={{ fill: '#475569' }}/><YAxis tick={{ fill: '#475569' }}/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Line type="monotone" dataKey="actual" stroke="#2563EB" strokeWidth={3} dot={false}/><Line type="monotone" dataKey="predicted" stroke="#EC4899" strokeWidth={3} dot={false}/></RLineChart></ResponsiveContainer></div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <SectionTitle icon={<Brain className="text-pink-500" />} title="SHAP-style Feature Importance" subtitle="Exported feature contribution from regression training." />
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.featureImpact.slice(0, 10)} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1"/><XAxis type="number" hide/><YAxis type="category" dataKey="feature" tick={{ fill: '#475569', fontSize: 11 }} width={100}/><Tooltip formatter={(v:any)=>formatINR(Number(v))}/><Bar dataKey="impact" radius={[0,12,12,0]}>{report.featureImpact.slice(0, 10).map((_: any, i: number) => <Cell key={i} fill={chartColors[(i + 4) % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div>
              </Card>
              <Card>
                <SectionTitle icon={<Target className="text-emerald-500" />} title="Model Interpretation Notes" subtitle="Interview-friendly explanation of the regression pipeline." />
                <div className="grid gap-3">
                  <p className="rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-700">✅ This is a regression task because the output is a continuous house price.</p>
                  <p className="rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-700">✅ Models are compared using MAE, RMSE and R² score.</p>
                  <p className="rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-700">✅ Feature impact helps explain why the model predicts a high or low value.</p>
                  <p className="rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-700">✅ Actual vs predicted chart shows how close the model output is to real/simulated sale price.</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
