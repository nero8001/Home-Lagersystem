import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive, Boxes, ChevronDown, ChevronRight, CircleAlert,
  LayoutDashboard, Languages, MapPin, Menu, Moon, PackagePlus, Pencil,
  Plus, Search, Settings, ShoppingCart, Sun, Trash2, X, Minus, Check,
  Layers3, ArrowUpRight, Package
} from "lucide-react";
import type { Category, InventoryItem, Language } from "./types";
import { demoCategories, demoItems } from "./data/demo";
import { t } from "./i18n";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";

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

function InventoryApp({ user, householdId, onSignOut }: { user: User; householdId: string; onSignOut: () => void }) {
  const [language, setLanguage] = useState<Language>(() => readStored("lager-language", "de"));
  const [items, setItems] = useState<InventoryItem[]>(() => readStored("lager-items", demoItems));
  const [categories, setCategories] = useState<Category[]>(() => readStored("lager-categories", demoCategories));
  const [cloudStatus, setCloudStatus] = useState<"loading" | "synced" | "error">("loading");
  const [cloudError, setCloudError] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() =>
    new Set(readStored<Category[]>("lager-categories", demoCategories).map(category => category.id))
  );
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

  // Load the selected household's cloud data and listen for changes from other devices.
  useEffect(() => {
    let active = true;
    const client = supabase;
    if (!client) { setCloudStatus("error"); setCloudError("Supabase ist nicht konfiguriert."); return; }
    setCloudStatus("loading");
    const loadHouseholdData = async () => {
      const [categoryResult, itemResult] = await Promise.all([
        client.from("categories").select("id,name,parent_id").eq("household_id", householdId).order("name"),
        client.from("inventory_items").select("id,name,description,category_id,quantity,unit,min_quantity,location,barcode,notes,updated_at").eq("household_id", householdId).order("updated_at", { ascending: false }),
      ]);
      if (!active) return;
      if (categoryResult.error || itemResult.error) {
        const error = categoryResult.error ?? itemResult.error;
        console.error("Supabase load error", error);
        setCloudStatus("error");
        setCloudError(error.message);
        return;
      }
      setCloudError("");
      setCloudStatus("synced");
      setCategories((categoryResult.data ?? []).map(row => ({ id: row.id, name: row.name, parentId: row.parent_id })));
      setExpandedCategoryIds(new Set((categoryResult.data ?? []).map(row => row.id)));
      setItems((itemResult.data ?? []).map(row => ({
        id: row.id, name: row.name, description: row.description ?? "", categoryId: row.category_id,
        quantity: Number(row.quantity), unit: row.unit, minQuantity: Number(row.min_quantity),
        location: row.location ?? "", barcode: row.barcode ?? "", notes: row.notes ?? "", updatedAt: row.updated_at,
      })));
    };
    void loadHouseholdData();
    const channel = client.channel(`household-${householdId}-inventory`)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `household_id=eq.${householdId}` }, () => { void loadHouseholdData(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter: `household_id=eq.${householdId}` }, () => { void loadHouseholdData(); })
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [householdId, language]);

  async function persistItem(item: InventoryItem) {
    if (!supabase) return;
    const { error } = await supabase.from("inventory_items").upsert({
      id: item.id, household_id: householdId, name: item.name, description: item.description || null,
      category_id: item.categoryId, quantity: item.quantity, unit: item.unit,
      min_quantity: item.minQuantity, location: item.location || null, barcode: item.barcode || null,
      notes: item.notes || null, updated_at: new Date().toISOString(),
    });
    if (error) { console.error(error); window.alert(language === "de" ? "Artikel konnte nicht synchronisiert werden: " + error.message : "Could not sync item: " + error.message); }
  }

  async function persistCategory(category: Category) {
    if (!supabase) return;
    const { error } = await supabase.from("categories").upsert({ id: category.id, household_id: householdId, name: category.name, parent_id: category.parentId });
    if (error) { console.error(error); window.alert(language === "de" ? "Kategorie konnte nicht synchronisiert werden: " + error.message : "Could not sync category: " + error.message); }
  }

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
    const savedItem: InventoryItem = { ...clean, id: editingId ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
    setItems(current => editingId ? current.map(item => item.id === editingId ? savedItem : item) : [savedItem, ...current]);
    void persistItem(savedItem);
    setModalOpen(false);
  }

  function changeQuantity(id: string, delta: number) {
    const current = items.find(item => item.id === id);
    if (!current) return;
    const updated = { ...current, quantity: Math.max(0, current.quantity + delta), updatedAt: new Date().toISOString() };
    setItems(list => list.map(item => item.id === id ? updated : item));
    void persistItem(updated);
  }

  function setQuantity(id: string, value: number) {
    const current = items.find(item => item.id === id);
    if (!current) return;
    const updated = { ...current, quantity: Math.max(0, Number.isFinite(value) ? value : 0), updatedAt: new Date().toISOString() };
    setItems(list => list.map(item => item.id === id ? updated : item));
    void persistItem(updated);
  }

  async function deleteItem(id: string) {
    if (!window.confirm(tr("deleteConfirm"))) return;
    setItems(current => current.filter(item => item.id !== id));
    if (supabase) {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id).eq("household_id", householdId);
      if (error) window.alert(error.message);
    }
  }

  function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    const newCategory: Category = { id: crypto.randomUUID(), name: categoryName.trim(), parentId: parentCategory || null };
    setCategories(current => [...current, newCategory]);
    void persistCategory(newCategory);
    if (newCategory.parentId) {
      setExpandedCategoryIds(current => new Set([...current, newCategory.parentId!]));
    }
    setCategoryName("");
    setParentCategory("");
  }

  function getDescendantIds(categoryId: string): string[] {
    const children = categories.filter(category => category.parentId === categoryId);
    return children.flatMap(child => [child.id, ...getDescendantIds(child.id)]);
  }

  function getCategoryItemCount(categoryId: string): number {
    const relatedIds = [categoryId, ...getDescendantIds(categoryId)];
    return items.filter(item => item.categoryId !== null && relatedIds.includes(item.categoryId)).length;
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategoryIds(current => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function renderCategoryTree(category: Category, depth = 0): ReactNode {
    const children = categories.filter(child => child.parentId === category.id);
    const hasChildren = children.length > 0;
    const expanded = expandedCategoryIds.has(category.id);
    const count = getCategoryItemCount(category.id);
    return (
      <div className="category-tree-node" key={category.id}>
        <div className={`category-entry ${depth > 0 ? "nested" : ""}`} style={{ paddingLeft: `${5 + depth * 25}px` }}>
          {hasChildren ? (
            <button type="button" className="tree-toggle" onClick={() => toggleCategory(category.id)}
              aria-label={expanded ? (language === "de" ? `${category.name} zuklappen` : `Collapse ${category.name}`) : (language === "de" ? `${category.name} aufklappen` : `Expand ${category.name}`)}
              aria-expanded={expanded} title={expanded ? (language === "de" ? "Zuklappen" : "Collapse") : (language === "de" ? "Aufklappen" : "Expand")}>
              {expanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
            </button>
          ) : <span className="tree-toggle-placeholder"/>}
          {depth === 0
            ? <div className="category-icon"><Archive size={17}/></div>
            : <span className="tree-line" aria-hidden="true">↳</span>}
          <strong>{category.name}</strong>
          <span className="category-item-count">{count} {language === "de" ? "Artikel" : "items"}</span>
          <div className="category-actions">
            <button type="button" onClick={() => renameCategory(category)} aria-label={language === "de" ? `Kategorie ${category.name} umbenennen` : `Rename category ${category.name}`} title={tr("edit")}><Pencil size={14}/></button>
            <button type="button" onClick={() => removeCategory(category)} aria-label={language === "de" ? `Kategorie ${category.name} löschen` : `Delete category ${category.name}`} title={tr("delete")}><Trash2 size={14}/></button>
          </div>
        </div>
        {hasChildren && expanded && <div className="category-children">{children.map(child => renderCategoryTree(child, depth + 1))}</div>}
      </div>
    );
  }

  function renameCategory(category: Category) {
    const nextName = window.prompt(language === "de" ? "Neuer Kategoriename:" : "New category name:", category.name);
    if (nextName === null || !nextName.trim()) return;
    const updated = { ...category, name: nextName.trim() };
    setCategories(current => current.map(entry => entry.id === category.id ? updated : entry));
    void persistCategory(updated);
  }

  function removeCategory(category: Category) {
    const hasChildren = categories.some(entry => entry.parentId === category.id);
    const hasItems = items.some(item => item.categoryId === category.id);
    if (hasChildren || hasItems) {
      window.alert(language === "de"
        ? "Diese Kategorie kann noch nicht gelöscht werden. Bitte verschiebe zuerst ihre Unterkategorien und Artikel in andere Kategorien."
        : "This category cannot be deleted yet. Move its subcategories and items to other categories first.");
      return;
    }
    if (window.confirm(language === "de" ? `Kategorie „${category.name}“ wirklich löschen?` : `Delete category “${category.name}”?`)) {
      setCategories(current => current.filter(entry => entry.id !== category.id));
      if (supabase) void supabase.from("categories").delete().eq("id", category.id).eq("household_id", householdId);
    }
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
          <div className="profile-row"><div className="avatar">{(user.email ?? "U").slice(0,1).toUpperCase()}</div><div><strong>{user.email ?? tr("welcome")}</strong><small>{language === "de" ? "Synchronisiert" : "Synced"}</small></div><button className="signout-mini" onClick={onSignOut}>{language === "de" ? "Abmelden" : "Sign out"}</button></div>
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Menü schließen"/>}

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Menü öffnen"><Menu size={20}/></button>
          <div className="breadcrumb">LagerZuhause <span>/</span> {navItems.find(n => n.id === page)?.label ?? tr("settings")}</div>
          <div className="top-actions">
            <span className={`sync-status ${cloudStatus}`} title={cloudError || undefined}><span/> {cloudStatus === "loading" ? (language === "de" ? "Cloud lädt …" : "Loading cloud …") : cloudStatus === "error" ? (language === "de" ? "Cloud-Fehler" : "Cloud error") : (language === "de" ? "Cloud synchronisiert" : "Cloud synced")}</span>
            <button className="icon-button" onClick={() => setLanguage(language === "de" ? "en" : "de")} title={tr("language")}><Languages size={18}/><small>{language.toUpperCase()}</small></button>
            <button className="icon-button" onClick={() => setDark(!dark)} title="Design wechseln">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <div className="top-avatar">L</div>
          </div>
        </header>

        <div className="content">
          {cloudStatus === "error" && <div className="cloud-error-banner" role="status"><strong>{language === "de" ? "Cloud-Daten konnten nicht geladen werden" : "Could not load cloud data"}</strong><span>{cloudError}</span><small>{language === "de" ? "Bitte Datenbankrechte und RLS-Richtlinien prüfen. Lokale Demodaten werden nicht als synchronisiert angezeigt." : "Please check database grants and RLS policies. Local demo data is not shown as synced."}</small></div>}
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
              <section className="panel category-list-panel"><div className="panel-heading"><div><h2>{tr("categoryManager")}</h2><p>{categories.length} {tr("categoriesCount").toLowerCase()}</p></div><div className="tree-toolbar"><button type="button" className="tree-tool-button" onClick={() => setExpandedCategoryIds(new Set(categories.map(category => category.id)))}>{language === "de" ? "Alle aufklappen" : "Expand all"}</button><button type="button" className="tree-tool-button" onClick={() => setExpandedCategoryIds(new Set())}>{language === "de" ? "Alle zuklappen" : "Collapse all"}</button></div></div><div className="category-tree">{categories.filter(category => !category.parentId || !categories.some(parent => parent.id === category.parentId)).map(category => renderCategoryTree(category))}</div></section>
            </div>
          </>}

          {page === "shopping" && <section className="panel coming-panel"><div className="coming-icon"><ShoppingCart size={27}/></div><h1>{tr("shopping")}</h1><p>{tr("shoppingHint")}</p><span className="coming-tag">{tr("comingSoon")}</span></section>}

          {page === "settings" && <><div className="page-heading"><div><div className="eyebrow">{tr("settings").toUpperCase()}</div><h1>{tr("settings")}</h1><p>{language === "de" ? "Passe deine Lagerverwaltung an." : "Customize your inventory app."}</p></div></div><section className="panel settings-panel"><div className="setting-row"><div><strong>{tr("language")}</strong><small>Deutsch / English</small></div><select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="de">Deutsch</option><option value="en">English</option></select></div><div className="setting-row"><div><strong>{tr("darkMode")}</strong><small>{language === "de" ? "Dunkle Oberfläche aktivieren" : "Enable dark appearance"}</small></div><button className="secondary-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? "Light" : "Dark"}</button></div><div className="setting-row"><div><strong>Supabase</strong><small>{language === "de" ? "Deine Daten werden mit diesem Haushalt synchronisiert." : "Your data is synced with this household."}</small></div><span className="connection-pill connected">Connected</span></div></section></>}
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
  return <div className="table-wrap"><table><thead><tr><th>{tr("item")}</th>{!compact && <th>{tr("category")}</th>}<th>{tr("quantity")}</th><th>{tr("status")}</th>{!compact && <th>{tr("location")}</th>}<th></th></tr></thead><tbody>{items.map(item => { const state = status(item); return <tr key={item.id}><td><div className="item-cell"><div className="item-icon"><Package size={17}/></div><div><strong>{item.name}</strong><small>{item.description || categoryLabel(item.categoryId)}</small></div></div></td>{!compact && <td className="category-cell">{categoryLabel(item.categoryId)}</td>}<td><div className="quantity-control"><button onClick={() => onChange(item.id, -1)} aria-label="Menge verringern"><Minus size={13}/></button><input aria-label={`${tr("quantity")} ${item.name}`} type="number" min="0" value={item.quantity} onChange={e => onSet(item.id, Number(e.target.value))}/><button onClick={() => onChange(item.id, 1)} aria-label="Menge erhöhen"><Plus size={13}/></button><small>{item.unit}</small></div></td><td><span className={`status-pill ${state.cls}`}><span/>{state.label}</span></td>{!compact && <td className="location-cell">{item.location ? <span className="location-content"><MapPin size={13}/>{item.location}</span> : "–"}</td>}<td><div className="row-actions"><button onClick={() => onEdit(item)} aria-label={tr("edit")} title={tr("edit")}><Pencil size={15}/></button><button onClick={() => onDelete(item.id)} aria-label={tr("delete")} title={tr("delete")}><Trash2 size={15}/></button></div></td></tr>; })}</tbody></table>{items.length === 0 && <div className="table-empty"><PackagePlus size={25}/><strong>{tr("noItems")}</strong></div>}</div>;
}

export default App;


function App() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsHousehold, setNeedsHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("Mein Zuhause");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user ?? null)).finally(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSessionUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabase || !sessionUser) { setHouseholdId(null); setNeedsHousehold(false); return; }
    (async () => {
      const { data, error } = await supabase.from("household_members").select("household_id, households(id,name)").eq("user_id", sessionUser.id).limit(1).maybeSingle();
      if (!active) return;
      if (error) { setAuthMessage(error.message); return; }
      if (data?.household_id) {
        setHouseholdId(data.household_id);
        setNeedsHousehold(false);
        const household = Array.isArray(data.households) ? data.households[0] : data.households;
        if (household?.name) setNewHouseholdName(household.name);
      } else {
        setHouseholdId(null);
        setNeedsHousehold(true);
      }
    })();
    return () => { active = false; };
  }, [sessionUser]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true); setAuthMessage("");
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/` } })
      : await supabase.auth.signInWithPassword({ email, password });
    setAuthBusy(false);
    if (result.error) setAuthMessage(result.error.message);
    else if (authMode === "signup" && !result.data.session) setAuthMessage("Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse und melde dich anschließend an.");
  }

  async function createHousehold(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !newHouseholdName.trim()) return;
    setAuthBusy(true); setAuthMessage("");
    const { data, error } = await supabase.rpc("create_household", { household_name: newHouseholdName.trim() });
    setAuthBusy(false);
    if (error) setAuthMessage(error.message);
    else { setHouseholdId(data as string); setNeedsHousehold(false); }
  }

  async function resetPassword() {
    if (!supabase || !email.trim()) { setAuthMessage("Bitte gib zuerst deine E-Mail-Adresse ein."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setAuthMessage(error ? error.message : "Wir haben dir einen Link zum Zurücksetzen des Passworts geschickt.");
  }

  async function signOut() { await supabase?.auth.signOut(); setHouseholdId(null); }

  if (!isSupabaseConfigured || !supabase) {
    return <div className="auth-screen"><div className="auth-card"><div className="brand-mark auth-mark"><Boxes size={25}/></div><h1>Supabase noch nicht verbunden</h1><p>Trage zuerst die Supabase-Projekt-URL und den öffentlichen Publishable-/Anon-Key als Cloudflare-Environment-Variablen ein. Danach erscheint hier die Anmeldung.</p></div></div>;
  }
  if (loading) return <div className="auth-screen"><div className="auth-card">Verbindung wird hergestellt …</div></div>;
  if (!sessionUser) return <div className="auth-screen"><form className="auth-card" onSubmit={submitAuth}><div className="brand-mark auth-mark"><Boxes size={25}/></div><div className="eyebrow">LAGERZUHAUSE</div><h1>{authMode === "login" ? "Willkommen zurück" : "Konto erstellen"}</h1><p>{authMode === "login" ? "Melde dich an, um deinen Lagerbestand überall zu nutzen." : "Erstelle dein persönliches Konto für dein Zuhause."}</p><label>E-Mail-Adresse<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/></label><label>Passwort<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"}/></label>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? "Bitte warten …" : authMode === "login" ? "Anmelden" : "Registrieren"}</button><button type="button" className="auth-link" onClick={resetPassword}>Passwort vergessen?</button><div className="auth-switch">{authMode === "login" ? "Noch kein Konto?" : "Du hast bereits ein Konto?"} <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthMessage(""); }}>{authMode === "login" ? "Registrieren" : "Anmelden"}</button></div></form></div>;
  if (needsHousehold || !householdId) return <div className="auth-screen"><form className="auth-card" onSubmit={createHousehold}><div className="brand-mark auth-mark"><Boxes size={25}/></div><div className="eyebrow">FAST GESCHAFFT</div><h1>Dein erster Haushalt</h1><p>Ein Haushalt enthält deine Kategorien und Artikel. Später kannst du weitere Personen einladen.</p><label>Name des Haushalts<input required value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)}/></label>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? "Wird erstellt …" : "Haushalt erstellen"}</button><button type="button" className="auth-link" onClick={signOut}>Abmelden</button></form></div>;
  return <InventoryApp user={sessionUser} householdId={householdId} onSignOut={signOut}/>;
}
