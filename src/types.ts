export type Category = {
  id: string;
  name: string;
  parentId: string | null;
};

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  quantity: number;
  unit: string;
  minQuantity: number;
  location: string;
  barcode: string;
  notes: string;
  updatedAt: string;
};

export type Language = "de" | "en";
