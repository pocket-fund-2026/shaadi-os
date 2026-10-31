import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, getBase } from './api';
import { tr } from './i18n';
import { Btn, C, Card, Check, Empty, H, Input, Loading, M, confirm, inr } from './ui';
import { Icon } from './icons';

export function PortfolioPhoto({ uri, caption = '', height = 180 }: { uri: string; caption?: string; height?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return failed ? <View style={{ height, backgroundColor: C.chipBg, justifyContent: 'center', alignItems: 'center', gap: 8 }}><Icon name="camera" color={C.mute} /><M>{tr('Photo unavailable')}</M></View> :
    <Image source={{ uri: uri.startsWith('/') ? getBase() + uri : uri }} accessibilityLabel={caption || tr('Vendor portfolio photo')} resizeMode="cover" style={{ height, width: '100%', backgroundColor: C.chipBg }} onError={() => setFailed(true)} />;
}
export function VendorCatalog({ vendor }: { vendor: any }) {
  const photos = vendor.photos || []; const packages = vendor.packages || [];
  return <>
    <H style={{ marginTop: 28 }}>{tr('Portfolio')}</H>
    {photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 12 }}>{photos.map((photo: any) => <View key={photo.id} style={{ width: 260 }}><View style={{ overflow: 'hidden', borderRadius: 12 }}><PortfolioPhoto uri={photo.url} caption={photo.caption} /></View>{photo.caption ? <M style={{ marginTop: 8 }}>{photo.caption}</M> : null}</View>)}</ScrollView> : <M>{tr('This vendor has not added portfolio photos yet.')}</M>}
    <H style={{ marginTop: 28 }}>{tr('Packages')}</H>
    {packages.length ? packages.map((item: any) => <Card key={item.id}><Text style={{ fontWeight: '500', fontSize: 17, color: C.ink }}>{item.title}</Text><H style={{ color: C.primary }}>{inr(item.price_paise)}</H><M>{item.description}</M><M style={{ marginTop: 12 }}>{tr('Confirm dates and inclusions with the vendor before booking.')}</M></Card>) : <M>{tr('Enquire with the vendor for a package tailored to your wedding.')}</M>}
  </>;
}
export function CatalogEditor() {
  const [catalog, setCatalog] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(''); const [caption, setCaption] = useState(''); const [permission, setPermission] = useState(false);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [price, setPrice] = useState('');
  const load = async () => { setError(''); try { setCatalog(await api('/vendor/catalog')); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  useEffect(() => { load(); }, []);
  const mutate = async (path: string, method: string, body?: any) => {
    if (busy) return false;
    setBusy(true); setError('');
    try { setCatalog(await api(path, method, body)); return true; } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; } finally { setBusy(false); }
  };
  // Picks a photo from the phone's library and uploads it; iOS converts HEIC to JPEG so every browser can show it.
  const uploadPhoto = async () => {
    if (!permission) return setError(tr('Confirm you have permission to publish the photo first.'));
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }).catch(e => { setError(e?.message || String(e)); return null; });
    const asset = picked && !picked.canceled ? picked.assets[0] : null;
    if (!asset) return;
    const data = asset.base64 || (asset.uri.startsWith('data:') ? asset.uri : '');
    if (!data) return setError(tr('That photo could not be read. Try another one.'));
    if (await mutate('/vendor/photos/upload', 'POST', { data, caption, permission_confirmed: true })) { setCaption(''); setPermission(false); }
  };
  const addPhoto = async () => { if (await mutate('/vendor/photos', 'POST', { url: url.trim(), caption, permission_confirmed: permission })) { setUrl(''); setCaption(''); setPermission(false); } };
  const addPackage = async () => {
    if (!/^\d+(\.\d{1,2})?$/.test(price.trim()) || Number(price) <= 0) return setError(tr('Enter a valid package price.'));
    const [whole, decimal = ''] = price.trim().split('.'); const paise = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    if (!Number.isSafeInteger(paise)) return setError(tr('Enter a valid package price.'));
    if (await mutate('/vendor/packages', 'POST', { title, description, price_paise: paise })) { setTitle(''); setDescription(''); setPrice(''); }
  };
  const remove = async (kind: string, id: number) => { if (await confirm(tr('Remove item?'), tr('This item will be removed from your public storefront.'), tr('Remove'), true)) await mutate(`/vendor/${kind}/${id}`, 'DELETE'); };
  return <View style={{ marginTop: 20 }}>
    <H>{tr('Your portfolio and packages')}</H>
    {!!error && <Card><Text accessibilityRole="alert" style={{ color: C.warn }}>{error}</Text>{!catalog && <Btn title={tr('Try again')} onPress={load} />}</Card>}
    {!catalog ? !error && <Loading what={tr('portfolio')} /> : <>
      <Card><H style={{ fontSize: 20 }}>{tr('Add a portfolio photo')}</H><M style={{ marginBottom: 12 }}>{tr('Upload from your phone, or paste a link to a photo already online.')}</M>
        <Input label={tr('Photo caption')} value={caption} onChangeText={setCaption} maxLength={160} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: permission }} onPress={() => setPermission(!permission)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 8 }}><Check on={permission} /><Text style={{ color: C.ink, flex: 1, lineHeight: 21 }}>{tr('I have permission to publish this photo and any people shown in it.')}</Text></Pressable>
        <Btn icon="camera" title={busy ? tr('Uploading…') : tr('Upload from phone')} disabled={busy || !permission || catalog.photos.length >= 12} onPress={uploadPhoto} />
        <Input label={tr('Or paste a photo link')} value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" maxLength={2000} placeholder="https://" />
        <Btn kind="ghost" icon="plus" title={tr('Add from link')} disabled={busy || !permission || !url.trim() || catalog.photos.length >= 12} onPress={addPhoto} /><M>{catalog.photos.length}/12 {tr('photos')}</M>
      </Card>
      {catalog.photos.map((photo: any) => <Card key={photo.id}><PortfolioPhoto uri={photo.url} caption={photo.caption} />{photo.caption ? <M style={{ marginTop: 8 }}>{photo.caption}</M> : null}<Btn small kind="ghost" title={tr('Remove photo')} disabled={busy} onPress={() => remove('photos', photo.id)} /></Card>)}
      <Card><H style={{ fontSize: 20 }}>{tr('Add a package')}</H><Input label={tr('Package name')} value={title} onChangeText={setTitle} maxLength={100} />
        <Input label={tr('Package price (₹)')} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Input label={tr('What is included')} value={description} onChangeText={setDescription} multiline maxLength={1000} style={{ minHeight: 96, textAlignVertical: 'top' }} />
        <Btn icon="plus" title={tr('Add package')} disabled={busy || !title.trim() || !description.trim() || !price.trim() || catalog.packages.length >= 8} onPress={addPackage} /><M>{catalog.packages.length}/8 {tr('packages')}</M>
      </Card>
      {catalog.packages.map((item: any) => <Card key={item.id}><H style={{ fontSize: 20 }}>{item.title}</H><M>{item.description}</M><H style={{ color: C.primary }}>{inr(item.price_paise)}</H><Btn small kind="ghost" title={tr('Remove package')} disabled={busy} onPress={() => remove('packages', item.id)} /></Card>)}
    </>}
  </View>;
}
