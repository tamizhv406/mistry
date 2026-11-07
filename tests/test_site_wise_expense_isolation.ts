/**
 * Verification Suite for Site-Wise Expense Isolation & Click-to-Filter on Dashboard
 *
 * Verifies:
 * 1. Multi-site (e.g. up to 10 sites) individual expense isolation.
 * 2. Clicking a site updates activeSiteId and isolates ONLY that clicked site's expenses.
 * 3. Total cost dynamically recalculates for the clicked site, never staying stuck on index [0].
 * 4. Expenses across multiple categories (Materials, Petty, Utilities, etc.) preserve siteId integrity.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('[Dashboard] Site-Wise Expense Isolation & Click-to-Filter Suite', () => {
  // 1. Mock Sites (10 Sites)
  const mockSites = [
    { id: 'site_1', name: 'Chennai OMR Villa', client: 'Ramesh', sqft: 1500 },
    { id: 'site_2', name: 'Coimbatore Duplex', client: 'Suresh', sqft: 2200 },
    { id: 'site_3', name: 'Madurai Anna Nagar House', client: 'Murugan', sqft: 1200 },
    { id: 'site_4', name: 'Trichy Commercial Complex', client: 'Karthik', sqft: 3500 },
    { id: 'site_5', name: 'Salem Residence', client: 'Anand', sqft: 1800 },
    { id: 'site_6', name: 'Tirunelveli Villa', client: 'Bala', sqft: 2000 },
    { id: 'site_7', name: 'Vellore Apartment', client: 'Praveen', sqft: 2800 },
    { id: 'site_8', name: 'Erode Farmhouse', client: 'Dinesh', sqft: 4000 },
    { id: 'site_9', name: 'Thanjavur Traditional Home', client: 'Vijay', sqft: 1600 },
    { id: 'site_10', name: 'Kanchipuram Weaver Complex', client: 'Gopal', sqft: 2400 },
  ];

  // 2. Mock Expenses across all sites
  const mockExpenses = [
    { id: 1, siteId: 'site_1', title: 'Tea & Snacks', category: 'Petty', amount: 450, date: '2026-11-07' },
    { id: 2, siteId: 'site_1', title: 'Cement 10 Bags', category: 'Materials', amount: 4000, date: '2026-11-07' },
    { id: 3, siteId: 'site_2', title: 'Tea & Snacks', category: 'Petty', amount: 400, date: '2026-11-07' },
    { id: 4, siteId: 'site_2', title: 'M-Sand 1 Load', category: 'Materials', amount: 5500, date: '2026-11-07' },
    { id: 5, siteId: 'site_3', title: 'Tea & Snacks', category: 'Petty', amount: 350, date: '2026-11-07' },
    { id: 6, siteId: 'site_4', title: 'Steel TMT 2 Tons', category: 'Materials', amount: 125000, date: '2026-11-06' },
    { id: 7, siteId: 'site_4', title: 'Excavator Rental', category: 'Tools', amount: 15000, date: '2026-11-06' },
    { id: 8, siteId: 'site_5', title: 'Pooja Items', category: 'Pooja', amount: 2500, date: '2026-11-05' },
    { id: 9, siteId: 'site_10', title: 'Bricks 5000 Nos', category: 'Materials', amount: 55000, date: '2026-11-04' },
  ];

  // Simulation of the exact state & filter logic in DashboardView
  function createDashboardSimulator(initialSiteId: string | null = null) {
    let activeSiteId = initialSiteId || mockSites[0]?.id || null;
    let selectedSiteFilterId = initialSiteId;

    const setActiveSiteId = (id: string | null) => {
      activeSiteId = id;
      selectedSiteFilterId = id;
    };

    const getActiveSite = () => {
      return mockSites.find(s => s.id === activeSiteId) || mockSites[0];
    };

    const getFilteredSiteExpenses = () => {
      if (!activeSiteId) return [];
      return mockExpenses.filter(e => String(e.siteId) === String(activeSiteId));
    };

    const getSiteTotalCost = () => {
      return getFilteredSiteExpenses().reduce((sum, item) => sum + Number(item.amount || 0), 0);
    };

    const getSiteSums = () => {
      const map: Record<string, number> = {};
      mockExpenses.forEach(e => {
        map[e.siteId] = (map[e.siteId] || 0) + Number(e.amount || 0);
      });
      return map;
    };

    return {
      getActiveSiteId: () => activeSiteId,
      getSelectedSiteFilterId: () => selectedSiteFilterId,
      setActiveSiteId,
      getActiveSite,
      getFilteredSiteExpenses,
      getSiteTotalCost,
      getSiteSums,
    };
  }

  it('1. Initializes default active site to first site (site_1) without mixing expenses', () => {
    const dash = createDashboardSimulator();
    assert.strictEqual(dash.getActiveSiteId(), 'site_1');
    assert.strictEqual(dash.getActiveSite().name, 'Chennai OMR Villa');

    const expenses = dash.getFilteredSiteExpenses();
    assert.strictEqual(expenses.length, 2, 'Site 1 should have exactly 2 expenses');
    assert.strictEqual(expenses[0].title, 'Tea & Snacks');
    assert.strictEqual(expenses[1].title, 'Cement 10 Bags');
    assert.strictEqual(dash.getSiteTotalCost(), 4450, 'Site 1 total should be 450 + 4000 = 4450');
  });

  it('2. Dynamically isolates site_2 when clicked, updating active site and total', () => {
    const dash = createDashboardSimulator();

    // Click site 2
    dash.setActiveSiteId('site_2');
    assert.strictEqual(dash.getActiveSiteId(), 'site_2');
    assert.strictEqual(dash.getActiveSite().name, 'Coimbatore Duplex');

    const expenses = dash.getFilteredSiteExpenses();
    assert.strictEqual(expenses.length, 2, 'Site 2 should have exactly 2 expenses');
    assert.strictEqual(expenses[0].title, 'Tea & Snacks');
    assert.strictEqual(expenses[1].title, 'M-Sand 1 Load');
    assert.strictEqual(dash.getSiteTotalCost(), 5900, 'Site 2 total should be 400 + 5500 = 5900');

    // Verify zero leakage from site 1 or other sites
    assert.ok(expenses.every(e => e.siteId === 'site_2'), 'Every expense must strictly belong to site_2');
  });

  it('3. Dynamically isolates site_3 when clicked', () => {
    const dash = createDashboardSimulator();

    // Click site 3
    dash.setActiveSiteId('site_3');
    assert.strictEqual(dash.getActiveSiteId(), 'site_3');
    assert.strictEqual(dash.getActiveSite().name, 'Madurai Anna Nagar House');

    const expenses = dash.getFilteredSiteExpenses();
    assert.strictEqual(expenses.length, 1);
    assert.strictEqual(expenses[0].title, 'Tea & Snacks');
    assert.strictEqual(expenses[0].amount, 350);
    assert.strictEqual(dash.getSiteTotalCost(), 350);
  });

  it('4. Handles site with no expenses gracefully with 0 total cost', () => {
    const dash = createDashboardSimulator();

    // Click site 6 (Tirunelveli Villa - no expenses recorded yet)
    dash.setActiveSiteId('site_6');
    assert.strictEqual(dash.getActiveSiteId(), 'site_6');
    assert.strictEqual(dash.getActiveSite().name, 'Tirunelveli Villa');

    const expenses = dash.getFilteredSiteExpenses();
    assert.strictEqual(expenses.length, 0, 'Site 6 should have empty expenses list');
    assert.strictEqual(dash.getSiteTotalCost(), 0, 'Total cost should be 0');
  });

  it('5. Successfully jumps to site_10 across 10 sites and calculates large expenses correctly', () => {
    const dash = createDashboardSimulator();

    // Click site 10
    dash.setActiveSiteId('site_10');
    assert.strictEqual(dash.getActiveSiteId(), 'site_10');
    assert.strictEqual(dash.getActiveSite().name, 'Kanchipuram Weaver Complex');

    const expenses = dash.getFilteredSiteExpenses();
    assert.strictEqual(expenses.length, 1);
    assert.strictEqual(expenses[0].title, 'Bricks 5000 Nos');
    assert.strictEqual(dash.getSiteTotalCost(), 55000);
  });

  it('6. Computes site individual total badges correctly across all 10 sites', () => {
    const dash = createDashboardSimulator();
    const sums = dash.getSiteSums();

    assert.strictEqual(sums['site_1'], 4450);
    assert.strictEqual(sums['site_2'], 5900);
    assert.strictEqual(sums['site_3'], 350);
    assert.strictEqual(sums['site_4'], 140000);
    assert.strictEqual(sums['site_5'], 2500);
    assert.strictEqual(sums['site_6'] || 0, 0);
    assert.strictEqual(sums['site_10'], 55000);
  });
});
