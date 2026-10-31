// Screens for people who haven't signed in yet: the app is open to explore, and planning starts with an account.
import React, { useContext } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { tr } from './i18n';
import { Btn, C, Card, Chip, F, M } from './ui';
import { Icon, IconName } from './icons';
import { FloralArch } from './visuals';

const PLAN_PERKS: [IconName, string, string][] = [
  ['checklist', 'A checklist timed to your date', 'Tasks are spaced out from today to the wedding, with reminders on your phone.'],
  ['wallet', 'A budget split across services', 'See what each service should cost and what you have booked or paid.'],
  ['family', 'Guests and RSVPs per ceremony', 'Invite people to the haldi, sangeet or wedding separately and get headcounts.'],
  ['chat', 'Vendors, quotes and payments together', 'Ask several vendors at once, compare quotes, and pay in instalments.'],
];

// Plan tab before sign-in: what planning gives you, and one way in.
export function StartPlanning({ navigation }: any) {
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
    <View style={{ backgroundColor: C.primary, padding: 24, paddingTop: 32, overflow: 'hidden' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -30, bottom: -50, opacity: 0.3 }}><FloralArch size={160} color={C.goldSoft} /></View>
      <Text style={{ fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.goldSoft, maxWidth: 300 }}>{tr('Plan your wedding in one place')}</Text>
      <Text style={{ color: '#F4DDE5', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 320 }}>{tr('Tell us your date, city and budget, and we set up your plan. Your family can join it too.')}</Text>
    </View>
    <View style={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Card style={{ paddingVertical: 8 }}>{PLAN_PERKS.map(([icon, title, detail], i) => <View key={title} style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={20} color={C.primary} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 15, fontWeight: '500' }}>{tr(title)}</Text><M style={{ marginTop: 2 }}>{tr(detail)}</M></View>
      </View>)}</Card>
      <Btn title={tr('Create a free account to start')} onPress={() => navigation.navigate('SignIn')} />
      <M style={{ textAlign: 'center', marginTop: 4 }}>{tr('Takes a minute: your mobile number, a code and your name.')}</M>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SignIn')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.primary, fontSize: 15, fontWeight: '500' }}>{tr('I already have an account · Sign in')}</Text>
      </Pressable>
    </View>
  </ScrollView>;
}

// My vendors before sign-in.
export function GuestVendors({ navigation }: any) {
  return <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon name="chat" size={26} color={C.primary} /></View>
      <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, textAlign: 'center' }}>{tr('Your vendors will appear here')}</Text>
      <M style={{ textAlign: 'center', marginTop: 4, maxWidth: 300 }}>{tr('Sign in to send enquiries. Each vendor then stays here from first message to final payment.')}</M>
    </View>
    <Btn title={tr('Sign in or create an account')} onPress={() => navigation.navigate('SignIn')} />
    <Btn kind="ghost" title={tr('Find vendors')} onPress={() => navigation.navigate('Discover')} />
  </View>;
}

// Profile before sign-in: language, a way in, and what this build is.
export function GuestProfile({ navigation }: any) {
  return <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
    <Card>
      <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink }}>{tr('You’re not signed in')}</Text>
      <M style={{ marginTop: 4 }}>{tr('Sign in to plan your wedding, save vendors and send enquiries. Vendors sign in here too.')}</M>
      <Btn title={tr('Sign in or create an account')} onPress={() => navigation.navigate('SignIn')} />
    </Card>
    <M style={{ marginTop: 16 }}>{tr('Demo build: payments, OTP and WhatsApp are simulated. Booking Protection and escrow do not move real money.')}</M>
  </ScrollView>;
}
