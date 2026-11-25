import React from 'react';

/**
 * Spacer row inside virtualized <tbody> elements so scroll height stays accurate
 * without duplicating inline-styled spacer markup across tables.
 */
export const VirtualTableSpacer: React.FC<{ height: number; colSpan: number }> = ({ height, colSpan }) => {
  if (height <= 0) return null;
  return (
    <tr aria-hidden="true">
      <td colSpan={colSpan} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
};

/**
 * Vertical spacer block inside virtualized flex/div lists.
 */
export const VirtualListSpacer: React.FC<{ height: number }> = ({ height }) => {
  if (height <= 0) return null;
  return <div style={{ height }} aria-hidden="true" />;
};
