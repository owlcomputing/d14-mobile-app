import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Database } from '../../../../types/supabase';
import { Profile } from '../../features/admin/models/models';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public supabase = createClient<Database>(environment.supabaseUrl, environment.supabasePublicKey);

  // Insert form data into the temporary table
  async cacheMembershipData(membershipData: any) {
    const { data, error } = await this.supabase
      .from('temp_membership_form_data')
      .insert(membershipData);

    if (error) {
      console.error('Error caching membership data:', error.message);
      throw error;
    }

    return data;
  }

  // Fetch cached data by user_id
  async getCachedMembershipData(userId: string) {
    const { data, error } = await this.supabase
      .from('temp_membership_form_data')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching cached membership data:', error.message);
      throw error;
    }

    return data;
  }

  // Remove cached data
  async removeCachedMembershipData(userId: string) {
    const { data, error } = await this.supabase
      .from('temp_membership_form_data')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing cached membership data:', error.message);
      throw error;
    }

    return data;
  }
}


