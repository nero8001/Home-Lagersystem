import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive, Boxes, ChevronDown, CircleAlert,
  LayoutDashboard, Languages, MapPin, Menu, Moon, PackagePlus, Pencil,
  Plus, Search, Settings, ShoppingCart, Sun, Trash2, X, Minus, Check,
  Layers3, ArrowUpRight, Package
} from "lucide-react";
import type { Category, InventoryItem, Language } from "./types";
import { demoCategories, demoItems } from "./data/demo";
import { t } from "./i18n";
import { isSupabaseConfigured } from "./lib/supabase";

type Page = "dashboard" | "inventory" | "categories" | "shopping" | "settings";
type ItemForm = Omit<InventoryItem, "id" | "updatedAt">;

const blankItem: ItemForm = {
  name: "", description: "", categoryId: null, quantity: 1, unit: "Stück",
  minQuantity: 0, location: "", barcode: "", notes: "",
};

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [language, setLanguage] = useState<Language>(() => readStored("lager-language", "de"));
  const [items, setItems] = useState<InventoryItem[]>(() => readStored("lager-items", demoItems));
  const [categories, setCategories] = useState<Category[]>(() => readStored("lager-categories", demoCategories));
  const [page, setPage] = useState<Page>("dashboard");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(blankItem);
  const [categoryName, setCategoryName] = useState("");
  const [parentCategory, setParentCategory] = useState("");
  const [dark, setDark] = useState(() => readStored("lager-dark", false));
  const [mobileNav, setMobileNav] = useState(false);

  const tr = (key: Parameters<typeof t>[1]) => t(language, key);

  useEffect(() => localStorage.setItem("lager-items", JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem("lager-categories", JSON.stringify(categories)), [categories]);
  useEffect(() => localStorage.setItem("lager-language", JSON.stringify(language)), [language]);
  useEffect(() => localStorage.setItem("lager-dark", JSON.stringify(dark)), [dark]);

  const lowItems = items.filter(item => item.quantity <= item.minQuantity);
  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);

  const visibleItems = useMemo(() => items.filter(item => {
    const matchesSearch = `${item.name} ${item.description} ${item.barcode} ${item.location}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory ||
      categories.some(category => category.id === item.categoryId && category.parentId === selectedCategory);
    return matchesSearch && matchesCategory;
  }), [items, search, selectedCategory, categories]);

  function categoryLabel(id: string | null) {
    return categories.find(category => category.id === id)?.name ?? "–";
  }

  function openNewItem() {
    setEditingId(null);
    setForm(blankItem);
    setModalOpen(true);
  }

  function openEditItem(item: InventoryItem) {
    setEditingId(item.id);
    const { id: _id, updatedAt: _updatedAt, ...values } = item;
    setForm(values);
    setModalOpen(true);
  }

  function saveItem(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const clean = { ...form, name: form.name.trim(), quantity: Math.max(0, Number(form.quantity) || 0), minQuantity: Math.max(0, Number(form.minQuantity) || 0) };
    if (editingId) {
      setItems(current => current.map(item => item.id === editingId ? { ...item, ...clean, updatedAt: new Date().toISOString() } : item));
    } else {
      setItems(current => [{ ...clean, id: crypto.randomUUID(), updatedAt: new Date().toISOString() }, ...current]);
    }
    setModalOpen(false);
  }

  function changeQuantity(id: string, delta: number) {
    setItems(current => current.map(item => item.id === id
      ? { ...item, quantity: Math.max(0, item.quantity + delta), updatedAt: new Date().toISOString() }
      : item));
  }

  function setQuantity(id: string, value: number) {
    setItems(current => current.map(item => item.id === id
      ? { ...item, quantity: Math.max(0, Number.isFinite(value) ? value : 0), updatedAt: new Date().toISOString() }
      : item));
  }

  function deleteItem(id: string) {
    if (window.confirm(tr("deleteConfirm"))) setItems(current => current.filter(item => item.id !== id));
  }

  function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    setCategories(current => [...current, { id: crypto.randomUUID(), name: categoryName.trim(), parentId: parentCategory || null }]);
    setCategoryName("");
    setParentCategory("");
  }

  const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: tr("dashboard"), icon: LayoutDashboard },
    { id: "inventory", label: tr("inventory"), icon: Boxes },
    { id: "categories", label: tr("categories"), icon: Layers3 },
    { id: "shopping", label: tr("shopping"), icon: ShoppingCart },
  ];

  function goTo(next: Page) {
    setPage(next);
    setMobileNav(false);
    setSearch("");
    setSelectedCategory("all");
  }

  return (
    <div className={dark ? "app dark" : "app"}>
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={23} /></div>
          <div><strong>Lager<span>Zuhause</span></strong><small>PRIVATES LAGERSYSTEM</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Menü schließen"><X size={19}/></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => goTo(id)}>
              <Icon size={18}/><span>{label}</span>
              {id === "inventory" && <span className="nav-count">{items.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Archive size={17}/></div>
            <strong>Alles an seinem Platz.</strong>
            <p>Behalte deine Vorräte und wichtigen Dinge im Blick.</p>
          </div>
          <button className={`nav-link ${page === "settings" ? "active" : ""}`} onClick={() => goTo("settings")}><Settings size={18}/><span>{tr("settings")}</span></button>
          <div className="profile-row"><div className="avatar">L</div><div><strong>{tr("welcome")}</strong><small>{isSupabaseConfigured ? "Supabase vorbereitet" : tr("demo")}</small></div><ChevronDown size={16}/></div>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Menü schließen"/>}

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Menü öffnen"><Menu size={20}/></button>
          <div className="breadcrumb">LagerZuhause <span>/</span> {navItems.find(n => n.id === page)?.label ?? tr("settings")}</div>
          <div className="top-actions">
            <span className="sync-status"><span/> {isSupabaseConfigured ? "Backend bereit" : tr("demo")}</span>
            <button className="icon-button" onClick={() => setLanguage(language === "de" ? "en" : "de")} title={tr("language")}><Languages size={18}/><small>{language.toUpperCase()}</small></button>
            <button className="icon-button" onClick={() => setDark(!dark)} title="Design wechseln">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <div className="top-avatar">L</div>
          </div>
        </header>

        <div className="content">
          {page === "dashboard" && <>
            <div className="page-heading">
              <div><div className="eyebrow">DEIN PRIVATES LAGER</div><h1>{tr("greeting")}</h1><p>{tr("subtitle")}</p></div>
              <button className="primary-button" onClick={openNewItem}><Plus size={18}/>{tr("addItem")}</button>
            </div>
            <section className="stats-grid">
              <StatCard icon={<Package size={19}/>} label={tr("totalItems")} value={items.length.toString()} detail={`${totalPieces} ${tr("unitsInStock")}`} tone="teal"/>
              <StatCard icon={<CircleAlert size={19}/>} label={tr("lowStock")} value={lowItems.length.toString()} detail={language === "de" ? "Artikel benötigen Aufmerksamkeit" : "items need attention"} tone="orange"/>
              <StatCard icon={<Layers3 size={19}/>} label={tr("categoriesCount")} value={categories.length.toString()} detail={language === "de" ? "Haupt- und Unterkategorien" : "Main and subcategories"} tone="blue"/>
            </section>
            <div className="dashboard-grid">
              <section className="panel inventory-panel">
                <div className="panel-heading"><div><h2>{tr("recent")}</h2><p>{language === "de" ? "Deine zuletzt bearbeiteten Artikel" : "Your recently updated items"}</p></div><button className="text-button" onClick={() => goTo("inventory")}>{language === "de" ? "Alle anzeigen" : "View all"} <ArrowUpRight size={15}/></button></div>
                <ItemTable items={[...items].slice(0, 5)} categories={categories} onEdit={openEditItem} onDelete={deleteItem} onChange={changeQuantity} onSet={setQuantity} tr={tr} compact/>
              </section>
              <section className="panel alert-panel">
                <div className="panel-heading"><div><h2>{tr("attention")}</h2><p>{language === "de" ? "Dein Bestand im Blick" : "Keep an eye on your stock"}</p></div><div className="alert-heading-icon"><CircleAlert size={18}/></div></div>
                {lowItems.length ? <div className="alert-list">{lowItems.slice(0, 5).map(item => <div className="alert-item" key={item.id}><div className="alert-product-icon"><Package size={17}/></div><div className="alert-info"><strong>{item.name}</strong><small>{categoryLabel(item.categoryId)}</small></div><span className="alert-qty">{item.quantity} / {item.minQuantity}</span></div>)}</div> : <div className="empty-state"><div className="empty-check"><Check size={22}/></div><strong>{tr("noAlerts")}</strong></div>}
              </section>
            </div>
            <div className="demo-note"><span className="demo-dot"/><strong>{tr("demo")}</strong><span>{tr("demoHint")}</span></div>
          </>}

          {page === "inventory" && <>
            <div className="page-heading"><div><div className="eyebrow">{tr("inventory").toUpperCase()}</div><h1>{tr("inventory")}</h1><p>{language === "de" ? "Verwalte deine Artikel und behalte die Mengen im Blick." : "Manage your items and keep track of quantities."}</p></div><button className="primary-button" onClick={openNewItem}><Plus size={18}/>{tr("addItem")}</button></div>
            <section className="panel full-panel">
              <div className="toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr("search")}/>{search && <button onClick={() => setSearch("")}><X size={15}/></button>}</div><select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}><option value="all">{tr("allCategories")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? "　↳ " : ""}{c.name}</option>)}</select></div>
              <ItemTable items={visibleItems} categories={categories} onEdit={openEditItem} onDelete={deleteItem} onChange={changeQuantity} onSet={setQuantity} tr={tr}/>
              <div className="table-footer">{visibleItems.length} {language === "de" ? "Artikel angezeigt" : "items shown"}</div>
            </section>
          </>}

          {page === "categories" && <>
            <div className="page-heading"><div><div className="eyebrow">{tr("categories").toUpperCase()}</div><h1>{tr("categories")}</h1><p>{language === "de" ? "Organisiere dein Lager so, wie es zu deinem Zuhause passt." : "Organize your inventory to fit your home."}</p></div></div>
            <div className="category-layout">
              <section className="panel category-form-panel"><h2>{tr("newCategory")}</h2><form onSubmit={addCategory} className="stack-form"><label>{tr("name")}<input required value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder={language === "de" ? "z. B. Werkstatt" : "e.g. Workshop"}/></label><label>{tr("parentCategory")}<select value={parentCategory} onChange={e => setParentCategory(e.target.value)}><option value="">{tr("rootCategory")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="primary-button" type="submit"><Plus size={17}/>{tr("addCategory")}</button></form></section>
              <section className="panel category-list-panel"><div className="panel-heading"><div><h2>{tr("categoryManager")}</h2><p>{categories.length} {tr("categoriesCount").toLowerCase()}</p></div><Layers3 size={20} className="muted-icon"/></div>{categories.filter(c => !c.parentId).map(parent => <div className="category-group" key={parent.id}><div className="category-entry"><div className="category-icon"><Archive size={17}/></div><strong>{parent.name}</strong><span>{items.filter(i => i.categoryId === parent.id || categories.some(c => c.id === i.categoryId && c.parentId === parent.id)).length} {language === "de" ? "Artikel" : "items"}</span></div>{categories.filter(c => c.parentId === parent.id).map(child => <div className="category-entry child" key={child.id}><span className="tree-line">↳</span><strong>{child.name}</strong><span>{items.filter(i => i.categoryId === child.id).length} {language === "de" ? "Artikel" : "items"}</span></div>)}</div>)}</section>
            </div>
          </>}

          {page === "shopping" && <section className="panel coming-panel"><div className="coming-icon"><ShoppingCart size={27}/></div><h1>{tr("shopping")}</h1><p>{tr("shoppingHint")}</p><span className="coming-tag">{tr("comingSoon")}</span></section>}

          {page === "settings" && <><div className="page-heading"><div><div className="eyebrow">{tr("settings").toUpperCase()}</div><h1>{tr("settings")}</h1><p>{language === "de" ? "Passe deine Lagerverwaltung an." : "Customize your inventory app."}</p></div></div><section className="panel settings-panel"><div className="setting-row"><div><strong>{tr("language")}</strong><small>Deutsch / English</small></div><select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="de">Deutsch</option><option value="en">English</option></select></div><div className="setting-row"><div><strong>{tr("darkMode")}</strong><small>{language === "de" ? "Dunkle Oberfläche aktivieren" : "Enable dark appearance"}</small></div><button className="secondary-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? "Light" : "Dark"}</button></div><div className="setting-row"><div><strong>Supabase</strong><small>{isSupabaseConfigured ? "Projektvariablen erkannt – Cloud-Sync folgt." : "Noch nicht verbunden. Lokaler Demomodus ist aktiv."}</small></div><span className={`connection-pill ${isSupabaseConfigured ? "connected" : ""}`}>{isSupabaseConfigured ? "Configured" : "Demo"}</span></div></section></>}
        </div>
      </main>

      {modalOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}><form className="modal" onSubmit={saveItem}><div className="modal-header"><div><div className="eyebrow">{editingId ? tr("edit") : tr("addItem")}</div><h2>{editingId ? tr("edit") : tr("addItem")}</h2></div><button type="button" className="icon-button" onClick={() => setModalOpen(false)}><X size={20}/></button></div><div className="form-grid"><label className="wide">{tr("name")} *<input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={language === "de" ? "z. B. Küchenrolle" : "e.g. Paper towels"}/></label><label>{tr("category")}<select value={form.categoryId ?? ""} onChange={e => setForm({ ...form, categoryId: e.target.value || null })}><option value="">{tr("chooseCategory")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? "　↳ " : ""}{c.name}</option>)}</select></label><label>{tr("quantity")} ({tr("pieces")})<input type="number" min="0" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}/></label><label>{tr("minimum")}<input type="number" min="0" step="1" value={form.minQuantity} onChange={e => setForm({ ...form, minQuantity: Number(e.target.value) })}/></label><label>{tr("location")}<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={language === "de" ? "z. B. Kellerregal" : "e.g. Basement shelf"}/></label><label className="wide">{tr("description")}<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label><label className="wide">{tr("barcode")}<input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="EAN / UPC"/></label><label className="wide">{tr("notes")}<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>{tr("cancel")}</button><button className="primary-button" type="submit"><Check size={17}/>{editingId ? tr("save") : tr("create")}</button></div></form></div>}
    </div>
  );
}

function StatCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}

function ItemTable({ items, categories, onEdit, onDelete, onChange, onSet, tr, compact = false }: {
  items: InventoryItem[]; categories: Category[]; onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void; onChange: (id: string, delta: number) => void;
  onSet: (id: string, value: number) => void; tr: (key: Parameters<typeof t>[1]) => string; compact?: boolean;
}) {
  const categoryLabel = (id: string | null) => categories.find(c => c.id === id)?.name ?? "–";
  function status(item: InventoryItem) {
    if (item.quantity === 0) return { label: tr("empty"), cls: "empty" };
    if (item.quantity <= item.minQuantity) return { label: tr("low"), cls: "low" };
    return { label: tr("inStock"), cls: "good" };
  }
  return <div className="table-wrap"><table><thead><tr><th>{tr("item")}</th>{!compact && <th>{tr("category")}</th>}<th>{tr("quantity")}</th><th>{tr("status")}</th>{!compact && <th>{tr("location")}</th>}<th></th></tr></thead><tbody>{items.map(item => { const state = status(item); return <tr key={item.id}><td><div className="item-cell"><div className="item-icon"><Package size={17}/></div><div><strong>{item.name}</strong><small>{item.description || categoryLabel(item.categoryId)}</small></div></div></td>{!compact && <td className="category-cell">{categoryLabel(item.categoryId)}</td>}<td><div className="quantity-control"><button onClick={() => onChange(item.id, -1)} aria-label="Menge verringern"><Minus size={13}/></button><input aria-label={`${tr("quantity")} ${item.name}`} type="number" min="0" value={item.quantity} onChange={e => onSet(item.id, Number(e.target.value))}/><button onClick={() => onChange(item.id, 1)} aria-label="Menge erhöhen"><Plus size={13}/></button><small>{item.unit}</small></div></td><td><span className={`status-pill ${state.cls}`}><span/>{state.label}</span></td>{!compact && <td className="location-cell">{item.location ? <><MapPin size={13}/>{item.location}</> : "–"}</td>}<td><div className="row-actions"><button onClick={() => onEdit(item)} aria-label={tr("edit")} title={tr("edit")}><Pencil size={15}/></button><button onClick={() => onDelete(item.id)} aria-label={tr("delete")} title={tr("delete")}><Trash2 size={15}/></button></div></td></tr>; })}</tbody></table>{items.length === 0 && <div className="table-empty"><PackagePlus size={25}/><strong>{tr("noItems")}</strong></div>}</div>;
}

export default App;
