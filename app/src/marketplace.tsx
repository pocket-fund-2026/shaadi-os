import React, { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Text, View, RefreshControl } from 'react-native';
import { api } from './api';
import { tr } from './i18n';
import { Btn, C, Card, Chip, Empty, F, H, Input, Loading, M, Rise, Tag, inr, s, dateIN } from './ui';
import { CAT_ICON, Icon, Logo } from './icons';
import { CategoryCover, FloralArch, SectionTitle, categoryPalette } from './visuals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortfolioPhoto, VendorCatalog } from './catalog';

const CATEGORIES: [string, string][] = [['photographer', 'Photography'], ['makeup', 'Makeup'], ['mehndi', 'Mehndi'], ['decor', 'Decor'], ['venue', 'Venues'], ['caterer', 'Catering'], ['dj', 'DJ & music'], ['pandit', 'Pandit']];
const CITIES = ['Mumbai', 'Pune', 'Nashik', 'Nagpur'];
// Couples budget in lakhs, so the common ceilings are one tap away.
const BUDGET_PRESETS = [50000, 100000, 200000, 500000];
// Recommended order: vendors on Shaadi OS, then real businesses that have not joined, then demo samples.
const listingRank = (v: any) => v.sample ? 2 : v.unclaimed ? 1 : 0;
// Unknown keys (e.g. budget lines like 'attire') are shown capitalised rather than as raw lowercase ids.
export const categoryLabel = (category: string) => tr(CATEGORIES.find(([key]) => key === category)?.[1] || (category ? category[0].toUpperCase() + category.slice(1) : category));

type CompareProps = { on: boolean; disabled: boolean; onToggle: () => void };
function CompareToggle({ vendor, compare, floating }: { vendor: any; compare: CompareProps; floating?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={`${tr('Compare')} ${vendor.name}`} accessibilityState={{ checked: compare.on, disabled: compare.disabled }} disabled={compare.disabled} onPress={compare.onToggle} hitSlop={8}
    style={({ pressed }) => ({ ...(floating ? { position: 'absolute' as const, top: 12, right: 12 } : null), flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: compare.on ? C.primary : '#FFFEFCEE', borderWidth: compare.on ? 0 : 1, borderColor: C.line, opacity: compare.disabled ? 0.5 : pressed ? 0.8 : 1 })}>
    <Icon name={compare.on ? 'check' : 'plus'} size={14} color={compare.on ? '#fff' : C.primary} strokeWidth={2} />
    <Text style={{ fontSize: 12, fontWeight: '500', color: compare.on ? '#fff' : C.primary }}>{compare.on ? tr('Comparing') : tr('Compare')}</Text>
  </Pressable>;
}
const Rating = ({ vendor }: { vendor: any }) => vendor.rating
  ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="star" size={15} color={C.gold} /><Text style={{ color: C.ink, fontWeight: '500' }}>{vendor.rating}</Text><M>({vendor.reviews})</M></View>
  : <M>{tr('No reviews yet')}</M>;
const place = (vendor: any) => `${vendor.locality ? vendor.locality + ', ' : ''}${vendor.city}${vendor.travels ? ' · ' + tr('travels') : ''}`;

// Vendors with a real photo lead with it. Without one, a placeholder banner adds nothing, so the card is a compact
// row with a small category tile and twice as many vendors fit on screen.
export function VendorCard({ vendor, onPress, compare }: { vendor: any; onPress: () => void; compare?: CompareProps }) {
  if (!vendor.cover_url) {
    const palette = categoryPalette(vendor.category);
    return <Card onPress={onPress} style={{ padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={CAT_ICON[vendor.category] || 'store'} size={28} color={palette.ink} /></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text style={{ flex: 1, fontFamily: F.display, fontSize: 17, lineHeight: 24, color: C.ink }}>{vendor.name}</Text>
            {vendor.verified ? <View accessible accessibilityLabel={tr('Verified')}><Icon name="seal" size={18} color={C.ok} /></View> : null}
          </View>
          <M style={{ marginTop: 2 }}>{categoryLabel(vendor.category)} · {place(vendor)}</M>
          {vendor.sample || vendor.unclaimed ? <View style={{ flexDirection: 'row', marginTop: 4 }}><Tag label={tr(vendor.sample ? 'Sample listing' : 'Not on Shaadi OS yet')} /></View> : null}
          <View style={[s.row, { marginTop: 12, gap: 8 }]}>
            {vendor.start_paise ? <Text style={{ color: C.ink, fontSize: 15 }}><M style={{ fontSize: 12 }}>{tr('From')} </M><Text style={{ fontWeight: '500', fontSize: 17, fontVariant: ['tabular-nums'] }}>{inr(vendor.start_paise)}</Text></Text> : <M>{tr('Price not listed')}</M>}
            {compare ? <CompareToggle vendor={vendor} compare={compare} /> : <Rating vendor={vendor} />}
          </View>
          {compare && vendor.rating ? <View style={{ marginTop: 8 }}><Rating vendor={vendor} /></View> : null}
        </View>
      </View>
    </Card>;
  }
  return <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
    <PortfolioPhoto uri={vendor.cover_url} caption={vendor.name} height={180} />
    {compare ? <CompareToggle vendor={vendor} compare={compare} floating /> : null}
    <View style={{ padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <Text style={{ flex: 1, fontFamily: F.display, fontSize: 20, lineHeight: 28, color: C.ink }}>{vendor.name}</Text>
        {vendor.sample || vendor.unclaimed ? <Tag label={tr(vendor.sample ? 'Sample listing' : 'Not on Shaadi OS yet')} /> : vendor.verified ? <Tag tone="ok" icon="seal" label={tr('Verified')} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}><Icon name="pin" size={15} color={C.mute} /><M style={{ flex: 1 }}>{place(vendor)}</M></View>
      <View style={[s.row, { borderTopWidth: 1, borderTopColor: C.line, marginTop: 16, paddingTop: 16, gap: 8 }]}>
        <View><M style={{ fontSize: 12 }}>{tr('Starting price')}</M><Text style={{ color: C.ink, fontWeight: '500', fontSize: 20, marginTop: 4, fontVariant: ['tabular-nums'] }}>{inr(vendor.start_paise)}</Text></View>
        <Rating vendor={vendor} />
      </View>
    </View>
  </Card>;
}

export function Marketplace({ openVendor, onSignIn, preset, weddingDate }: { openVendor: (id: number) => void; onSignIn?: () => void; preset?: { category?: string; at?: number }; weddingDate?: string }) {
  const [freeOn, setFreeOn] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(''); const [budget, setBudget] = useState('');
  const [comparison, setComparison] = useState<any[]>([]); const [showComparison, setShowComparison] = useState(false);
  const validBudget = !budgetDraft || (/^\d+(\.\d{1,2})?$/.test(budgetDraft) && Number(budgetDraft) > 0 && Number(budgetDraft) <= Number.MAX_SAFE_INTEGER / 100);
  const toggleCompare = (vendor: any) => setComparison(items => items.some(item => item.id === vendor.id) ? items.filter(item => item.id !== vendor.id) : items.length < 3 ? [...items, vendor] : items);
  const [city, setCity] = useState(''); const [category, setCategory] = useState(''); const [query, setQuery] = useState(''); const [sort, setSort] = useState('recommended');
  const [showBudget, setShowBudget] = useState(false);
  // Arriving from the plan's vendor tracker opens Discover on that service.
  useEffect(() => { if (preset?.category) setCategory(preset.category); }, [preset?.category, preset?.at]);
  const clearFilters = () => { setCity(''); setCategory(''); setQuery(''); setBudget(''); setBudgetDraft(''); setShowBudget(false); setFreeOn(false); };
  const [vendors, setVendors] = useState<any[] | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const params = `city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}&q=${encodeURIComponent(query.trim())}${budget ? '&max=' + encodeURIComponent(budget) : ''}${freeOn && weddingDate ? '&free_on=' + weddingDate : ''}`;
        const result = await api<any[]>('/vendors?' + params);
        if (active) setVendors(result);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (active) setBusy(false); }
    }, query ? 220 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [city, category, query, budget, refreshKey, freeOn, weddingDate]);
  const results = [...(vendors || [])].sort((a, b) => sort === 'price' ? (a.start_paise ?? Infinity) - (b.start_paise ?? Infinity) : sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : listingRank(a) - listingRank(b) || b.verified - a.verified || a.id - b.id);
  const filtered = !!(city || category || query || budget || freeOn);
  return <FlatList style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 36, width: '100%', maxWidth: 760, alignSelf: 'center' }} data={results} keyExtractor={v => String(v.id)} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => setRefreshKey(k => k + 1)} tintColor={C.primary} />}
    ListHeaderComponent={<>
      {onSignIn && <View style={[s.row, { marginBottom: 20 }]}><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Logo size={28} /><Text style={{ fontFamily: F.display, color: C.primary, fontSize: 20 }}>Shaadi OS</Text></View><Btn small kind="quiet" title={tr('Sign in')} onPress={onSignIn} /></View>}
      <Text accessibilityRole="header" style={{ fontFamily: F.display, color: C.ink, fontSize: 28, lineHeight: 34, textAlign: 'center' }}>{tr('Find wedding vendors')}</Text>
      <M style={{ marginTop: 4, marginBottom: 16, textAlign: 'center', alignSelf: 'center', maxWidth: 320 }}>{tr('Venues, caterers, photographers, mehndi artists and pandits in Mumbai, Pune, Nashik and Nagpur.')}</M>
      <Input icon="search" accessibilityLabel={tr('Search vendors')} placeholder={tr('Search vendors')} value={query} onChangeText={setQuery} returnKeyType="search" />
      {/* All eight services visible at once, as a 4 x 2 grid. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {CATEGORIES.map(([key, label]) => { const on = category === key; const pal = categoryPalette(key); return (
          <Pressable key={key} accessibilityRole="button" accessibilityLabel={tr(label)} accessibilityState={{ selected: on }} onPress={() => setCategory(on ? '' : key)}
            style={({ pressed }) => ({ width: '23%', flexGrow: 1, minHeight: 84, paddingVertical: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? C.primary : C.line, backgroundColor: on ? C.tint : C.card, alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.75 : 1 })}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: pal.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={CAT_ICON[key] || 'store'} size={20} color={pal.ink} /></View>
            <Text style={{ fontSize: 12, color: C.ink, fontWeight: on ? '600' : '500', textAlign: 'center' }} numberOfLines={1}>{tr(label)}</Text>
          </Pressable>); })}
      </View>
      <M style={{ marginTop: 20, marginBottom: 8 }}>{tr('Wedding city')}</M>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}><Chip label={tr('All cities')} on={!city} onPress={() => setCity('')} />{CITIES.map(c => <Chip key={c} label={c} on={city === c} onPress={() => setCity(city === c ? '' : c)} />)}</ScrollView>
      {comparison.length > 0 && <Card><View style={s.row}><H style={{ fontSize: 20 }}>{tr('Compare vendors')} ({comparison.length}/3)</H><Btn small kind="ghost" title={tr('Clear')} onPress={() => { setComparison([]); setShowComparison(false); }} /></View>
        <M>{tr('Select up to three vendors to compare prices, location and ratings.')}</M><Btn kind="quiet" title={showComparison ? tr('Hide comparison') : tr('Show comparison')} onPress={() => setShowComparison(!showComparison)} />
        {showComparison && <ScrollView horizontal contentContainerStyle={{ gap: 12 }}>{comparison.map(item => <View key={item.id} style={{ width: 220, padding: 16, backgroundColor: C.bg, borderRadius: 12 }}><H style={{ fontSize: 20 }}>{item.name}</H><M>{categoryLabel(item.category)} · {item.city}</M><H style={{ color: C.primary }}>{item.start_paise ? inr(item.start_paise) : tr('Price not listed')}</H><M>{item.rating ? `${item.rating}/5 · ${item.reviews} ${tr('reviews')}` : tr('No reviews yet')}</M>{item.verified ? <Tag tone="ok" label={tr('Verified')} /> : null}<Btn small title={tr('View profile')} onPress={() => openVendor(item.id)} /><Btn small kind="ghost" title={tr('Remove')} onPress={() => toggleCompare(item)} /></View>)}</ScrollView>}
      </Card>}
      <SectionTitle title={filtered ? 'Matching vendors' : 'Vendor directory'} detail={vendors ? `${results.length} ${tr(results.length === 1 ? 'vendor' : 'vendors')}` : undefined} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {weddingDate ? <Chip icon="calendar" label={`${tr('Free on')} ${dateIN(weddingDate)}`} on={freeOn} onPress={() => setFreeOn(!freeOn)} /> : null}
        <Chip icon="rupee" label={budget ? `${tr('Up to')} ${inr(Number(budget) * 100)}` : tr('Budget')} on={!!budget || showBudget} onPress={() => setShowBudget(!showBudget)} />
        <View style={{ width: 1, height: 26, backgroundColor: C.line, marginRight: 8, marginTop: 8 }} />
        {[['recommended', 'Recommended'], ['price', 'Price: low to high'], ['rating', 'Top rated']].map(([key, label]) => <Chip key={key} label={tr(label)} on={sort === key} onPress={() => setSort(key)} />)}
      </ScrollView>
      {showBudget && <Rise><Card style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>{BUDGET_PRESETS.map(r => <Chip key={r} label={`${tr('Up to')} ${inr(r * 100)}`} on={budget === String(r)} onPress={() => { setBudgetDraft(String(r)); setBudget(String(r)); setShowBudget(false); }} />)}</View>
        <Input label={tr('Maximum starting price (₹)')} value={budgetDraft} onChangeText={setBudgetDraft} keyboardType="decimal-pad" placeholder={tr('Any budget')} returnKeyType="done" onSubmitEditing={() => { if (validBudget) { setBudget(budgetDraft); setShowBudget(false); } }} />
        {!validBudget && <Text accessibilityRole="alert" style={{ color: C.warn, marginBottom: 8 }}>{tr('Enter a valid budget amount.')}</Text>}
        <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Btn small title={tr('Apply budget')} disabled={!validBudget} onPress={() => { setBudget(budgetDraft); setShowBudget(false); }} /></View>
          {!!budget && <View style={{ flex: 1 }}><Btn small kind="ghost" title={tr('Any budget')} onPress={() => { setBudget(''); setBudgetDraft(''); setShowBudget(false); }} /></View>}</View>
      </Card></Rise>}
      {filtered && <View style={{ flexDirection: 'row', marginBottom: 8 }}><Btn small kind="quiet" icon="close" title={tr('Clear filters')} onPress={clearFilters} /></View>}
      {!!error && <Card><Text accessibilityRole="alert" style={{ color: C.warn, lineHeight: 21 }}>{error}</Text><Btn kind="quiet" title={tr('Try again')} onPress={() => setRefreshKey(k => k + 1)} /></Card>}
      {busy && !vendors && <Loading what={tr('vendors')} />}
    </>}
    ListEmptyComponent={!busy && vendors && !error ? <Empty icon="search" title={tr('No vendors match')} text={tr('Change your city or service to see more options.')} action={filtered ? tr('Clear filters') : undefined} onAction={clearFilters} /> : null}
    renderItem={({ item, index }) => { const selected = comparison.some(v => v.id === item.id); return <Rise i={Math.min(index, 3)}><VendorCard vendor={item} onPress={() => openVendor(item.id)} compare={{ on: selected, disabled: !selected && comparison.length >= 3, onToggle: () => toggleCompare(item) }} /></Rise>; }} />;
}

