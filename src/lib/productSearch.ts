export type ProductSource = "Open Food Facts" | "Open Beauty Facts" | "Open Products Facts" | "BioTechUSA" | "Bambu Lab";
export type ProductHit = { id: string; name: string; brand: string; barcode: string; description: string; image: string; source: ProductSource; quantity?: string };

type ApiProduct = { code?: string; product?: { product_name?: string; product_name_de?: string; brands?: string; quantity?: string; generic_name?: string; generic_name_de?: string; image_front_url?: string; image_url?: string } };
type SearchResponse = { products?: Array<{ code?: string; product_name?: string; product_name_de?: string; brands?: string; quantity?: string; generic_name?: string; generic_name_de?: string; image_front_url?: string; image_url?: string }> };

const curated: ProductHit[] = [
  ...["100% Pure Whey", "Iso Whey Zero", "Iso Whey Zero Clear", "Hydro Whey Zero", "Micellar Casein", "Beef Protein", "Vegan Protein", "Iso Whey Zero Black", "Protein Power"].map(name => ({ id: `bio-${name}`, name, brand: "BioTechUSA", barcode: "", description: "Protein-/Sporternährungsprodukt – Geschmack und Packungsgröße beim Erfassen ergänzen.", image: "", source: "BioTechUSA" as const })),
  ...["PLA Basic", "PLA Matte", "PLA Silk", "PLA Tough", "PLA-CF", "PETG Basic", "PETG HF", "PETG-CF", "ABS", "ASA", "TPU 95A HF", "PAHT-CF", "PA6-GF", "Support for PLA", "Support for PA/PET"].map(name => ({ id: `bambu-${name}`, name, brand: "Bambu Lab", barcode: "", description: "3D-Druck-Filament – Materialfarbe, Spulengewicht und Refill/Vollspule ergänzen.", image: "", source: "Bambu Lab" as const })),
];

function normalize(row: NonNullable<ApiProduct["product"]> & { code?: string }, source: ProductSource): ProductHit | null {
  const name = row.product_name_de || row.product_name || row.generic_name_de || row.generic_name || "";
  if (!name.trim()) return null;
  return { id: `${source}-${row.code ?? name}`, name, brand: row.brands ?? "", barcode: row.code ?? "", description: [row.generic_name_de || row.generic_name, row.quantity].filter(Boolean).join(" · "), image: row.image_front_url || row.image_url || "", source, quantity: row.quantity };
}

async function searchOpenFacts(base: string, source: ProductSource, query: string): Promise<ProductHit[]> {
  const url = `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,product_name_de,brands,quantity,generic_name,generic_name_de,image_front_url,image_url`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  const data = await response.json() as SearchResponse;
  return (data.products ?? []).map(row => normalize(row, source)).filter((item): item is ProductHit => Boolean(item));
}

async function lookupOpenFacts(base: string, source: ProductSource, barcode: string): Promise<ProductHit[]> {
  const apiVersion = source === "Open Food Facts" ? "v3" : "v2";
  const response = await fetch(`${base}/api/${apiVersion}/product/${encodeURIComponent(barcode)}.json`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  const data = await response.json() as ApiProduct & { status?: number };
  const hit = data.status === 1 && data.product ? normalize({ ...data.product, code: data.code ?? barcode }, source) : null;
  return hit ? [hit] : [];
}

export async function searchProducts(query: string): Promise<{ hits: ProductHit[]; errors: string[] }> {
  const q = query.trim();
  if (!q) return { hits: [], errors: [] };
  const isBarcode = /^[0-9]{8,14}$/.test(q);
  const sources: Array<[string, ProductSource]> = [
    ["https://world.openfoodfacts.org", "Open Food Facts"],
    ["https://world.openbeautyfacts.org", "Open Beauty Facts"],
    ["https://world.openproductsfacts.org", "Open Products Facts"],
  ];
  const settled = await Promise.allSettled(sources.map(([base, source]) => isBarcode ? lookupOpenFacts(base, source, q) : searchOpenFacts(base, source, q)));
  const hits: ProductHit[] = [];
  const errors: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") hits.push(...result.value);
    else errors.push(`${sources[index][1]}: ${result.reason instanceof Error ? result.reason.message : "nicht erreichbar"}`);
  });
  if (!isBarcode) {
    const needle = q.toLocaleLowerCase();
    hits.push(...curated.filter(item => `${item.name} ${item.brand}`.toLocaleLowerCase().includes(needle)));
  } else {
    hits.push(...curated.filter(item => item.barcode === q));
  }
  const seen = new Set<string>();
  return { hits: hits.filter(hit => { const key = `${hit.name.toLowerCase()}|${hit.brand.toLowerCase()}|${hit.barcode}`; if (seen.has(key)) return false; seen.add(key); return true; }), errors };
}
