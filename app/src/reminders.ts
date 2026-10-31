// Task reminders as local notifications: scheduled on the phone for 9 am on each due date, so no push server is needed.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { tr } from './i18n';

const supported = Platform.OS !== 'web';
// iOS keeps at most 64 pending local notifications; stay well under it.
const MAX_SCHEDULED = 40;

if (supported) Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function remindersEnabled() {
  if (!supported) return false;
  const [permission, setting] = await Promise.all([Notifications.getPermissionsAsync().catch(() => null), AsyncStorage.getItem('reminders').catch(() => null)]);
  return !!permission?.granted && setting === 'on';
}

export async function enableReminders() {
  if (!supported) throw new Error(tr('Phone reminders work in the iPhone and Android app.'));
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error(tr('Allow notifications for Shaadi OS in your phone settings to get reminders.'));
  await AsyncStorage.setItem('reminders', 'on');
  return syncReminders();
}

export async function disableReminders() {
  await AsyncStorage.setItem('reminders', 'off');
  if (supported) await Notifications.cancelAllScheduledNotificationsAsync();
}

// Replaces every scheduled reminder with one per open task that is still ahead; returns how many were scheduled.
export async function syncReminders() {
  if (!(await remindersEnabled())) return 0;
  const tasks = await api<any[]>('/tasks').catch(() => null);
  if (!tasks) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now(); let count = 0;
  for (const t of tasks.filter(t => !t.done && t.due).sort((a, b) => a.due.localeCompare(b.due))) {
    const at = new Date(`${t.due}T09:00:00`);
    if (at.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({ content: { title: tr('Wedding task due today'), body: t.title }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at } });
    if (++count >= MAX_SCHEDULED) break;
  }
  return count;
}
