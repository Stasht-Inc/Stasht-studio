// tests/products/cathide.test.mjs — Show / Hide per product category (Chris, 16 Nov 2026, point 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryChooserChoices, categoryFilterChoices, leadShareManualItems, orderCategoriesForNav, pickerCategoryOf, visibleCategoryNames } from '../../utils/products.ts';

const cats = [
  { id: 1, name: 'Sofas', hidden: false },
  { id: 2, name: 'Seasonal', hidden: true },
  { id: 3, name: 'Chairs' }, // an API from before the SQL: no hidden key
  { id: 4, name: 'Clearance', hidden: true },
];

test('the Products column lists shown categories first, then the hidden ones, each in the API order', () => {
  assert.deepEqual(orderCategoriesForNav(cats).map((c) => c.id), [1, 3, 2, 4]);
});

test('the All Categories dropdown leaves hidden ones out, except the one being shown', () => {
  assert.deepEqual(categoryFilterChoices(cats, null).map((c) => c.id), [1, 3]);
  assert.deepEqual(categoryFilterChoices(cats, 2).map((c) => c.id), [1, 2, 3]);
});

test('the editor offers hidden categories only when the product already has them', () => {
  assert.deepEqual(categoryChooserChoices(cats).map((c) => c.id), [1, 3]);
  assert.deepEqual(categoryChooserChoices(cats, [4]).map((c) => c.id), [1, 3, 4]);
});

test('pickers: a product takes its first shown category, else its first one marked hidden', () => {
  assert.deepEqual(pickerCategoryOf({ category: null, categories: [{ id: 2, name: 'Seasonal', hidden: true }, { id: 1, name: 'Sofas' }] }), { category: 'Sofas' });
  assert.deepEqual(pickerCategoryOf({ category: null, categories: [{ id: 2, name: 'Seasonal', hidden: true }] }), { category: 'Seasonal', category_hidden: true });
  assert.deepEqual(pickerCategoryOf({ category: 'Raw', categories: [] }), { category: 'Raw' });
});

test('picker dropdowns list only shown categories; items of a hidden one are still there to pick', () => {
  const items = [{ category: 'Sofas' }, { category: 'Seasonal', category_hidden: true }, { category: ' Chairs ' }, { category: null }];
  assert.deepEqual(visibleCategoryNames(items), ['Chairs', 'Sofas']);
});

test('lead share manual items mark a hidden category and keep the old shape otherwise', () => {
  const base = { id: 1, user_id: 1, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'T', price: null,
    compare_at_price: null, currency: null, price_label: '', compare_at_label: '', price_on_request: false, show_price: true, main_image: 'x', images_count: 1,
    category: null, sku: null, brand: null, url: null, updated_at: null };
  const [shown, hidden] = leadShareManualItems([{ ...base, categories: [{ id: 1, name: 'Sofas' }] }, { ...base, id: 2, categories: [{ id: 2, name: 'Seasonal', hidden: true }] }]);
  assert.equal(shown.category, 'Sofas');
  assert.equal('category_hidden' in shown, false);
  assert.equal(hidden.category, 'Seasonal');
  assert.equal(hidden.category_hidden, true);
});
