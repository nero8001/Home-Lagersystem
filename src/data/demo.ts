import type { Category, InventoryItem } from "../types";

export const demoCategories: Category[] = [
  { id: "cat-kitchen", name: "Küche", parentId: null },
  { id: "cat-food", name: "Lebensmittel", parentId: "cat-kitchen" },
  { id: "cat-household", name: "Haushalt", parentId: "cat-kitchen" },
  { id: "cat-3d", name: "3D-Drucker", parentId: null },
  { id: "cat-filament", name: "Filament", parentId: "cat-3d" },
  { id: "cat-pc", name: "PC-Teile", parentId: null },
];

export const demoItems: InventoryItem[] = [
  { id: "item-1", name: "Spaghetti", description: "500-g-Packung", categoryId: "cat-food", quantity: 4, unit: "Stück", minQuantity: 2, location: "Küchenschrank", barcode: "", notes: "", updatedAt: new Date().toISOString() },
  { id: "item-2", name: "Tomaten aus der Dose", description: " gehackt, 400 g", categoryId: "cat-food", quantity: 1, unit: "Stück", minQuantity: 3, location: "Küchenschrank", barcode: "", notes: "", updatedAt: new Date().toISOString() },
  { id: "item-3", name: "PLA Filament – Schwarz", description: "1 kg Rolle", categoryId: "cat-filament", quantity: 3, unit: "Stück", minQuantity: 1, location: "3D-Drucker-Regal", barcode: "", notes: "", updatedAt: new Date().toISOString() },
  { id: "item-4", name: "USB-C-Kabel", description: "1 m, USB 3.2", categoryId: "cat-pc", quantity: 2, unit: "Stück", minQuantity: 2, location: "Schreibtisch", barcode: "", notes: "", updatedAt: new Date().toISOString() },
  { id: "item-5", name: "Spülmaschinentabs", description: "Packung", categoryId: "cat-household", quantity: 0, unit: "Stück", minQuantity: 1, location: "Unter der Spüle", barcode: "", notes: "", updatedAt: new Date().toISOString() },
];
