import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive, Boxes, ChevronDown, ChevronRight, CircleAlert,
  LayoutDashboard, Languages, MapPin, Menu, Moon, PackagePlus, Pencil,
  Plus, Search, Settings, ShoppingCart, Sun, Trash2, X, Minus, Check, ScanBarcode,
  Layers3, ArrowUpRight, Package
} from "lucide-react";
import type { Category, InventoryItem, Language } from "./types";
import { demoCategories, demoItems } from "./data/demo";
import { t } from "./i18n";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { User } from "@supabase/supabase-js";
import { searchProducts, type ProductHit } from "./lib/productSearch";

type Page = "dashboard" | "inventory" | "categories" | "shopping" | "settings";
type ItemForm = Omit<InventoryItem, "id" | "updatedAt" | "quantity" | "minQuantity"> & { quantity: string; minQuantity: string };

const blankItem: ItemForm = {
  name: "", description: "", categoryId: null, quantity: "1", unit: "Stück",
  minQuantity: "0", location: "", barcode: "", notes: "",
};

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

type HouseholdOption = { id: string; name: string; role: string };

function InventoryApp({ user, householdId, householdName, households, onSwitchHousehold, onSignOut }: {
  user: User;
  householdId: string;
  householdName: string;
  households: HouseholdOption[];
  onSwitchHousehold: (id: string) => void;
  onSignOut: () => void;
}) {
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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"item" | "product-search">("item");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemForm>(blankItem);
  const [categoryName, setCategoryName] = useState("");
  const [parentCategory, setParentCategory] = useState("");
  const [dark, setDark] = useState(() => readStored("lager-dark", false));
  const [mobileNav, setMobileNav] = useState(false);
  const [showProductImages, setShowProductImages] = useState(() => readStored("lager-show-product-images", true));
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [joinCode, setJoinCode] = useState("");
  useEffect(() => { const code = new URLSearchParams(window.location.search).get("invite"); if (code) { setJoinCode(code.toUpperCase()); setPage("settings"); } }, []);
  const [memberRows, setMemberRows] = useState<Array<{ user_id: string; role: string; email: string | null }>>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; invited_email: string | null; code: string; expires_at: string; created_at: string; accepted_at: string | null; status: "pending" | "expired" | "accepted" }>>([]);
  const [householdRole, setHouseholdRole] = useState<string>(households.find(h => h.id === householdId)?.role ?? "member");
  const [householdNameEdit, setHouseholdNameEdit] = useState(householdName);


  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const handleBarcodeDetected = useCallback((value: string) => {
    if (scannerTarget === "product-search") { setProductQuery(value); setForm(current => ({ ...current, barcode: value })); }
    else setForm(current => ({ ...current, barcode: value }));
    setScannerOpen(false);
  }, [scannerTarget]);

  useEffect(() => localStorage.setItem("lager-items", JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem("lager-categories", JSON.stringify(categories)), [categories]);
  useEffect(() => localStorage.setItem("lager-language", JSON.stringify(language)), [language]);
  useEffect(() => localStorage.setItem("lager-dark", JSON.stringify(dark)), [dark]);
  useEffect(() => localStorage.setItem("lager-show-product-images", JSON.stringify(showProductImages)), [showProductImages]);

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
        setCloudError(categoryResult.error?.message ?? itemResult.error?.message ?? "Unbekannter Fehler beim Laden der Lagerdaten.");
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
    if (error) { console.error(error); window.alert(language === "de" ? "Artikel konnte nicht synchronisiert werden: " + error.message : "Could not sync item: " + error.message); return; }
    if (item.barcode.trim()) {
      const { error: catalogError } = await supabase.from("household_products").upsert({
        household_id: householdId, barcode: item.barcode.trim(), name: item.name,
        description: item.description || null, brand: null, image_url: null, updated_at: new Date().toISOString(),
      }, { onConflict: "household_id,barcode" });
      if (catalogError) console.error("Household product catalog sync error", catalogError);
    }
  }

  async function persistCategory(category: Category) {
    if (!supabase) return;
    const { error } = await supabase.from("categories").upsert({ id: category.id, household_id: householdId, name: category.name, parent_id: category.parentId });
    if (error) { console.error(error); window.alert(language === "de" ? "Kategorie konnte nicht synchronisiert werden: " + error.message : "Could not sync category: " + error.message); }
  }

  const canManageHousehold = householdRole === "owner" || householdRole === "admin";
  const isOwner = householdRole === "owner";

  async function refreshMembers() {
    if (!supabase) return;
    const [{ data, error }, inviteResult] = await Promise.all([
      supabase.rpc("list_household_members", { target_household: householdId }),
      supabase.rpc("list_household_invites", { target_household: householdId }),
    ]);
    if (error) { setInviteMessage(error.message); return; }
    setMemberRows(data ?? []);
    if (!inviteResult.error) setPendingInvites(inviteResult.data ?? []);
  }

  useEffect(() => {
    setHouseholdRole(households.find(h => h.id === householdId)?.role ?? "member");
    setHouseholdNameEdit(householdName);
    void refreshMembers();
  }, [householdId, householdName, households]);

  async function changeMemberRole(memberId: string, role: string) {
    if (!supabase) return;
    setInviteBusy(true); setInviteMessage("");
    const { error } = await supabase.rpc("set_household_member_role", { target_household: householdId, target_user: memberId, new_role: role });
    setInviteBusy(false);
    setInviteMessage(error ? error.message : (language === "de" ? "Rolle aktualisiert." : "Role updated."));
    if (!error) await refreshMembers();
  }

  async function removeMember(memberId: string) {
    if (!supabase) return;
    const member = memberRows.find(row => row.user_id === memberId);
    if (!window.confirm(language === "de" ? `Mitglied ${member?.email ?? ""} wirklich aus diesem Haushalt entfernen?` : `Remove ${member?.email ?? "this member"} from this household?`)) return;
    setInviteBusy(true); setInviteMessage("");
    const { error } = await supabase.rpc("remove_household_member", { target_household: householdId, target_user: memberId });
    setInviteBusy(false);
    setInviteMessage(error ? error.message : (language === "de" ? "Mitglied entfernt." : "Member removed."));
    if (!error) await refreshMembers();
  }

  async function revokeInvite(inviteId: string) {
    if (!supabase) return;
    if (!window.confirm(language === "de" ? "Diese Einladung wirklich widerrufen?" : "Revoke this invitation?")) return;
    setInviteBusy(true);
    const { error } = await supabase.rpc("revoke_household_invite", { target_invite: inviteId });
    setInviteBusy(false);
    setInviteMessage(error ? error.message : (language === "de" ? "Einladung widerrufen." : "Invitation revoked."));
    if (!error) await refreshMembers();
  }

  async function renameHousehold() {
    if (!supabase || !householdNameEdit.trim()) return;
    const { error } = await supabase.rpc("rename_household", { target_household: householdId, new_name: householdNameEdit.trim() });
    setInviteMessage(error ? error.message : (language === "de" ? "Haushaltsname gespeichert. Bitte Seite neu laden, falls der Name oben noch nicht aktualisiert ist." : "Household name saved. Reload if the name above has not updated."));
    if (!error) window.location.reload();
  }

  async function deleteHousehold() {
    if (!supabase || !isOwner) return;
    const confirmation = window.prompt(language === "de" ? `Zum endgültigen Löschen bitte exakt „${householdName}“ eingeben:` : `Type “${householdName}” to permanently delete this household:`);
    if (confirmation !== householdName) return;
    const { error } = await supabase.rpc("delete_household", { target_household: householdId });
    if (error) { setInviteMessage(error.message); return; }
    localStorage.removeItem("lager-selected-household");
    window.location.reload();
  }

  async function createInvite() {
    if (!supabase) return;
    setInviteBusy(true); setInviteMessage(""); setInviteCode("");
    const { data, error } = await supabase.rpc("create_household_invite", {
      target_household: householdId,
      invited_email: inviteEmail.trim() || null,
    });
    setInviteBusy(false);
    if (error) { setInviteMessage(error.message); return; }
    const code = typeof data === "string" ? data : data?.code;
    if (!code) { setInviteMessage("Einladung wurde erstellt, aber es kam kein Code zurück."); return; }
    setInviteCode(code);
    await refreshMembers();
    const link = `${window.location.origin}/?invite=${encodeURIComponent(code)}`;
    if (inviteEmail.trim()) {
      const { error: mailError } = await supabase.functions.invoke("send-household-invite", {
        body: { email: inviteEmail.trim(), code, link, householdName }
      });
      setInviteMessage(mailError
        ? `Einladungscode erstellt. E-Mail-Versand noch nicht eingerichtet: ${mailError.message}`
        : "Einladung erstellt und per E-Mail versendet.");
    } else setInviteMessage("Einladungscode erstellt. Du kannst ihn oder den Link teilen.");
  }

  async function acceptInvite() {
    if (!supabase || !joinCode.trim()) return;
    setInviteBusy(true); setInviteMessage("");
    const { data, error } = await supabase.rpc("accept_household_invite", { invite_code: joinCode.trim().toUpperCase() });
    setInviteBusy(false);
    if (error) { setInviteMessage(error.message); return; }
    if (typeof data !== "string") {
      setInviteMessage("Einladung angenommen, aber die Haushalts-ID wurde nicht zurückgegeben.");
      return;
    }
    localStorage.setItem("lager-selected-household", data);
    window.location.reload();
  }

  async function copyInvite() {
    const link = `${window.location.origin}/?invite=${encodeURIComponent(inviteCode)}`;
    await navigator.clipboard.writeText(link);
    setInviteMessage("Einladungslink kopiert.");
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
    setForm({ ...values, quantity: String(values.quantity), minQuantity: String(values.minQuantity) });
    setModalOpen(true);
  }

  async function runProductSearch() {
    const query = productQuery.trim() || form.barcode.trim() || form.name.trim();
    if (!query) { setProductError(language === "de" ? "Bitte zuerst einen Barcode oder Produktnamen eingeben." : "Enter a barcode or product name first."); return; }
    setProductLoading(true); setProductError(""); setProductHits([]);
    try {
      const client = supabase;
      if (!client) throw new Error(language === "de" ? "Die Cloud-Verbindung ist nicht verfügbar." : "The cloud connection is unavailable.");
      const localQuery = client.from("household_products").select("id,name,brand,barcode,description,image_url").eq("household_id", householdId);
      const localResult = /^[0-9]{8,14}$/.test(query)
        ? await localQuery.eq("barcode", query)
        : await localQuery.ilike("name", `%${query.replace(/[%_]/g, "\\$&")}%`).limit(12);
      const localHits: ProductHit[] = (localResult.data ?? []).map(row => ({
        id: `household-${row.id}`, name: row.name, brand: row.brand ?? "", barcode: row.barcode ?? "",
        description: row.description ?? "", image: row.image_url ?? "", source: "Open Products Facts",
      }));
      const result = await searchProducts(query);
      const combined = [...localHits, ...result.hits.filter(hit => !localHits.some(local => local.barcode && local.barcode === hit.barcode))];
      setProductHits(combined);
      if (combined.length === 0) setProductError(language === "de" ? "Kein Treffer? Du kannst unten einen eigenen Produktnamen eingeben und den Barcode direkt zuordnen." : "No match? Enter your own product name below and assign the barcode directly.");
      else if (result.errors.length) setProductError(language === "de" ? "Einige Datenbanken waren nicht erreichbar: " + result.errors.join(" · ") : "Some databases could not be reached: " + result.errors.join(" · "));
    } catch (error) { setProductError(error instanceof Error ? error.message : "Produktsuche fehlgeschlagen."); }
    finally { setProductLoading(false); }
  }

  function chooseProduct(hit: ProductHit) {
    setForm(current => ({ ...current, name: hit.name, description: [hit.brand, hit.quantity].filter(Boolean).join(" · ") || hit.description, barcode: hit.barcode || current.barcode }));
    setProductHits([]); setProductError(""); setProductQuery("");
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
        <div className="sidebar-scroll"><div className="workspace-label">WORKSPACE</div>
        <div className="household-switcher">
          <label htmlFor="household-switch">{language === "de" ? "AKTUELLER HAUSHALT" : "CURRENT HOUSEHOLD"}</label>
          <div className="household-select-wrap">
            <Boxes size={16}/>
            <select id="household-switch" value={householdId} onChange={event => onSwitchHousehold(event.target.value)} aria-label={language === "de" ? "Haushalt wechseln" : "Switch household"}>
              {households.map(household => <option key={household.id} value={household.id}>{household.name}</option>)}
            </select>
            <ChevronDown size={14}/>
          </div>
          <small>{households.length === 1 ? (language === "de" ? "1 Haushalt" : "1 household") : `${households.length} ${language === "de" ? "Haushalte" : "households"}`}</small>
        </div>
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
        </div></div>
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

          {page === "settings" && <><div className="page-heading"><div><div className="eyebrow">{tr("settings").toUpperCase()}</div><h1>{tr("settings")}</h1><p>{language === "de" ? "Passe deine Lagerverwaltung an." : "Customize your inventory app."}</p></div></div><section className="panel settings-panel"><div className="setting-row"><div><strong>{tr("language")}</strong><small>Deutsch / English</small></div><select value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="de">Deutsch</option><option value="en">English</option></select></div><div className="setting-row"><div><strong>{tr("darkMode")}</strong><small>{language === "de" ? "Dunkle Oberfläche aktivieren" : "Enable dark appearance"}</small></div><button className="secondary-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={17}/> : <Moon size={17}/>} {dark ? "Light" : "Dark"}</button></div><div className="setting-row"><div><strong>Produktbilder</strong><small>{language === "de" ? "Produktbilder in Suche und Vorschau anzeigen" : "Show product images in search and previews"}</small></div><label className="switch-control"><input type="checkbox" checked={showProductImages} onChange={e => setShowProductImages(e.target.checked)}/><span className="switch-slider"/></label></div><div className="setting-row"><div><strong>Supabase</strong><small>{language === "de" ? "Deine Daten werden mit diesem Haushalt synchronisiert." : "Your data is synced with this household."}</small></div><span className="connection-pill connected">Connected</span></div></section>
<section className="panel settings-panel household-panel"><h2>{householdName}</h2><p>{language === "de" ? "Mitglieder und Zugriffsrechte dieses Haushalts verwalten." : "Manage this household's members and access."}</p>
{isOwner && <div className="invite-box"><h3>{language === "de" ? "Haushaltseinstellungen" : "Household settings"}</h3><label>{language === "de" ? "Haushaltsname" : "Household name"}<input value={householdNameEdit} maxLength={80} onChange={e => setHouseholdNameEdit(e.target.value)}/></label><button className="secondary-button" type="button" disabled={!householdNameEdit.trim() || householdNameEdit.trim() === householdName} onClick={() => void renameHousehold()}>{language === "de" ? "Namen speichern" : "Save name"}</button></div>}
<h3>{language === "de" ? "Mitglieder" : "Members"}</h3><div className="member-list">{memberRows.map(member => <div className="setting-row member-management-row" key={member.user_id}><div><strong>{member.user_id === user.id ? (language === "de" ? "Du" : "You") : (member.email ?? (language === "de" ? "Haushaltsmitglied" : "Household member"))}</strong><small>{member.email ?? member.user_id}</small></div><div className="member-actions"><span className="connection-pill">{member.role === "owner" ? (language === "de" ? "Besitzer" : "Owner") : member.role === "admin" ? (language === "de" ? "Administrator" : "Administrator") : (language === "de" ? "Mitglied" : "Member")}</span>{canManageHousehold && member.role !== "owner" && member.user_id !== user.id && <><select aria-label={language === "de" ? "Mitgliedsrolle" : "Member role"} value={member.role} disabled={inviteBusy || (householdRole === "admin" && member.role === "admin")} onChange={e => void changeMemberRole(member.user_id, e.target.value)}><option value="member">{language === "de" ? "Mitglied" : "Member"}</option><option value="admin">Administrator</option></select><button type="button" className="danger-text-button" disabled={inviteBusy} onClick={() => void removeMember(member.user_id)}>{language === "de" ? "Entfernen" : "Remove"}</button></>}</div></div>)}</div>
{canManageHousehold && <><div className="invite-box"><h3>{language === "de" ? "Per E-Mail einladen" : "Invite by email"}</h3><label>{language === "de" ? "E-Mail-Adresse" : "Email address"}<input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@beispiel.de"/></label><button className="primary-button" type="button" disabled={inviteBusy || !inviteEmail.trim()} onClick={() => void createInvite()}>{inviteBusy ? (language === "de" ? "Bitte warten …" : "Please wait …") : (language === "de" ? "Einladung per E-Mail senden" : "Send email invitation")}</button></div>
<div className="invite-box"><h3>{language === "de" ? "Einladungscode erstellen" : "Create invitation code"}</h3><p>{language === "de" ? "Du kannst den Code auch persönlich weitergeben." : "You can also share the code directly."}</p><button className="secondary-button" type="button" disabled={inviteBusy} onClick={() => { setInviteEmail(""); void createInvite(); }}>{language === "de" ? "Code erstellen" : "Create code"}</button>{inviteCode && <div className="invite-code"><strong>{inviteCode}</strong><button className="secondary-button" type="button" onClick={() => void copyInvite()}>{language === "de" ? "Link kopieren" : "Copy link"}</button></div>}</div>
<h3>{language === "de" ? "Einladungen" : "Invitations"}</h3><div className="member-list">{pendingInvites.length === 0 ? <p>{language === "de" ? "Noch keine Einladungen vorhanden." : "No invitations yet."}</p> : pendingInvites.map(invite => { const statusLabel = invite.status === "accepted" ? (language === "de" ? "Angenommen" : "Accepted") : invite.status === "expired" ? (language === "de" ? "Abgelaufen" : "Expired") : (language === "de" ? "Offen" : "Pending"); return <div className="setting-row invitation-row" key={invite.id}><div><strong>{invite.invited_email || (language === "de" ? "Einladung per Code" : "Code invitation")}</strong><small>{language === "de" ? "Erstellt: " : "Created: "}{new Date(invite.created_at).toLocaleString(language === "de" ? "de-DE" : "en-US")} · {language === "de" ? "Ablauf: " : "Expires: "}{new Date(invite.expires_at).toLocaleString(language === "de" ? "de-DE" : "en-US")}{invite.accepted_at ? ` · ${language === "de" ? "Angenommen: " : "Accepted: "}${new Date(invite.accepted_at).toLocaleString(language === "de" ? "de-DE" : "en-US")}` : ""}</small></div><div className="member-actions"><span className={`invite-status invite-status-${invite.status}`}>{statusLabel}</span>{invite.status === "pending" && <button className="danger-text-button" type="button" disabled={inviteBusy} onClick={() => void revokeInvite(invite.id)}>{language === "de" ? "Widerrufen" : "Revoke"}</button>}</div></div>; })}</div></>}
<div className="invite-box"><h3>{language === "de" ? "Einladungscode einlösen" : "Redeem invitation code"}</h3><label>{language === "de" ? "Code" : "Code"}<input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCD1234"/></label><button className="secondary-button" type="button" disabled={inviteBusy || !joinCode.trim()} onClick={() => void acceptInvite()}>{language === "de" ? "Haushalt beitreten" : "Join household"}</button></div>
{isOwner && <div className="invite-box danger-zone"><h3>{language === "de" ? "Gefahrenzone" : "Danger zone"}</h3><p>{language === "de" ? "Der Haushalt und alle zugehörigen Lagerdaten werden endgültig gelöscht." : "The household and all associated inventory data will be permanently deleted."}</p><button className="danger-button" type="button" onClick={() => void deleteHousehold()}>{language === "de" ? "Haushalt endgültig löschen" : "Permanently delete household"}</button></div>}
{inviteMessage && <div className="auth-message">{inviteMessage}</div>}</section></>}
        </div>
      </main>

      {modalOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}><form className="modal" onSubmit={saveItem}><div className="modal-header"><div><div className="eyebrow">{editingId ? tr("edit") : tr("addItem")}</div><h2>{editingId ? tr("edit") : tr("addItem")}</h2></div><button type="button" className="icon-button" onClick={() => setModalOpen(false)}><X size={20}/></button></div><div className="form-grid"><div className="wide product-lookup"><label>{language === "de" ? "Produkt finden (Barcode oder Name)" : "Find product (barcode or name)"}<div className="product-search-row"><input value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder={language === "de" ? "Barcode oder z. B. Shampoo, PLA Basic …" : "Barcode or e.g. shampoo, PLA Basic …"}/><button type="button" className="secondary-button" onClick={() => { setScannerTarget("product-search"); setScannerOpen(true); }} aria-label={language === "de" ? "Barcode im Suchfeld scannen" : "Scan barcode in search"}><ScanBarcode size={17}/></button><button type="button" className="secondary-button" onClick={runProductSearch} disabled={productLoading}><Search size={16}/>{productLoading ? (language === "de" ? "Suche …" : "Searching …") : (language === "de" ? "Suchen" : "Search")}</button></div></label>{productError && <p className="product-search-message">{productError}</p>}{productHits.length > 0 && <div className="product-results">{productHits.map(hit => <button type="button" className="product-result" key={hit.id} onClick={() => chooseProduct(hit)}>{showProductImages && hit.image ? <img src={hit.image} alt="" loading="lazy"/> : <span className="product-result-placeholder"><Package size={18}/></span>}<span className="product-result-info"><strong>{hit.name}</strong><small>{[hit.brand, hit.quantity, hit.source].filter(Boolean).join(" · ")}</small>{hit.barcode && <small>EAN: {hit.barcode}</small>}</span><Check size={16}/></button>)}</div>}</div><label className="wide">{tr("name")} *<input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={language === "de" ? "z. B. Küchenrolle" : "e.g. Paper towels"}/></label><label>{tr("category")}<select value={form.categoryId ?? ""} onChange={e => setForm({ ...form, categoryId: e.target.value || null })}><option value="">{tr("chooseCategory")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? "　↳ " : ""}{c.name}</option>)}</select></label><label>{tr("quantity")} ({tr("pieces")})<input type="number" min="0" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}/></label><label>{tr("minimum")}<input type="number" min="0" step="1" value={form.minQuantity} onChange={e => setForm({ ...form, minQuantity: e.target.value })}/></label><label>{tr("location")}<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={language === "de" ? "z. B. Kellerregal" : "e.g. Basement shelf"}/></label><label className="wide">{tr("description")}<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label><label className="wide">{tr("barcode")}<div className="barcode-entry"><input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="EAN / UPC"/><button type="button" className="secondary-button barcode-scan-button" onClick={() => { setScannerTarget("item"); setScannerOpen(true); }}><ScanBarcode size={17}/>{language === "de" ? "Scannen" : "Scan"}</button></div></label><label className="wide">{tr("notes")}<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>{tr("cancel")}</button><button className="primary-button" type="submit"><Check size={17}/>{editingId ? tr("save") : tr("create")}</button></div></form></div>}
      {scannerOpen && <BarcodeScanner language={language} onClose={() => setScannerOpen(false)} onDetected={handleBarcodeDetected}/>}
    </div>
  );
}

function BarcodeScanner({ language, onClose, onDetected }: { language: Language; onClose: () => void; onDetected: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let active = true;
    const start = async () => {
      const Detector = (window as Window & { BarcodeDetector?: (new (options?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> }) & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (!Detector) {
        setError(language === "de" ? "Dieser Browser unterstützt das direkte Barcode-Scannen leider nicht. Bitte gib den Barcode manuell ein oder nutze einen aktuellen Chrome-Browser." : "This browser does not support direct barcode scanning. Please enter the barcode manually or use a current Chrome browser.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(language === "de" ? "Der Kamerazugriff ist in diesem Browser nicht verfügbar." : "Camera access is not available in this browser.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        const video = videoRef.current;
        if (!active || !video) { stream.getTracks().forEach(track => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        const wantedFormats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"];
        const supportedFormats = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : wantedFormats;
        const formats = wantedFormats.filter(format => supportedFormats.includes(format));
        if (formats.length === 0) throw new Error("No supported barcode formats");
        const detector = new Detector({ formats });
        const scan = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(video);
            const value = codes.find(code => code.rawValue)?.rawValue;
            if (value) { onDetected(value); return; }
          } catch { /* Continue scanning while the camera is active. */ }
          if (active) frame = requestAnimationFrame(() => { void scan(); });
        };
        frame = requestAnimationFrame(() => { void scan(); });
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : "";
        setError(name === "NotAllowedError"
          ? (language === "de" ? "Der Kamerazugriff wurde nicht erlaubt. Bitte erteile dem Browser die Kameraberechtigung." : "Camera access was denied. Please allow camera access in your browser.")
          : (language === "de" ? "Die Kamera konnte nicht gestartet werden. Prüfe bitte die Kameraberechtigung und versuche es erneut." : "The camera could not be started. Please check camera permissions and try again."));
      }
    };
    void start();
    return () => { active = false; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()); };
  }, [language, onDetected]);

  return <div className="scanner-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="scanner-dialog" role="dialog" aria-modal="true" aria-label={language === "de" ? "Barcode scannen" : "Scan barcode"}><div className="modal-header"><div><div className="eyebrow">LAGERZUHAUSE</div><h2>{language === "de" ? "Barcode scannen" : "Scan barcode"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={language === "de" ? "Schließen" : "Close"}><X size={20}/></button></div>{error ? <div className="scanner-error"><ScanBarcode size={28}/><p>{error}</p><button type="button" className="primary-button" onClick={onClose}>{language === "de" ? "Schließen" : "Close"}</button></div> : <><div className="scanner-video-wrap"><video ref={videoRef} muted playsInline/><div className="scanner-frame"/></div><p className="scanner-hint">{language === "de" ? "Halte den Barcode ruhig in den markierten Bereich." : "Hold the barcode steady inside the marked area."}</p><button type="button" className="secondary-button scanner-cancel" onClick={onClose}>{language === "de" ? "Abbrechen" : "Cancel"}</button></>}</section></div>;
}

function StatCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}

function QuantityInput({ item, label, onCommit }: { item: InventoryItem; label: string; onCommit: (value: number) => void }) {
  const [value, setValue] = useState(String(item.quantity));
  useEffect(() => setValue(String(item.quantity)), [item.quantity]);
  return <input aria-label={label} type="number" min="0" step="1" value={value}
    onChange={event => setValue(event.target.value)}
    onBlur={() => { const next = Math.max(0, Number(value) || 0); setValue(String(next)); if (next !== item.quantity) onCommit(next); }}
    onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}/>;
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
  return <div className="table-wrap"><table><thead><tr><th>{tr("item")}</th>{!compact && <th>{tr("category")}</th>}<th>{tr("quantity")}</th><th>{tr("status")}</th>{!compact && <th>{tr("location")}</th>}<th></th></tr></thead><tbody>{items.map(item => { const state = status(item); return <tr key={item.id}><td><div className="item-cell"><div className="item-icon"><Package size={17}/></div><div><strong>{item.name}</strong><small>{item.description || categoryLabel(item.categoryId)}</small></div></div></td>{!compact && <td className="category-cell">{categoryLabel(item.categoryId)}</td>}<td><div className="quantity-control"><button onClick={() => onChange(item.id, -1)} aria-label="Menge verringern"><Minus size={13}/></button><QuantityInput item={item} label={`${tr("quantity")} ${item.name}`} onCommit={value => onSet(item.id, value)}/><button onClick={() => onChange(item.id, 1)} aria-label="Menge erhöhen"><Plus size={13}/></button><small>{item.unit}</small></div></td><td><span className={`status-pill ${state.cls}`}><span/>{state.label}</span></td>{!compact && <td className="location-cell">{item.location ? <span className="location-content"><MapPin size={13}/>{item.location}</span> : "–"}</td>}<td><div className="row-actions"><button onClick={() => onEdit(item)} aria-label={tr("edit")} title={tr("edit")}><Pencil size={15}/></button><button onClick={() => onDelete(item.id)} aria-label={tr("delete")} title={tr("delete")}><Trash2 size={15}/></button></div></td></tr>; })}</tbody></table>{items.length === 0 && <div className="table-empty"><PackagePlus size={25}/><strong>{tr("noItems")}</strong></div>}</div>;
}

export default App;


function App() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [households, setHouseholds] = useState<HouseholdOption[]>([]);
  const [email, setEmail] = useState(() => localStorage.getItem("lager-saved-email") ?? "");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(localStorage.getItem("lager-saved-email")));
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsHousehold, setNeedsHousehold] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState("Mein Zuhause");
  const [setupInviteCode, setSetupInviteCode] = useState(() => new URLSearchParams(window.location.search).get("invite")?.toUpperCase() ?? "");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user ?? null)).finally(() => setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSessionUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabase || !sessionUser) {
      setHouseholdId(null);
      setHouseholds([]);
      setNeedsHousehold(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id,role,households(id,name)")
        .eq("user_id", sessionUser.id);
      if (!active) return;
      if (error) { setAuthMessage(error.message); return; }

      const available: HouseholdOption[] = (data ?? []).flatMap(row => {
        const related = Array.isArray(row.households) ? row.households[0] : row.households;
        return related?.id ? [{ id: related.id, name: related.name ?? "Mein Haushalt", role: row.role }] : [];
      });
      setHouseholds(available);

      if (available.length) {
        const storedId = localStorage.getItem("lager-selected-household");
        const selected = available.find(household => household.id === storedId) ?? available[0];
        setHouseholdId(selected.id);
        localStorage.setItem("lager-selected-household", selected.id);
        setNewHouseholdName(selected.name);
        setNeedsHousehold(false);
      } else {
        setHouseholdId(null);
        setNeedsHousehold(true);
      }
    })();
    return () => { active = false; };
  }, [sessionUser]);

  function switchHousehold(nextId: string) {
    if (!households.some(household => household.id === nextId)) return;
    localStorage.setItem("lager-selected-household", nextId);
    setHouseholdId(nextId);
    const selected = households.find(household => household.id === nextId);
    if (selected) setNewHouseholdName(selected.name);
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const submittedEmail = email.trim();
    const submittedPassword = password;
    if (authMode === "signup" && !(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(submittedPassword))) {
      setAuthMessage("Das Passwort muss mindestens 8 Zeichen sowie einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.");
      setPassword("");
      return;
    }
    setAuthBusy(true); setAuthMessage("");
    const mode = authMode;
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email: submittedEmail, password: submittedPassword, options: { emailRedirectTo: `${window.location.origin}/` } })
      : await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword });
    setAuthBusy(false);
    setPassword("");
    if (mode === "signup") {
      localStorage.removeItem("lager-saved-email");
      setRememberEmail(false);
      setEmail("");
    } else if (rememberEmail) {
      localStorage.setItem("lager-saved-email", submittedEmail);
      setEmail(submittedEmail);
    } else {
      localStorage.removeItem("lager-saved-email");
      setEmail("");
    }
    if (result.error) setAuthMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setAuthMessage("Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse und melde dich anschließend an.");
  }

  function toggleRememberEmail(checked: boolean) {
    setRememberEmail(checked);
    if (!checked) localStorage.removeItem("lager-saved-email");
  }

  async function joinHouseholdFromSetup() {
    if (!supabase || !setupInviteCode.trim()) return;
    setAuthBusy(true); setAuthMessage("");
    const { data, error } = await supabase.rpc("accept_household_invite", { invite_code: setupInviteCode.trim().toUpperCase() });
    setAuthBusy(false);
    if (error) setAuthMessage(error.message);
    else if (typeof data === "string") {
      localStorage.setItem("lager-selected-household", data);
      window.location.reload();
    } else setAuthMessage("Einladung angenommen, aber die Haushalts-ID wurde nicht zurückgegeben.");
  }

  async function createHousehold(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !newHouseholdName.trim()) return;
    setAuthBusy(true); setAuthMessage("");
    const { data, error } = await supabase.rpc("create_household", { household_name: newHouseholdName.trim() });
    setAuthBusy(false);
    if (error) setAuthMessage(error.message);
    else {
      const createdId = data as string;
      localStorage.setItem("lager-selected-household", createdId);
      setHouseholdId(createdId);
      setHouseholds([{ id: createdId, name: newHouseholdName.trim(), role: "owner" }]);
      setNeedsHousehold(false);
    }
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
  if (!sessionUser) return <div className="auth-screen"><form className="auth-card" onSubmit={submitAuth}><div className="brand-mark auth-mark"><Boxes size={25}/></div><div className="eyebrow">LAGERZUHAUSE</div><h1>{authMode === "login" ? "Willkommen zurück" : "Konto erstellen"}</h1><p>{authMode === "login" ? "Melde dich an, um deinen Lagerbestand überall zu nutzen." : "Erstelle dein persönliches Konto für dein Zuhause."}</p><label>E-Mail-Adresse<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="off"/></label>{authMode === "login" && <label className="remember-email"><input type="checkbox" checked={rememberEmail} onChange={e => toggleRememberEmail(e.target.checked)}/><span>E-Mail speichern</span></label>}<label>Passwort<input type="password" required minLength={authMode === "signup" ? 8 : 1} pattern={authMode === "signup" ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+" : undefined} title={authMode === "signup" ? "Mindestens 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe und eine Zahl." : undefined} value={password} onChange={e => setPassword(e.target.value)} autoComplete="off"/></label>{authMode === "signup" && <p className="password-hint">Passwort: mindestens 8 Zeichen, ein Großbuchstabe, ein Kleinbuchstabe und eine Zahl.</p>}{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? "Bitte warten …" : authMode === "login" ? "Anmelden" : "Registrieren"}</button>{authMode === "login" && <button type="button" className="auth-link" onClick={resetPassword}>Passwort vergessen?</button>}<div className="auth-switch">{authMode === "login" ? "Noch kein Konto?" : "Du hast bereits ein Konto?"} <button type="button" onClick={() => { const nextMode = authMode === "login" ? "signup" : "login"; setAuthMode(nextMode); setPassword(""); setAuthMessage(""); if (nextMode === "signup") setEmail(""); else if (rememberEmail) setEmail(localStorage.getItem("lager-saved-email") ?? ""); }}>{authMode === "login" ? "Registrieren" : "Anmelden"}</button></div></form></div>;
  if (needsHousehold || !householdId) return <div className="auth-screen"><form className="auth-card" onSubmit={createHousehold}><div className="brand-mark auth-mark"><Boxes size={25}/></div><div className="eyebrow">FAST GESCHAFFT</div><h1>Dein erster Haushalt</h1><p>Ein Haushalt enthält deine Kategorien und Artikel. Du kannst einen bestehenden Haushalt auch über einen Einladungscode betreten.</p><label>Einladungscode (optional)<input value={setupInviteCode} onChange={e => setSetupInviteCode(e.target.value.toUpperCase())} placeholder="ABCD-1234"/></label>{setupInviteCode.trim() && <button type="button" className="secondary-button" disabled={authBusy} onClick={joinHouseholdFromSetup}>Einladung annehmen</button>}<label>Name des Haushalts<input required value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)}/></label>{authMessage && <div className="auth-message">{authMessage}</div>}<button className="primary-button auth-submit" disabled={authBusy}>{authBusy ? "Wird erstellt …" : "Haushalt erstellen"}</button><button type="button" className="auth-link" onClick={signOut}>Abmelden</button></form></div>;
  const currentHousehold = households.find(household => household.id === householdId);
  return <InventoryApp
    user={sessionUser}
    householdId={householdId}
    householdName={currentHousehold?.name ?? newHouseholdName}
    households={households}
    onSwitchHousehold={switchHousehold}
    onSignOut={signOut}
  />;
}
