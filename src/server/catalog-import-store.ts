import type { PoolClient } from 'pg';
import type { CatalogRow } from './excel-catalog.ts';

/** Caller owns the catalog lock and transaction. Used by agent and Excel imports. */
export async function insertCatalogRows(c: PoolClient, rows: CatalogRow[]) {
  const products: { row: number; productId: string; recipeId: string | null; version: number }[] = [];
  for (const row of rows) {
    await c.query('INSERT INTO catalog_products(id,reference,kind,current_version,active_recipe_version) VALUES($1,$2,$3,1,$4)', [row.product.id, row.product.reference, row.product.type, row.recipe ? 1 : null]);
    await c.query('INSERT INTO product_versions(product_id,version,data) VALUES($1,1,$2)', [row.product.id, JSON.stringify(row.product)]);
    if (row.product.type === 'finished') await c.query("INSERT INTO inventory_items(id,name,reference,kind,base_unit) VALUES($1,$2,$3,'finished','unit')", [row.product.id, row.product.name, row.product.reference]);
    if (row.recipe) await c.query('INSERT INTO recipe_versions(id,product_id,version,data) VALUES($1,$2,1,$3)', [row.recipe.id, row.product.id, JSON.stringify(row.recipe)]);
    products.push({ row: row.row, productId: row.product.id, recipeId: row.recipe?.id ?? null, version: 1 });
  }
  return products;
}
