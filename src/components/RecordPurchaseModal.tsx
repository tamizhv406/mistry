import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  ChevronRight,
  Layers,
  Sparkles,
  ArrowRight,
  Save,
  Package,
  PlusCircle,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { Material, MaterialCategory, RodEntry, Site } from '../db/types';
import { todayKey } from '../utils/datetime';
import { formatINR, roundMoney } from '../utils/money';
import { getCurrentUser } from '../services/auth';
import { recordPurchase } from '../services/records';
import { db } from '../db/db';
import { recordPaymentTransaction, calculateFinancialBalance } from '../utils/financial';
import { CEMENT_TYPES } from '../domain/catalog';

export interface RecordPurchaseModalProps {
  isOpen: boolean;
  siteId: string;
  sites: Site[];
  materialToEdit?: Material | null;
  rodToEdit?: RodEntry | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export interface SubCategorySpec {
  id: string;
  label: string;
  recommendedType?: string;
  recommendedGrade?: string;
  defaultUnit?: string;
  description?: string;
}

export interface MaterialCategoryCard {
  id: string;
  name: string;
  category: MaterialCategory;
  image: string;
  tagline: string;
  subCategories: SubCategorySpec[];
}

export const MATERIAL_SELECTION_CARDS: MaterialCategoryCard[] = [
  {
    id: 'cement',
    name: 'Cement',
    category: 'cement',
    image: 'material-images/cement.jpg',
    tagline: 'OPC, PPC, PSC structural & masonry bonding',
    subCategories: [
      { id: 'roof_slab', label: 'Roof / Slab Cement', recommendedType: 'OPC', recommendedGrade: '53', defaultUnit: 'Bags', description: 'High early strength for structural RCC slab casting' },
      { id: 'wall', label: 'Wall Cement', recommendedType: 'PPC', defaultUnit: 'Bags', description: 'Optimal for brickwork, block masonry & external walls' },
      { id: 'floor', label: 'Floor Cement', recommendedType: 'PSC', defaultUnit: 'Bags', description: 'Resistant to moisture & ideal for floor screed & PCC' },
      { id: 'general', label: 'General Construction Cement', recommendedType: 'OPC', recommendedGrade: '43', defaultUnit: 'Bags', description: 'General mortar, non-structural concrete and repairs' },
    ],
  },
  {
    id: 'sand',
    name: 'Sand',
    category: 'sand',
    image: 'material-images/river-sand.jpg',
    tagline: 'River sand, fine aggregate & screening',
    subCategories: [
      { id: 'river_sand', label: 'River Sand', defaultUnit: 'CFT', description: 'Natural riverbed aggregate for high-grade concrete mixes' },
      { id: 'plastering_sand', label: 'Plastering Sand', defaultUnit: 'CFT', description: 'Fine sieved sand for smooth interior and exterior plastering' },
      { id: 'general_sand', label: 'General Sand', defaultUnit: 'Unit (100 CFT)', description: 'General bulk sand for filling and foundation packing' },
    ],
  },
  {
    id: 'msand',
    name: 'M-Sand',
    category: 'msand',
    image: 'material-images/m-sand.jpg',
    tagline: 'Manufactured sand & plastering sand (P-Sand)',
    subCategories: [
      { id: 'concrete_msand', label: 'Concrete M-Sand', defaultUnit: 'CFT', description: 'Manufactured sand graded for structural concrete & columns' },
      { id: 'plastering_psand', label: 'Plastering M-Sand (P-Sand)', defaultUnit: 'CFT', description: 'Superfine manufactured sand for crack-free wall plastering' },
      { id: 'block_msand', label: 'Block Work M-Sand', defaultUnit: 'CFT', description: 'Medium grade sand for solid & AAC block laying mortar' },
    ],
  },
  {
    id: 'steel',
    name: 'Steel Rods',
    category: 'rod',
    image: 'material-images/steel-rods.jpg',
    tagline: 'TMT bars, reinforcement & binding wire',
    subCategories: [
      { id: 'tmt_rods', label: 'TMT Steel Rods', defaultUnit: 'kg', description: 'Fe 500D / 550D primary structural reinforcement' },
      { id: 'steel_by_dia', label: 'Steel by Diameter', defaultUnit: 'kg', description: 'Specific dia bars (8mm, 10mm, 12mm, 16mm, 20mm, 25mm)' },
      { id: 'binding_wire', label: 'Binding Wire', defaultUnit: 'kg', description: 'Annealed GI binding wire for tying rebar joints' },
    ],
  },
  {
    id: 'bricks',
    name: 'Bricks & Blocks',
    category: 'bricks',
    image: 'material-images/bricks.jpg',
    tagline: 'Red clay bricks, solid blocks & lightweight AAC',
    subCategories: [
      { id: 'red_bricks', label: 'Red Bricks', defaultUnit: 'Pieces', description: 'Kiln-burnt chamber red clay bricks' },
      { id: 'solid_blocks', label: 'Solid Blocks', defaultUnit: 'Pieces', description: 'Heavy concrete load-bearing solid blocks (4", 6", 8")' },
      { id: 'hollow_blocks', label: 'Hollow Blocks', defaultUnit: 'Pieces', description: 'Lightweight hollow concrete blocks with thermal insulation' },
      { id: 'aac_blocks', label: 'AAC Blocks', defaultUnit: 'Pieces', description: 'Autoclaved aerated lightweight blocks for rapid build' },
    ],
  },
  {
    id: 'aggregate',
    name: 'Aggregates',
    category: 'aggregate',
    image: 'material-images/aggregate.jpg',
    tagline: 'Coarse gravel (20mm, 40mm, GSB & metal)',
    subCategories: [
      { id: 'blue_metal_20mm', label: '20mm Blue Metal', defaultUnit: 'CFT', description: 'Standard aggregate for RCC roof, beam and columns' },
      { id: 'metal_40mm', label: '40mm Metal', defaultUnit: 'CFT', description: 'Coarse metal for foundation footing & PCC mass concrete' },
      { id: 'crusher_dust', label: 'Crusher Dust / GSB', defaultUnit: 'CFT', description: 'Crushed quarry dust for pavers and sub-base bedding' },
    ],
  },
  {
    id: 'tiles',
    name: 'Tiles & Flooring',
    category: 'other',
    image: 'material-images/tiles.jpg',
    tagline: 'Vitrified tiles, granite, marble & parking tiles',
    subCategories: [
      { id: 'vitrified_tiles', label: 'Vitrified Floor Tiles', defaultUnit: 'Box', description: 'GVT/PGVT floor tiles for living, bedrooms & kitchen' },
      { id: 'wall_tiles', label: 'Ceramic Wall Tiles', defaultUnit: 'Box', description: 'Glazed wall tiles for bathrooms, toilet & kitchen dado' },
      { id: 'granite_slabs', label: 'Granite & Marble Slabs', defaultUnit: 'sq.ft', description: 'Natural polished stone for kitchen counter & stairs' },
      { id: 'parking_tiles', label: 'Parking & Exterior Pavers', defaultUnit: 'sq.ft', description: 'Heavy-duty non-slip parking and driveway pavers' },
    ],
  },
  {
    id: 'paint',
    name: 'Paint & Finishes',
    category: 'other',
    image: 'material-images/paint.jpg',
    tagline: 'Primer, interior & exterior emulsion, putty',
    subCategories: [
      { id: 'wall_putty', label: 'Wall Putty', defaultUnit: 'Bags', description: 'White cement based putty for base wall leveling' },
      { id: 'primer', label: 'Primer Coat', defaultUnit: 'Litre', description: 'Interior/Exterior water-thinnable primer sealer' },
      { id: 'interior_emulsion', label: 'Interior Emulsion', defaultUnit: 'Litre', description: 'Washable luxury acrylic interior wall paint' },
      { id: 'exterior_emulsion', label: 'Exterior Emulsion', defaultUnit: 'Litre', description: 'Weatherproof anti-fungal exterior wall coating' },
    ],
  },
  {
    id: 'electrical',
    name: 'Electrical Materials',
    category: 'other',
    image: 'material-images/electrical.jpg',
    tagline: 'Conduits, wiring, modular boxes & MCBs',
    subCategories: [
      { id: 'pvc_conduits', label: 'PVC Conduit Pipes & Boxes', defaultUnit: 'Pieces', description: 'Heavy-gauge electrical conduit for slab & wall channelling' },
      { id: 'fr_wires', label: 'FR Copper Wires', defaultUnit: 'Bundle', description: 'Fire retardant house wiring cables (1.0, 1.5, 2.5, 4.0 sq.mm)' },
      { id: 'modular_switches', label: 'Modular Switches & Sockets', defaultUnit: 'Pieces', description: 'Switch plates, power sockets and dimmer regulators' },
      { id: 'distribution_mcb', label: 'MCB & Distribution Board', defaultUnit: 'Pieces', description: 'Safety miniature circuit breakers & isolators' },
    ],
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Sanitary',
    category: 'other',
    image: 'material-images/plumbing.jpg',
    tagline: 'CPVC, UPVC pipes, drainage & sanitaryware',
    subCategories: [
      { id: 'cpvc_pipes', label: 'CPVC Hot & Cold Pipes', defaultUnit: 'Pieces', description: 'Pressurized water supply piping and brass fittings' },
      { id: 'pvc_drainage', label: 'PVC Drainage / SWR Pipes', defaultUnit: 'Pieces', description: 'Soil, waste and rainwater drainage pipes & traps' },
      { id: 'sanitaryware', label: 'Sanitary Fixtures & Closets', defaultUnit: 'Pieces', description: 'EWC, wash basins, faucets and divertors' },
      { id: 'water_tank', label: 'Water Overhead Tanks', defaultUnit: 'Pieces', description: 'Multi-layer food-grade overhead storage tanks' },
    ],
  },
];

const CEMENT_BRANDS = [
  'UltraTech Cement',
  'Ramco Supergrade',
  'Chettinad Cement',
  'Dalmia DSP',
  'ACC Cement',
  'Ambuja Cement',
  'Coromandel King',
  'Zuari Cement',
  'Priya Cement',
  'Birla A1',
  'JSW Cement',
  'Other',
];

const STEEL_BRANDS = [
  'Tata Tiscon 550D',
  'JSW Neosteel 550D',
  'SAIL TMT',
  'Jindal Panther',
  'Kamachi TMT',
  'ARS Steel 550D',
  'Vizag Steel',
  'Agni Steels',
  'Other',
];

const COMMON_STEEL_DIAMETERS = ['6 mm', '8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm', '32 mm', 'Binding Wire'];

export const RecordPurchaseModal: React.FC<RecordPurchaseModalProps> = ({
  isOpen,
  siteId,
  sites,
  materialToEdit,
  rodToEdit,
  onClose,
  onSuccess,
}) => {
  const currentUser = getCurrentUser();

  // Wizard state: step 1 = Select Category/Subcategory, step 2 = Details Form
  const [step, setStep] = useState<1 | 2>(materialToEdit || rodToEdit ? 2 : 1);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCard, setSelectedCard] = useState<MaterialCategoryCard>(MATERIAL_SELECTION_CARDS[0]);
  const [selectedSubCat, setSelectedSubCat] = useState<SubCategorySpec>(MATERIAL_SELECTION_CARDS[0].subCategories[0]);

  // Form Fields
  const [targetSiteId, setTargetSiteId] = useState(siteId);
  const [materialName, setMaterialName] = useState('');
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [materialType, setMaterialType] = useState('OPC');
  const [grade, setGrade] = useState('53');
  const [steelDiameter, setSteelDiameter] = useState('12 mm');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('Unit');
  const [rate, setRate] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [supplier, setSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayKey());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or re-initialize when opening or editing
  React.useEffect(() => {
    if (!isOpen) return;

    if (materialToEdit) {
      setStep(2);
      setTargetSiteId(materialToEdit.siteId);
      const card = MATERIAL_SELECTION_CARDS.find(c => c.category === materialToEdit.category) || MATERIAL_SELECTION_CARDS[0];
      setSelectedCard(card);
      setSelectedSubCat(card.subCategories[0]);
      setMaterialName(materialToEdit.materialName || '');
      setBrand(materialToEdit.brand || '');
      setMaterialType(materialToEdit.materialType || 'OPC');
      setGrade(materialToEdit.grade || '');
      setQuantity(materialToEdit.quantity.toString());
      setUnit(materialToEdit.unit || 'Unit');
      setRate(materialToEdit.rate.toString());
      setPaidAmount(materialToEdit.paidAmount.toString());
      setSupplier(materialToEdit.supplier || '');
      setPurchaseDate(materialToEdit.purchaseDate || todayKey());
      setInvoiceNumber(materialToEdit.invoiceNumber || '');
      setNotes(materialToEdit.notes || '');
    } else if (rodToEdit) {
      setStep(2);
      setTargetSiteId(rodToEdit.siteId);
      const card = MATERIAL_SELECTION_CARDS.find(c => c.id === 'steel')!;
      setSelectedCard(card);
      setSelectedSubCat(card.subCategories[1]);
      setSteelDiameter(rodToEdit.diameter || '12 mm');
      setBrand(rodToEdit.brand || 'Tata Tiscon 550D');
      setQuantity(rodToEdit.weightKg ? rodToEdit.weightKg.toString() : '500');
      setUnit(rodToEdit.unit || 'kg');
      setRate(rodToEdit.ratePerKg ? rodToEdit.ratePerKg.toString() : '68');
      setPaidAmount(rodToEdit.paidAmount.toString());
      setSupplier(rodToEdit.supplier || '');
      setPurchaseDate(rodToEdit.purchaseDate || todayKey());
      setInvoiceNumber(rodToEdit.invoiceNumber || '');
      setNotes(rodToEdit.notes || '');
    } else {
      setStep(1);
      setTargetSiteId(siteId);
      setSearchFilter('');
      setPurchaseDate(todayKey());
      setQuantity('1');
      setRate('0');
      setPaidAmount('0');
      setError('');
    }
  }, [isOpen, materialToEdit, rodToEdit, siteId]);

  // Compute calculated total
  const totalAmount = useMemo(() => {
    const q = parseFloat(quantity) || 0;
    const r = parseFloat(rate) || 0;
    return roundMoney(q * r);
  }, [quantity, rate]);

  // Handler when selecting a subcategory
  const handleSelectSubCategory = (card: MaterialCategoryCard, subCat: SubCategorySpec) => {
    setSelectedCard(card);
    setSelectedSubCat(subCat);

    // Populate sensible defaults
    if (card.id === 'cement') {
      setBrand('UltraTech Cement');
      setMaterialType(subCat.recommendedType || 'OPC');
      setGrade(subCat.recommendedGrade || (subCat.recommendedType === 'OPC' ? '53' : ''));
      setUnit('Bags');
      setMaterialName(`${subCat.label} (UltraTech)`);
    } else if (card.id === 'steel') {
      setBrand('Tata Tiscon 550D');
      setUnit('kg');
      if (subCat.id === 'binding_wire') {
        setSteelDiameter('Binding Wire');
        setMaterialName('Binding Wire (GI Annealed)');
      } else {
        setSteelDiameter('12 mm');
        setMaterialName(`TMT Steel Rods (12 mm)`);
      }
    } else {
      setMaterialName(subCat.label);
      setUnit(subCat.defaultUnit || 'Unit');
      setBrand('');
      setMaterialType('');
      setGrade('');
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('You must be signed in to record a purchase.');
      return;
    }
    if (!targetSiteId) {
      setError('Please select a project/site.');
      return;
    }

    const qNum = parseFloat(quantity);
    if (!qNum || qNum <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    const rNum = parseFloat(rate);
    if (isNaN(rNum) || rNum < 0) {
      setError('Price per unit cannot be negative.');
      return;
    }
    const pNum = parseFloat(paidAmount) || 0;
    if (pNum < 0) {
      setError('Paid amount cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const activeBrand = brand === 'Other' ? customBrand.trim() : brand.trim();

      if (selectedCard.id === 'steel' && !materialToEdit) {
        // Record as Steel/Rod Entry in db.rodEntries
        const calculatedTotal = roundMoney(qNum * rNum);
        const fin = calculateFinancialBalance(calculatedTotal, pNum);
        const now = new Date().toISOString();
        const id = rodToEdit ? rodToEdit.id : `rod-${Date.now()}`;

        const rodData: RodEntry = {
          id,
          siteId: targetSiteId,
          diameter: steelDiameter,
          brand: activeBrand || 'Standard TMT',
          quantityPieces: 0,
          unit,
          weightKg: unit.toLowerCase() === 'tonne' ? qNum * 1000 : qNum,
          ratePerKg: unit.toLowerCase() === 'tonne' ? rNum / 1000 : rNum,
          totalAmount: calculatedTotal,
          paidAmount: fin.paidAmount,
          balance: fin.balanceDue,
          extraPaid: fin.extraPaid,
          supplier: supplier.trim() || 'Direct Steel Mill',
          purchaseDate,
          invoiceNumber: invoiceNumber.trim() || undefined,
          notes: notes.trim() ? `[${selectedSubCat.label}] ${notes.trim()}` : `[${selectedSubCat.label}]`,
          isDeleted: false,
          createdAt: rodToEdit ? rodToEdit.createdAt : now,
          updatedAt: now,
        };

        await db.rodEntries.put(rodData);

        if (fin.paidAmount > 0) {
          await recordPaymentTransaction({
            siteId: targetSiteId,
            relatedRecordId: id,
            tableName: 'rodEntries',
            amount: fin.paidAmount,
            paymentType: paymentMode,
            date: purchaseDate || todayKey(),
            notes: invoiceNumber ? `Weighbridge/Inv ${invoiceNumber}` : `Payment for ${steelDiameter} steel`,
            module: 'Rod',
            userId: currentUser?.id,
          });
        }

        onSuccess(`Recorded purchase of ${quantity} ${unit} steel rods successfully.`);
        onClose();
      } else {
        // Record as standard Material purchase
        const finalName = materialName.trim() || selectedSubCat.label;
        const res = await recordPurchase(
          currentUser,
          targetSiteId,
          {
            category: selectedCard.category,
            materialName: finalName,
            brand: activeBrand || undefined,
            materialType: materialType.trim() || undefined,
            grade: grade.trim() || undefined,
            quantity: qNum,
            unit,
            rate: rNum,
            paidAmount: pNum,
            paymentMode,
            supplier: supplier.trim() || 'Local Supplier',
            purchaseDate,
            invoiceNumber: invoiceNumber.trim() || undefined,
            notes: notes.trim() ? `[${selectedSubCat.label}] ${notes.trim()}` : `[${selectedSubCat.label}]`,
          }
        );

        if (!res.ok) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }

        onSuccess(`Recorded purchase of ${qNum} ${unit} ${finalName} successfully.`);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save purchase record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Filter category cards by search
  const filteredCards = searchFilter.trim()
    ? MATERIAL_SELECTION_CARDS.filter(
        c =>
          c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
          c.tagline.toLowerCase().includes(searchFilter.toLowerCase()) ||
          c.subCategories.some(sc => sc.label.toLowerCase().includes(searchFilter.toLowerCase()))
      )
    : MATERIAL_SELECTION_CARDS;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: step === 1 ? '960px' : '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
                {materialToEdit || rodToEdit
                  ? 'Edit Material Record'
                  : step === 1
                  ? 'Record Purchase – Select Material'
                  : `Record Purchase: ${selectedCard.name}`}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
                {step === 1
                  ? 'Pick a material category and specific usage classification to proceed'
                  : `${selectedSubCat.label} · Enter quantity, supplier and payment details`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {step === 2 && !materialToEdit && !rodToEdit && (
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Change Category
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {step === 1 ? (
            <div>
              {/* Search Bar */}
              <div
                style={{
                  position: 'relative',
                  marginBottom: '20px',
                }}
              >
                <Search
                  size={18}
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
                />
                <input
                  type="text"
                  placeholder="Search material category, specification, or usage (e.g. Roof cement, River sand, TMT)..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#F8FAFC',
                  }}
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Responsive Category Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '16px',
                }}
              >
                {filteredCards.map(card => (
                  <div
                    key={card.id}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Card Photo Header */}
                    <div style={{ position: 'relative', height: '110px', backgroundColor: '#F1F5F9' }}>
                      <img
                        src={`./${card.image}`}
                        alt={card.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)',
                        }}
                      />
                      <div style={{ position: 'absolute', bottom: '10px', left: '12px', right: '12px' }}>
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontWeight: 700,
                            fontSize: '1.05rem',
                            display: 'block',
                            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                          }}
                        >
                          {card.name}
                        </span>
                        <span
                          style={{
                            color: '#CBD5E1',
                            fontSize: '0.75rem',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {card.tagline}
                        </span>
                      </div>
                    </div>

                    {/* Subcategories Options List */}
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                        Select Usage Classification:
                      </span>
                      {card.subCategories.map(subCat => (
                        <button
                          key={subCat.id}
                          type="button"
                          onClick={() => handleSelectSubCategory(card, subCat)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #F1F5F9',
                            backgroundColor: '#F8FAFC',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#EFF6FF';
                            e.currentTarget.style.borderColor = '#BFDBFE';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = '#F8FAFC';
                            e.currentTarget.style.borderColor = '#F1F5F9';
                          }}
                        >
                          <div style={{ flex: 1, paddingRight: '8px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>{subCat.label}</div>
                            {subCat.description && (
                              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                                {subCat.description}
                              </div>
                            )}
                          </div>
                          <ChevronRight size={16} color="#3B82F6" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Material Details Form */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {/* Target Project Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Project / Site <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={targetSiteId}
                  onChange={e => setTargetSiteId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                  }}
                  required
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.address || 'Active Site'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Classification Tag */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 700, textTransform: 'uppercase' }}>
                    Usage Classification
                  </span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1E3A8A' }}>
                    {selectedCard.name} &gt; {selectedSubCat.label}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#DBEAFE',
                    color: '#1E40AF',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {selectedCard.category}
                </span>
              </div>

              {/* Material Name / Brand */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Material Description / Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={materialName}
                    onChange={e => setMaterialName(e.target.value)}
                    placeholder="e.g. UltraTech Supergrade 53"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                {selectedCard.id === 'cement' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Cement Brand
                    </label>
                    <select
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        backgroundColor: '#FFFFFF',
                        outline: 'none',
                      }}
                    >
                      {CEMENT_BRANDS.map(b => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedCard.id === 'steel' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Steel Brand / Grade
                    </label>
                    <select
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        backgroundColor: '#FFFFFF',
                        outline: 'none',
                      }}
                    >
                      {STEEL_BRANDS.map(b => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Cement Type and Grade Specifics */}
              {selectedCard.id === 'cement' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Cement Type
                    </label>
                    <select
                      value={materialType}
                      onChange={e => setMaterialType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        backgroundColor: '#FFFFFF',
                        outline: 'none',
                      }}
                    >
                      <option value="OPC">OPC (Ordinary Portland)</option>
                      <option value="PPC">PPC (Portland Pozzolana)</option>
                      <option value="PSC">PSC (Portland Slag)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Grade
                    </label>
                    <select
                      value={grade}
                      onChange={e => setGrade(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.9rem',
                        backgroundColor: '#FFFFFF',
                        outline: 'none',
                      }}
                    >
                      <option value="53">53 Grade (High Strength)</option>
                      <option value="43">43 Grade (General)</option>
                      <option value="">Not Applicable / PPC</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Steel Diameter Specifics */}
              {selectedCard.id === 'steel' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Rod Diameter / Specification
                  </label>
                  <select
                    value={steelDiameter}
                    onChange={e => setSteelDiameter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    {COMMON_STEEL_DIAMETERS.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity, Unit, Price, and Total */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Quantity <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    <option value="Bags">Bags</option>
                    <option value="CFT">CFT</option>
                    <option value="kg">kg</option>
                    <option value="Tonne">Tonne</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Unit (100 CFT)">Unit (100 CFT)</option>
                    <option value="Box">Box</option>
                    <option value="Litre">Litre</option>
                    <option value="sq.ft">sq.ft</option>
                    <option value="Bundle">Bundle</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Price per Unit (₹) <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Total Amount
                  </label>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#E2E8F0',
                      fontWeight: 700,
                      color: '#0F172A',
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {formatINR(totalAmount)}
                  </div>
                </div>
              </div>

              {/* Payment Details: Paid Amount and Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px', display: 'block' }}>
                    Balance: {formatINR(Math.max(0, totalAmount - (parseFloat(paidAmount) || 0)))}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                    }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI / GPay / PhonePe">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit / Khata">Credit / Khata (Pay Later)</option>
                  </select>
                </div>
              </div>

              {/* Supplier, Purchase Date, Invoice */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    placeholder="e.g. Sri Balaji Hardwares"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Purchase Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Invoice / DC Number
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-089"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Unloaded at North gate, second batch for floor casting"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  <Save size={18} />
                  <span>{isSubmitting ? 'Saving Record...' : 'Save Purchase'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
