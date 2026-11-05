import React from 'react';
import { Tag, TrendingDown, TrendingUp, BarChart2, AlertCircle, Plus, Check } from 'lucide-react';
import type { MaterialPriceQuote, EstimateMaterial } from '../db/types';

interface PriceComparisonCardProps {
  material: EstimateMaterial;
  quotes: MaterialPriceQuote[];
  selectedQuoteId?: string;
  onSelectQuote: (quote: MaterialPriceQuote) => void;
  onAddNewQuote: (material: EstimateMaterial) => void;
}

export const PriceComparisonCard: React.FC<PriceComparisonCardProps> = ({
  material,
  quotes,
  selectedQuoteId,
  onSelectQuote,
  onAddNewQuote,
}) => {
  const activeQuotes = quotes.filter(q => q.material === material && !q.isDeleted);

  // Compute statistics
  const prices = activeQuotes.map(q => q.price);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highestPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const avgPrice = prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 10) / 10 : 0;
  const unit = activeQuotes[0]?.unit || (material === 'Cement' ? 'Bag' : material === 'Bricks' ? 'Piece' : material === 'Steel' ? 'Kg' : 'CFT');

  const getIcon = (mat: EstimateMaterial) => {
    switch (mat) {
      case 'Cement': return '🧱';
      case 'Sand': return '🏖️';
      case 'M-Sand': return '⛰️';
      case 'Aggregate': return '🪨';
      case 'Bricks': return '🧱';
      case 'Steel': return '🏗️';
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{getIcon(material)}</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {material} Market Rates
              <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                {activeQuotes.length} Quotes
              </span>
            </h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Standard unit: per {unit}</div>
          </div>
        </div>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onAddNewQuote(material)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
        >
          <Plus size={14} /> Add Quote
        </button>
      </div>

      {/* Comparison Stats */}
      {activeQuotes.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingDown size={12} /> Lowest
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#4ade80' }}>
              ₹{lowestPrice} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/{unit}</span>
            </span>
          </div>

          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BarChart2 size={12} /> Average
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#60a5fa' }}>
              ₹{avgPrice} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/{unit}</span>
            </span>
          </div>

          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={12} /> Highest
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f87171' }}>
              ₹{highestPrice} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>/{unit}</span>
            </span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No quotes saved yet for {material}. Click "Add Quote" above to record a dealer price.
        </div>
      )}

      {/* Supplier Quotes List */}
      {activeQuotes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activeQuotes.map(quote => {
            const isSelected = selectedQuoteId === quote.id;
            const isLowest = quote.price === lowestPrice;

            return (
              <div
                key={quote.id}
                onClick={() => onSelectQuote(quote)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  background: isSelected ? 'rgba(255, 184, 0, 0.08)' : 'var(--bg-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>{quote.supplier}</strong>
                    {isLowest && (
                      <span style={{ background: '#22c55e', color: '#000', fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                        BEST RATE
                      </span>
                    )}
                    {quote.district && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        • {quote.district} {quote.area ? `(${quote.area})` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {quote.brand && <span>{quote.brand} </span>}
                    {quote.product && <span>— {quote.product}</span>}
                    {quote.grade && <span> ({quote.grade})</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: isSelected ? 'var(--primary)' : 'var(--text-main)' }}>
                      ₹{quote.price}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/{quote.unit}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                    onClick={e => {
                      e.stopPropagation();
                      onSelectQuote(quote);
                    }}
                  >
                    {isSelected ? <Check size={14} /> : 'Use'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Engineering / Procurement Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.4rem',
          fontSize: '0.74rem',
          color: 'var(--text-muted)',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.5rem 0.6rem',
          borderRadius: '6px',
          borderLeft: '2px solid var(--primary)',
        }}
      >
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          Never select a supplier solely based on price; verify material quality, delivery timelines, and manufacturer test certificates before placing site orders.
        </span>
      </div>
    </div>
  );
};
