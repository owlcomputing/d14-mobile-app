import { useQuery } from '@tanstack/react-query';

import { supabase } from './supabase';

export function useDivisions() {
  return useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('divisions').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useUpcomingEvents(limit?: number, divisionId?: number) {
  return useQuery({
    queryKey: ['events', 'upcoming', limit ?? null, divisionId ?? null],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('events')
        .select('*, divisions(id, name, logo)')
        .gte('date', today)
        .order('date', { ascending: true });
      if (divisionId) query = query.eq('division_id', divisionId);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useEventsForMonth(year: number, month: number, divisionId?: number) {
  const start = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['events', 'month', start, divisionId ?? null],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*, divisions(id, name, logo)')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });
      if (divisionId) query = query.eq('division_id', divisionId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useEvent(id: number) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, divisions(id, name, logo)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useDivision(id: number) {
  return useQuery({
    queryKey: ['divisions', id],
    queryFn: async () => {
      const [division, cms, media, rules] = await Promise.all([
        supabase.from('divisions').select('*').eq('id', id).single(),
        supabase.from('division_cms_content').select('*').eq('division_id', id).maybeSingle(),
        supabase.from('division_media').select('*').eq('division_id', id),
        supabase.from('rules').select('id, name').eq('division_id', id),
      ]);
      if (division.error) throw division.error;
      return {
        ...division.data,
        cms: cms.data ?? null,
        media: media.data ?? [],
        rules: rules.data ?? [],
      };
    },
  });
}

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*');
      if (error) throw error;
      return data;
    },
  });
}

export function useFamilyMembers(parentId: string | undefined) {
  return useQuery({
    queryKey: ['family', parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, memberships(expiration)')
        .eq('parent_id', parentId!);
      if (error) throw error;
      return data;
    },
  });
}
