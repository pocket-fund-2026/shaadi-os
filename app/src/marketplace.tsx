import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View, RefreshControl } from 'react-native';
import { api } from './api';
import { tr } from './i18n';
import { Btn, C, Card, Chip, Empty, F, H, Input, Loading, M, Rise, Tag, inr, s } from './ui';
import { CAT_ICON, Icon, Logo } from './icons';
import { CategoryCover, FloralArch, SectionTitle } from './visuals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PortfolioPhoto, VendorCatalog } from './catalog';

const CATEGORIES: [string, string][] = [['photographer', 'Photography'], ['makeup', 'Makeup'], ['mehndi', 'Mehndi'], ['decor', 'Decor'], ['venue', 'Venues'], ['caterer', 'Catering'], ['dj', 'DJ & music'], ['pandit', 'Pandit']];
const CITIES = ['Mumbai', 'Pune', 'Nashik', 'Nagpur'];
export const categoryLabel = (category: string) => tr(CATEGORIES.find(([key]) => key === category)?.[1] || category);

export function VendorCard({ vendor, onPress }: { vendor: any; onPress: () => void }) {
  return <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
    {vendor.cover_url ? <PortfolioPhoto uri={vendor.cover_url} caption={vendor.name} height={180} /> : <CategoryCover category={vendor.category} label={categoryLabel(vendor.category)} />}
    <View style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <Text style={{ flex: 1, fontFamily: F.display, fontSize: 22, lineHeight: 28, color: C.ink }}>{vendor.name}</Text>
        {vendor.verified ? <Tag tone="ok" icon="seal" label={tr('Verified')} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}><Icon name="pin" size={15} color={C.mute} /><M style={{ flex: 1 }}>{vendor.locality ? vendor.locality + ', ' : ''}{vendor.city}{vendor.travels ? ' · ' + tr('travels') : ''}</M></View>
      <View style={[s.row, { borderTopWidth: 1, borderTopColor: C.line, marginTop: 16, paddingTop: 14, gap: 8 }]}>
        <View><M style={{ fontSize: 11 }}>{tr('Starting price')}</M><Text style={{ color: C.primary, fontWeight: '700', fontSize: 19, marginTop: 3 }}>{inr(vendor.start_paise)}</Text></View>
        {vendor.rating ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="star" size={15} color={C.gold} /><Text style={{ color: C.ink, fontWeight: '700' }}>{vendor.rating}</Text><M>({vendor.reviews})</M></View> : <M>{tr('No reviews yet')}</M>}
      </View>
    </View>
  </Card>;
}

export function Marketplace({ openVendor, onSignIn }: { openVendor: (id: number) => void; onSignIn?: () => void }) {
  const [budgetDraft, setBudgetDraft] = useState(''); const [budget, setBudget] = useState('');
  const [comparison, setComparison] = useState<any[]>([]); const [showComparison, setShowComparison] = useState(false);
  const validBudget = !budgetDraft || (/^\d+(\.\d{1,2})?$/.test(budgetDraft) && Number(budgetDraft) > 0 && Number(budgetDraft) <= Number.MAX_SAFE_INTEGER / 100);
  const toggleCompare = (vendor: any) => setComparison(items => items.some(item => item.id === vendor.id) ? items.filter(item => item.id !== vendor.id) : items.length < 3 ? [...items, vendor] : items);
  const [city, setCity] = useState(''); const [category, setCategory] = useState(''); const [query, setQuery] = useState(''); const [sort, setSort] = useState('recommended');
  const [vendors, setVendors] = useState<any[] | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const params = `city=${encodeURIComponent(city)}&category=${encodeURIComponent(category)}&q=${encodeURIComponent(query.trim())}${budget ? '&max=' + encodeURIComponent(budget) : ''}`;
        const result = await api<any[]>('/vendors?' + params);
        if (active) setVendors(result);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (active) setBusy(false); }
    }, query ? 220 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [city, category, query, budget, refreshKey]);
  const results = [...(vendors || [])].sort((a, b) => sort === 'price' ? a.start_paise - b.start_paise : sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : b.verified - a.verified || a.id - b.id);
  const filtered = !!(city || category || query || budget);
  return <FlatList style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 36, width: '100%', maxWidth: 760, alignSelf: 'center' }} data={results} keyExtractor={v => String(v.id)} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => setRefreshKey(k => k + 1)} tintColor={C.primary} />}
    ListHeaderComponent={<>
      {onSignIn && <View style={[s.row, { marginBottom: 18 }]}><View style={{ flexDirection: 'row', gap: 9, alignItems: 'center' }}><Logo size={28} /><Text style={{ fontFamily: F.display, color: C.primary, fontSize: 20 }}>Shaadi OS</Text></View><Btn small kind="quiet" title={tr('Sign in')} onPress={onSignIn} /></View>}
      <View style={{ backgroundColor: C.primaryDark, padding: 24, borderRadius: 18, marginBottom: 24, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -28, bottom: -55, opacity: 0.5 }}><FloralArch color="#DCC399" size={155} /></View>
        <Text accessibilityRole="header" style={{ fontFamily: F.display, color: '#FFF9F0', fontSize: 34, lineHeight: 40, maxWidth: '80%' }}>{tr('Your wedding.\nYour people.')}</Text>
        <Text style={{ fontSize: 14, lineHeight: 22, color: '#E8D9D5', marginTop: 12, maxWidth: '78%' }}>{tr('Find the vendors who fit your celebration.')}</Text>
      </View>
      <Input accessibilityLabel={tr('Search vendors')} placeholder={tr('Search vendors, services or neighbourhoods')} value={query} onChangeText={setQuery} returnKeyType="search" />
      <SectionTitle title="Choose a service" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
        {CATEGORIES.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={tr(label)} accessibilityState={{ selected: category === key }} onPress={() => setCategory(category === key ? '' : key)} style={({ pressed }) => ({ width: 94, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1, borderColor: category === key ? C.primary : C.line, backgroundColor: category === key ? C.tint : C.card, opacity: pressed ? 0.75 : 1, alignItems: 'center', gap: 10 })}>
          <Icon name={CAT_ICON[key] || 'store'} size={26} color={category === key ? C.primary : C.ink} strokeWidth={1.5} /><Text style={{ fontSize: 11, color: C.ink, fontWeight: '600', textAlign: 'center' }}>{tr(label)}</Text>
        </Pressable>)}
      </ScrollView>
      <View style={{ marginTop: 20, marginBottom: 10 }}><M style={{ marginBottom: 9 }}>{tr('Wedding city')}</M><ScrollView horizontal showsHorizontalScrollIndicator={false}><Chip label={tr('All cities')} on={!city} onPress={() => setCity('')} />{CITIES.map(c => <Chip key={c} label={c} on={city === c} onPress={() => setCity(city === c ? '' : c)} />)}</ScrollView></View>
      <Card><Input label={tr('Maximum starting price (₹)')} value={budgetDraft} onChangeText={setBudgetDraft} keyboardType="decimal-pad" placeholder={tr('Any budget')} />
        {!validBudget && <Text accessibilityRole="alert" style={{ color: C.warn }}>{tr('Enter a valid budget amount.')}</Text>}
        <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Btn small kind="quiet" title={tr('Apply budget')} disabled={!validBudget} onPress={() => setBudget(budgetDraft)} /></View><View style={{ flex: 1 }}><Btn small kind="ghost" title={tr('Clear filters')} onPress={() => { setCity(''); setCategory(''); setQuery(''); setBudget(''); setBudgetDraft(''); }} /></View></View>
        {!!budget && <M>{tr('Starting price up to')} {inr(Number(budget) * 100)}</M>}
      </Card>
      {comparison.length > 0 && <Card><View style={s.row}><H style={{ fontSize: 20 }}>{tr('Compare vendors')} ({comparison.length}/3)</H><Btn small kind="ghost" title={tr('Clear')} onPress={() => { setComparison([]); setShowComparison(false); }} /></View>
        <M>{tr('Select up to three vendors to compare prices, location and ratings.')}</M><Btn kind="quiet" title={showComparison ? tr('Hide comparison') : tr('Show comparison')} onPress={() => setShowComparison(!showComparison)} />
        {showComparison && <ScrollView horizontal contentContainerStyle={{ gap: 12 }}>{comparison.map(item => <View key={item.id} style={{ width: 220, padding: 14, backgroundColor: C.bg, borderRadius: 12 }}><H style={{ fontSize: 20 }}>{item.name}</H><M>{categoryLabel(item.category)} · {item.city}</M><H style={{ color: C.primary }}>{inr(item.start_paise)}</H><M>{item.rating ? `${item.rating}/5 · ${item.reviews} ${tr('reviews')}` : tr('No reviews yet')}</M>{item.verified ? <Tag tone="ok" label={tr('Verified')} /> : null}<Btn small title={tr('View profile')} onPress={() => openVendor(item.id)} /><Btn small kind="ghost" title={tr('Remove')} onPress={() => toggleCompare(item)} /></View>)}</ScrollView>}
      </Card>}
      <SectionTitle title={filtered ? 'Matching vendors' : 'Vendor directory'} detail={vendors ? `${results.length} ${tr('vendors')}` : undefined} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>{[['recommended', 'Recommended'], ['price', 'Price: low to high'], ['rating', 'Top rated']].map(([key, label]) => <Chip key={key} label={tr(label)} on={sort === key} onPress={() => setSort(key)} />)}</View>
      {!!error && <Card><Text accessibilityRole="alert" style={{ color: C.warn, lineHeight: 21 }}>{error}</Text><Btn kind="quiet" title={tr('Try again')} onPress={() => setRefreshKey(k => k + 1)} /></Card>}
      {busy && !vendors && <Loading what={tr('vendors')} />}
    </>}
    ListEmptyComponent={!busy && vendors && !error ? <Empty icon="search" title={tr('No vendors match')} text={tr('Change your city or service to see more options.')} action={filtered ? tr('Clear filters') : undefined} onAction={() => { setCity(''); setCategory(''); setQuery(''); setBudget(''); setBudgetDraft(''); }} /> : null}
    renderItem={({ item, index }) => { const selected = comparison.some(v => v.id === item.id); return <Rise i={Math.min(index, 3)}><VendorCard vendor={item} onPress={() => openVendor(item.id)} /><View style={{ marginTop: -14, marginBottom: 20 }}><Btn small kind="ghost" icon={selected ? 'check' : 'plus'} title={selected ? tr('Remove from comparison') : tr('Add to comparison')} disabled={!selected && comparison.length >= 3} onPress={() => toggleCompare(item)} /></View></Rise>; }} />;
}

export function PublicExplore({ onSignIn, onBack }: { onSignIn: () => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<number | null>(null); const [vendor, setVendor] = useState<any>(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (selected === null) return;
    let active = true; setVendor(null); setError('');
    api('/vendors/' + selected).then(v => { if (active) setVendor(v); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [selected, retry]);
  return <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <View style={{ paddingHorizontal: 20 }}><Btn small kind="ghost" title={tr('Back')} onPress={() => selected === null ? onBack() : setSelected(null)} /></View>
    {selected === null ? <Marketplace openVendor={setSelected} onSignIn={onSignIn} /> : <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {error ? <Card><M style={{ color: C.warn }}>{error}</M><Btn title={tr('Try again')} onPress={() => setRetry(k => k + 1)} /></Card> : !vendor ? <Loading what={tr('vendor')} /> : <Rise>
        <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}><CategoryCover category={vendor.category} label={categoryLabel(vendor.category)} large /></View>
        <H style={{ fontSize: 30 }}>{vendor.name}</H><M>{categoryLabel(vendor.category)} · {vendor.city}</M>
        {vendor.verified ? <View style={{ marginTop: 12 }}><Tag tone="ok" icon="seal" label={tr('Verified')} /></View> : null}
        <Text style={{ color: C.ink, fontSize: 15, lineHeight: 24, marginVertical: 20 }}>{vendor.description}</Text>
        <Card><M>{tr('Starting price')}</M><H style={{ color: C.primary, fontSize: 30 }}>{inr(vendor.start_paise)}</H><Btn title={tr('Sign in to enquire')} onPress={onSignIn} /></Card>
        <VendorCatalog vendor={vendor} />
        <SectionTitle title="Reviews" />
        {vendor.reviewList?.length ? vendor.reviewList.map((review: any, i: number) => <Card key={i}><View style={s.row}><Text style={{ fontWeight: '600', color: C.ink }}>{review.name}</Text><M>{review.rating}/5</M></View><M style={{ marginTop: 8 }}>{review.text}</M></Card>) : <M>{tr('No reviews yet')}</M>}
      </Rise>}
    </ScrollView>}
  </View>;
}
