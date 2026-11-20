import type { Language } from "./types";

const translations = {
  de: {
    dashboard: "Übersicht", inventory: "Lagerbestand", categories: "Kategorien",
    shopping: "Einkaufsliste", settings: "Einstellungen", greeting: "Dein Zuhause. Dein Überblick.",
    subtitle: "Alles Wichtige im Blick – damit beim Einkaufen nichts fehlt.",
    totalItems: "Artikel insgesamt", lowStock: "Niedriger Bestand", categoriesCount: "Kategorien",
    unitsInStock: "Stück auf Lager", search: "Artikel oder Barcode suchen …", addItem: "Artikel hinzufügen",
    allCategories: "Alle Kategorien", item: "Artikel", quantity: "Menge", location: "Lagerort",
    status: "Bestand", actions: "Aktionen", inStock: "Auf Lager", low: "Wird knapp", empty: "Nicht vorhanden",
    edit: "Bearbeiten", delete: "Löschen", cancel: "Abbrechen", save: "Speichern", create: "Hinzufügen",
    name: "Name", category: "Kategorie", minimum: "Mindestbestand", description: "Beschreibung",
    barcode: "Barcode (optional)", notes: "Notizen", chooseCategory: "Kategorie auswählen",
    noItems: "Keine Artikel gefunden.", recent: "Zuletzt geändert", attention: "Das solltest du nachkaufen",
    noAlerts: "Alles im grünen Bereich! Dein Bestand sieht gut aus.",
    demo: "Demomodus", demoHint: "Deine Änderungen werden in diesem Browser gespeichert.",
    categoryManager: "Kategorien verwalten", newCategory: "Neue Kategorie", parentCategory: "Übergeordnete Kategorie",
    rootCategory: "Keine (Hauptkategorie)", addCategory: "Kategorie anlegen", emptyCategory: "Noch keine Kategorien vorhanden.",
    deleteConfirm: "Diesen Artikel wirklich löschen?", unit: "Einheit", pieces: "Stück",
    welcome: "Willkommen zurück", language: "Sprache", darkMode: "Dunkles Design",
    comingSoon: "Kommt in einer späteren Version.", shoppingHint: "Die Einkaufsliste wird in einer der nächsten Versionen ergänzt.",
  },
  en: {
    dashboard: "Dashboard", inventory: "Inventory", categories: "Categories",
    shopping: "Shopping list", settings: "Settings", greeting: "Your home. Your overview.",
    subtitle: "Keep track of essentials – so nothing gets missed while shopping.",
    totalItems: "Items", lowStock: "Low stock", categoriesCount: "Categories",
    unitsInStock: "pieces in stock", search: "Search items or barcode …", addItem: "Add item",
    allCategories: "All categories", item: "Item", quantity: "Quantity", location: "Location",
    status: "Stock", actions: "Actions", inStock: "In stock", low: "Running low", empty: "Out of stock",
    edit: "Edit", delete: "Delete", cancel: "Cancel", save: "Save", create: "Add",
    name: "Name", category: "Category", minimum: "Minimum stock", description: "Description",
    barcode: "Barcode (optional)", notes: "Notes", chooseCategory: "Choose category",
    noItems: "No items found.", recent: "Recently updated", attention: "Consider restocking",
    noAlerts: "All good! Your inventory looks healthy.",
    demo: "Demo mode", demoHint: "Your changes are saved in this browser.",
    categoryManager: "Manage categories", newCategory: "New category", parentCategory: "Parent category",
    rootCategory: "None (top-level)", addCategory: "Create category", emptyCategory: "No categories yet.",
    deleteConfirm: "Are you sure you want to delete this item?", unit: "Unit", pieces: "Pieces",
    welcome: "Welcome back", language: "Language", darkMode: "Dark appearance",
    comingSoon: "Coming in a future version.", shoppingHint: "The shopping list will be added in a future version.",
  },
} satisfies Record<Language, Record<string, string>>;

export function t(language: Language, key: keyof typeof translations.de): string {
  return translations[language][key] ?? translations.de[key];
}
