import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api } from './api';
import { Bar, Btn, C, Card, H, M, Tag, s } from './ui';
import { tr } from './i18n';
import { Icon } from './icons';

type Checkpoint = { key: string; title: string; done: boolean; detail: string; tab: string };
type Journey = { done: number; total: number; phases: { key: string; title: string; description: string; checks: Checkpoint[] }[] };

export function PlanningJourney({ open, refreshKey }: { open: (tab: string) => void; refreshKey: unknown }) {
  const [data, setData] = useState<Journey | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setError('');
    api<Journey>('/planner/journey').then(d => { if (active) setData(d); }).catch(e => { if (active) setError(String(e.message || e)); });
    return () => { active = false; };
  }, [refreshKey, retry]);
  return <View style={{ marginTop: 12 }}>
    <H>{tr('Your planning journey')}</H>
    <M style={{ marginBottom: 12 }}>{tr('From the first decisions to the last thank-you. Checkpoints reflect your saved plan; choose what fits your wedding.')}</M>
    {error ? <Card><M style={{ color: C.warn }}>{error}</M><Btn kind="quiet" title={tr('Retry planning journey')} onPress={() => setRetry(v => v + 1)} /></Card> : null}
    {data ? <Card>
      <View style={s.row}><M>{tr('Planning checkpoints')}</M><M>{data.done}/{data.total} {tr('recorded')}</M></View>
      <View style={{ marginVertical: 12 }}><Bar pct={data.total ? data.done / data.total * 100 : 0} /></View>
      {data.phases.map((phase, i) => {
        const done = phase.checks.filter(c => c.done).length;
        const selected = expanded === phase.key;
        return <View key={phase.key} style={{ borderTopWidth: 1, borderTopColor: C.line }}>
          <Pressable accessibilityRole="button" aria-expanded={selected} accessibilityLabel={`${tr(phase.title)}, ${done} ${tr('of')} ${phase.checks.length}`} onPress={() => setExpanded(selected ? null : phase.key)} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done === phase.checks.length ? C.okSoft : C.tint, alignItems: 'center', justifyContent: 'center' }}>
              {done === phase.checks.length ? <Icon name="check" size={16} color={C.ok} /> : <Text style={{ color: C.primary, fontSize: 13 }}>{i + 1}</Text>}
            </View>
            <Text maxFontSizeMultiplier={1.3} style={{ color: C.ink, fontSize: 15, fontWeight: '500', flex: 1 }}>{tr(phase.title)}</Text>
            <Tag tone={done === phase.checks.length ? 'ok' : 'mute'} label={`${done}/${phase.checks.length}`} />
            <Icon name="chevron" size={16} color={C.mute} />
          </Pressable>
          {selected ? <View style={{ paddingBottom: 12 }}>
            <M style={{ marginBottom: 8 }}>{tr(phase.description)}</M>
            {phase.checks.map(check => <Pressable key={check.key} accessibilityRole="button" accessibilityLabel={`${tr(check.title)}. ${tr(check.detail)}`} onPress={() => open(check.tab)} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <Icon name={check.done ? 'check' : 'chevron'} size={18} color={check.done ? C.ok : C.primary} />
              <View style={{ flex: 1 }}><Text maxFontSizeMultiplier={1.3} style={{ color: C.ink, fontSize: 15 }}>{tr(check.title)}</Text><M style={{ marginTop: 3 }}>{tr(check.detail)}</M></View>
            </Pressable>)}
          </View> : null}
        </View>;
      })}
    </Card> : !error ? <M>{tr('Loading your planning journey…')}</M> : null}
  </View>;
}
