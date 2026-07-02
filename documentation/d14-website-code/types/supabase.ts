export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      division_cms_content: {
        Row: {
          content: string | null;
          division_id: number | null;
          id: number;
          last_updated: string | null;
          instagram: string | null;
          facebook: string | null;
        };
        Insert: {
          content?: string | null;
          division_id?: number | null;
          id?: number;
          last_updated?: string | null;
          instagram: string | null;
          facebook: string | null;
        };
        Update: {
          content?: string | null;
          division_id?: number | null;
          id?: number;
          last_updated?: string | null;
          instagram: string | null;
          facebook: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'division_cms_content_division_id_fkey';
            columns: ['division_id'];
            isOneToOne: true;
            referencedRelation: 'divisions';
            referencedColumns: ['id'];
          }
        ];
      };
      division_media: {
        Row: {
          id: number;
          division_id: number;
          display_name: string;
          file_link: string;
        };
        Insert: {
          id?: number;
          division_id: number;
          display_name: string;
          file_link: string;
        };
        Update: {
          id?: number;
          division_id?: number;
          display_name?: string;
          file_link?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'division_media_division_id_fkey';
            columns: ['division_id'];
            isOneToOne: false;
            referencedRelation: 'divisions';
            referencedColumns: ['id'];
          }
        ];
      };
      divisions: {
        Row: {
          id: number;
          name: string | null;
          chairman_id: string | null;
          results_link: string | null;
          points_link: string | null;
          shop_link: string | null;
          logo: string | null;
          main_img: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          chairman_id?: string | null;
          results_link?: string | null;
          points_link?: string | null;
          shop_link?: string | null;
          logo?: string | null;
          main_img?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          chairman_id?: string | null;
          results_link?: string | null;
          points_link?: string | null;
          shop_link?: string | null;
          logo?: string | null;
          main_img?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'divisions_chairman_id_fkey';
            columns: ['chairman_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      emails: {
        Row: {
          admin_id: string | null;
          content: string | null;
          date_created: string | null;
        };
        Insert: {
          admin_id?: string | null;
          content?: string | null;
          date_created?: string | null;
        };
        Update: {
          admin_id?: string | null;
          content?: string | null;
          date_created?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'emails_admin_id_fkey';
            columns: ['admin_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      contacts: {
        Row: {
          name: string;
          email: string;
          title: string;
          phone: string;
          address: string;
        };
        Insert: {
          name: string;
          email: string;
          title: string;
          phone: string;
          address: string;
        };
        Update: {
          name: string;
          email: string;
          title: string;
          phone: string;
          address: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          date: string;
          division_id: number | null;
          end_date: string | null;
          description: string | null;
          id: number;
          name: string | null;
          links: string | null;
        };
        Insert: {
          date: string;
          division_id?: number | null;
          end_date?: string | null;
          description: string | null;
          id?: number;
          name?: string | null;
          links?: string | null;
        };
        Update: {
          date?: string;
          division_id?: number | null;
          end_date?: string | null;
          description: string | null;
          id?: number;
          name?: string | null;
          links?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_division_id_fkey';
            columns: ['division_id'];
            isOneToOne: false;
            referencedRelation: 'divisions';
            referencedColumns: ['id'];
          }
        ];
      };
      magazine_issues: {
        Row: {
          date_created: string | null;
          id: number;
          issue_name: string | null;
          magazine_storage_url: string | null;
        };
        Insert: {
          date_created?: string | null;
          id?: number;
          issue_name?: string | null;
          magazine_storage_url?: string | null;
        };
        Update: {
          date_created?: string | null;
          id?: number;
          issue_name?: string | null;
          magazine_storage_url?: string | null;
        };
        Relationships: [];
      };
      membership_receipts: {
        Row: {
          amount_paid: number | null;
          date_created: string | null;
          id: number;
          profile_id: string;
          stripe_transaction_id: string;
        };
        Insert: {
          amount_paid?: number | null;
          date_created?: string | null;
          id?: number;
          profile_id: string;
          stripe_transaction_id?: string;
        };
        Update: {
          amount_paid?: number | null;
          date_created?: string | null;
          id?: number;
          profile_id?: string;
          stripe_transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'membership_receipts_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      memberships: {
        Row: {
          date_created: string | null;
          expiration: string;
          id: number;
          profile_id: string;
          last_modified: string | null;
        };
        Insert: {
          date_created?: string | null;
          expiration: string;
          id?: number;
          profile_id: string;
          last_modified?: string | null;
        };
        Update: {
          date_created?: string | null;
          expiration?: string;
          id?: number;
          profile_id?: string;
          last_modified?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'memberships_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      membership_notes: {
        Row: {
          id: number;
          membership_id: string;
          admin_id: string;
          note_content: string;
          last_modified: string;
          on_card: boolean;
        };
        Insert: {
          id?: number;
          membership_id: string;
          admin_id: string;
          note_content: string;
          last_modified?: string;
          on_card?: boolean;
        };
        Update: {
          id?: number;
          membership_id?: string;
          admin_id?: string;
          note_content?: string;
          last_modified?: string;
          on_card?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'membership_notes_membership_id_fkey';
            columns: ['membership_id'];
            isOneToOne: false;
            referencedRelation: 'memberships';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'membership_notes_admin_id_fkey';
            columns: ['admin_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      profile_roles: {
        Row: {
          profile_id: string;
          role: string;
        };
        Insert: {
          profile_id: string;
          role: string;
        };
        Update: {
          profile_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_roles_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      profiles: {
        Row: {
          first_name: string | null;
          middle_initial: string | null;
          id: string;
          profile_picture: string | null;
          last_name: string | null;
          email: string | null;
          home_phone: string | null;
          cell_phone: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          member_type: string | null;
          membership_option: string | null;
          disciplines: string[] | null;
          ama_number: string | null;
          d14_number: string | null;
          birthdate: string | null;
          signature: string | null;
          date_signed: string | null;
          parent_id: string | null;
          role: string | null;
          last_modified: string | null;
          card_status: boolean | null;
          organization_id: number | null;
        };
        Insert: {
          first_name?: string | null;
          id: string;
          last_name?: string | null;
        };
        Update: {
          first_name?: string | null;
          middle_initial?: string | null;
          id?: string;
          last_name?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          home_phone?: string | null;
          cell_phone?: string | null;
          last_modified?: string | null;
          role?: string | null;
          card_status?: boolean | null;
          organization_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          }
        ];
      };
      temp_membership_form_data: {
        Row: {
          id: number;
          user_id: string; // UUID of the user
          membership_option: string | null;
          first_name: string | null;
          middle_initial: string | null;
          last_name: string | null;
          suffix: string | null;
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          email: string | null;
          disciplines: string[] | null; // Array of disciplines
          ama_number: string | null;
          birthdate: string | null;
          home_phone: string | null;
          cell_phone: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          signature: string | null;
          date_signed: string | null;
          created_at: string;
          member_type: string | null;
        };
        Insert: {
          user_id: string | null;
          membership_option?: string | null;
          first_name?: string | null;
          middle_initial?: string | null;
          last_name?: string | null;
          suffix?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          email?: string | null;
          disciplines?: string[] | null;
          ama_number?: string | null;
          birthdate?: string | null;
          home_phone?: string | null;
          cell_phone?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          signature?: string | null;
          date_signed?: string | null;
        };
        Update: {
          membership_option?: string | null;
          first_name?: string | null;
          middle_initial?: string | null;
          last_name?: string | null;
          suffix?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          email?: string | null;
          disciplines?: string[] | null;
          ama_number?: string | null;
          birthdate?: string | null;
          home_phone?: string | null;
          cell_phone?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          signature?: string | null;
          date_signed?: string | null;
        };
      };
      renewals: {
        Row: {
          id: string;
          parent_id: string;
        };
        Insert: {
          id: string;
          parent_id?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
        };
      };
      organizations: {
        Row: {
          id: number;
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          email: string | null;
          phone: string | null;
          ama_number: string | null;
          website: string | null;
          organization_user_id: string | null;
          primary_contact_name: string | null;
          primary_contact_email: string | null;
          primary_contact_phone: string | null;
          primary_contact_d14: string | null;
          primary_contact_address: string | null;
          primary_contact_city: string | null;
          primary_contact_state: string | null;
          primary_contact_zip: string | null;
          primary_contact_country: string | null;
          president_name: string | null;
          president_email: string | null;
          president_phone: string | null;
          president_d14: string | null;
          president_address: string | null;
          president_city: string | null;
          president_state: string | null;
          president_zip: string | null;
          president_country: string | null;
          referee_name: string | null;
          referee_email: string | null;
          referee_phone: string | null;
          referee_d14: string | null;
          referee_address: string | null;
          referee_city: string | null;
          referee_state: string | null;
          referee_zip: string | null;
          referee_country: string | null;
        };
        Insert: {
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          email: string | null;
          phone: string | null;
          ama_number: string | null;
          website: string | null;
          organization_user_id: string | null;
          primary_contact_name: string | null;
          primary_contact_email: string | null;
          primary_contact_phone: string | null;
          primary_contact_d14: string | null;
          primary_contact_address: string | null;
          primary_contact_city: string | null;
          primary_contact_state: string | null;
          primary_contact_zip: string | null;
          primary_contact_country: string | null;
          president_name: string | null;
          president_email: string | null;
          president_phone: string | null;
          president_d14: string | null;
          president_address: string | null;
          president_city: string | null;
          president_state: string | null;
          president_zip: string | null;
          president_country: string | null;
          referee_name: string | null;
          referee_email: string | null;
          referee_phone: string | null;
          referee_d14: string | null;
          referee_address: string | null;
          referee_city: string | null;
          referee_state: string | null;
          referee_zip: string | null;
          referee_country: string | null;
        };
        Update: {
          name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          email: string | null;
          phone: string | null;
          ama_number: string | null;
          website: string | null;
          organization_user_id: string | null;
          primary_contact_name: string | null;
          primary_contact_email: string | null;
          primary_contact_phone: string | null;
          primary_contact_d14: string | null;
          primary_contact_address: string | null;
          primary_contact_city: string | null;
          primary_contact_state: string | null;
          primary_contact_zip: string | null;
          primary_contact_country: string | null;
          president_name: string | null;
          president_email: string | null;
          president_phone: string | null;
          president_d14: string | null;
          president_address: string | null;
          president_city: string | null;
          president_state: string | null;
          president_zip: string | null;
          president_country: string | null;
          referee_name: string | null;
          referee_email: string | null;
          referee_phone: string | null;
          referee_d14: string | null;
          referee_address: string | null;
          referee_city: string | null;
          referee_state: string | null;
          referee_zip: string | null;
          referee_country: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_primary_contact_id_fkey';
            columns: ['primary_contact_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      rules: {
        Row: {
          content: string;
          division_id: number | null;
          id: number;
          name: string | null;
        };
        Insert: {
          content: string;
          division_id?: number | null;
          id?: number;
          name?: string | null;
        };
        Update: {
          content?: string;
          division_id?: number | null;
          id?: number;
          name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'rules_division_id_fkey';
            columns: ['division_id'];
            isOneToOne: false;
            referencedRelation: 'divisions';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
      PublicSchema['Views'])
  ? (PublicSchema['Tables'] &
      PublicSchema['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
  ? PublicSchema['Enums'][PublicEnumNameOrOptions]
  : never;
