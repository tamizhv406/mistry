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
        background: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{getIcon(material)}</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-charcoal)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {material} Market Rates
              <span style={{ fontSize: '0.78rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '12px', color: 'var(--color-text-muted)' }}>
                {activeQuotes.length} Quotes
              </span>
            </h4>
            <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>Standard unit: per {unit}</div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => onAddNewQuote(material)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.84rem', minHeight: '44px' }}
        >
          <Plus size={14} /> Add Quote
        </button>
      </div>

      {/* Comparison Stats */}
      {activeQuotes.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
          <div
            style={{
              background: 'var(--color-success-soft)',
              border: '1px solid var(--color-success-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <TrendingDown size={12} /> Lowest
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-success-text)' }}>
              ₹{lowestPrice} <span style={{ fontSize: '0.78rem', fontWeight: 400 }}>/{unit}</span>
            </span>
          </div>

          <div
            style={{
              background: 'var(--color-primary-soft)',
              border: '1px solid var(--color-primary-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--color-primary-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <BarChart2 size={12} /> Average
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-primary-text)' }}>
              ₹{avgPrice} <span style={{ fontSize: '0.78rem', fontWeight: 400 }}>/{unit}</span>
            </span>
          </div>

          <div
            style={{
              background: 'var(--color-danger-soft)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--color-danger-text)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <TrendingUp size={12} /> Highest
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-danger-text)' }}>
              ₹{highestPrice} <span style={{ fontSize: '0.78rem', fontWeight: 400 }}>/{unit}</span>
            </span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
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
                  border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--color-charcoal)' }}>{quote.supplier}</strong>
                    {isLowest && (
                      <span style={{ background: 'var(--color-success-soft)', color: 'var(--color-success-text)', border: '1px solid var(--color-success-border)', fontSize: '0.72rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                        BEST RATE
                      </span>
                    )}
                    {quote.district && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        • {quote.district} {quote.area ? `(${quote.area})` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {quote.brand && <span>{quote.brand} </span>}
                    {quote.product && <span>— {quote.product}</span>}
                    {quote.grade && <span> ({quote.grade})</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: isSelected ? 'var(--color-primary-text)' : 'var(--color-charcoal)' }}>
                      ₹{quote.price}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>/{quote.unit}</div>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{ minHeight: '44px', padding: '0.35rem 0.85rem', fontSize: '0.84rem' }}
                    onClick={e => {
                      e.stopPropagation();
                      onSelectQuote(quote);
                    }}
                  >
                    {isSelected ? <Check size={15} /> : 'Use'}
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
          fontSize: '0.8rem',
          color: 'var(--color-text-muted)',
          background: 'var(--color-bg)',
          padding: '0.6rem 0.75rem',
          borderRadius: '6px',
          borderLeft: '3px solid var(--color-primary)',
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
