export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.1 (8cbcf98)"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          address: string | null
          email: string | null
          id: number
          name: string | null
          phone: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: number
          name?: string | null
          phone?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: number
          name?: string | null
          phone?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      division_cms_content: {
        Row: {
          content: string | null
          division_id: number | null
          facebook: string | null
          id: number
          instagram: string | null
          last_updated: string | null
        }
        Insert: {
          content?: string | null
          division_id?: number | null
          facebook?: string | null
          id?: number
          instagram?: string | null
          last_updated?: string | null
        }
        Update: {
          content?: string | null
          division_id?: number | null
          facebook?: string | null
          id?: number
          instagram?: string | null
          last_updated?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "division_cms_content_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: true
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      division_media: {
        Row: {
          display_name: string
          division_id: number | null
          file_link: string
          id: number
        }
        Insert: {
          display_name: string
          division_id?: number | null
          file_link: string
          id?: never
        }
        Update: {
          display_name?: string
          division_id?: number | null
          file_link?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "division_media_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          chairman_id: string | null
          id: number
          logo: string | null
          main_img: string | null
          name: string | null
          points_link: string | null
          results_link: string | null
          shop_link: string | null
        }
        Insert: {
          chairman_id?: string | null
          id?: number
          logo?: string | null
          main_img?: string | null
          name?: string | null
          points_link?: string | null
          results_link?: string | null
          shop_link?: string | null
        }
        Update: {
          chairman_id?: string | null
          id?: number
          logo?: string | null
          main_img?: string | null
          name?: string | null
          points_link?: string | null
          results_link?: string | null
          shop_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "divisions_chairman_id_fkey"
            columns: ["chairman_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          admin_id: string | null
          content: string | null
          date_created: string | null
        }
        Insert: {
          admin_id?: string | null
          content?: string | null
          date_created?: string | null
        }
        Update: {
          admin_id?: string | null
          content?: string | null
          date_created?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          date: string
          description: string | null
          division_id: number | null
          end_date: string | null
          id: number
          latitude: number | null
          link: Json | null
          longitude: number | null
          name: string | null
        }
        Insert: {
          address?: string | null
          date: string
          description?: string | null
          division_id?: number | null
          end_date?: string | null
          id?: number
          latitude?: number | null
          link?: Json | null
          longitude?: number | null
          name?: string | null
        }
        Update: {
          address?: string | null
          date?: string
          description?: string | null
          division_id?: number | null
          end_date?: string | null
          id?: number
          latitude?: number | null
          link?: Json | null
          longitude?: number | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      magazine_issues: {
        Row: {
          date_created: string | null
          id: number
          issue_name: string | null
          magazine_storage_url: string | null
        }
        Insert: {
          date_created?: string | null
          id?: number
          issue_name?: string | null
          magazine_storage_url?: string | null
        }
        Update: {
          date_created?: string | null
          id?: number
          issue_name?: string | null
          magazine_storage_url?: string | null
        }
        Relationships: []
      }
      membership_notes: {
        Row: {
          admin_id: string | null
          id: number
          last_modified: string | null
          membership_id: string | null
          note_content: string
          on_card: boolean | null
        }
        Insert: {
          admin_id?: string | null
          id?: number
          last_modified?: string | null
          membership_id?: string | null
          note_content: string
          on_card?: boolean | null
        }
        Update: {
          admin_id?: string | null
          id?: number
          last_modified?: string | null
          membership_id?: string | null
          note_content?: string
          on_card?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_notes_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_receipts: {
        Row: {
          amount_paid: number | null
          date_created: string | null
          id: number
          payment_method: string | null
          profile_id: string | null
          stripe_transaction_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          date_created?: string | null
          id?: number
          payment_method?: string | null
          profile_id?: string | null
          stripe_transaction_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          date_created?: string | null
          id?: number
          payment_method?: string | null
          profile_id?: string | null
          stripe_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_parent"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_profile_id"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_receipts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          date_created: string | null
          expiration: string
          id: number
          last_modified: string | null
          profile_id: string
        }
        Insert: {
          date_created?: string | null
          expiration: string
          id?: number
          last_modified?: string | null
          profile_id: string
        }
        Update: {
          date_created?: string | null
          expiration?: string
          id?: number
          last_modified?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profile_id"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships_backup: {
        Row: {
          date_created: string | null
          expiration: string | null
          id: number | null
          profile_id: string | null
        }
        Insert: {
          date_created?: string | null
          expiration?: string | null
          id?: number | null
          profile_id?: string | null
        }
        Update: {
          date_created?: string | null
          expiration?: string | null
          id?: number | null
          profile_id?: string | null
        }
        Relationships: []
      }
      old_members: {
        Row: {
          address_main_address_city: string | null
          address_main_address_country: string | null
          address_main_address_line_1: string | null
          address_main_address_line_2: string | null
          address_main_address_state: string | null
          address_main_address_zip: string | null
          address_primary_city: string | null
          address_primary_country: string | null
          address_primary_line_1: string | null
          address_primary_line_2: string | null
          address_primary_state: string | null
          address_primary_zip: string | null
          ama_number: string | null
          auto_renew: boolean | null
          birthdate: string | null
          contact_name: string | null
          county: string | null
          created_date: string | null
          d14_number: string | null
          discipline: string | null
          email_primary: string | null
          email_primary_email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone_number: string | null
          expiration_date: string | null
          fax: string | null
          group_name: string | null
          join_date: string | null
          key_contact: string | null
          last_login_date: string | null
          last_modified_date: string | null
          last_renewal_date: string | null
          link_to_organization_id: string | null
          member_number: string | null
          member_status: string | null
          member_type: string | null
          name_first: string | null
          name_last: string | null
          name_middle: string | null
          name_prefix: string | null
          name_suffix: string | null
          organization: string | null
          organization_address_city: string | null
          organization_address_country: string | null
          organization_address_line_1: string | null
          organization_address_line_2: string | null
          organization_address_state: string | null
          organization_address_zip: string | null
          organization_email: string | null
          organization_id: string | null
          organization_phone: string | null
          phone_cell_phone: string | null
          phone_home_phone: string | null
          phone_primary: string | null
          profile_id: string | null
          profile_notes: string | null
          promoter_id: string | null
          renewal_status: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          address_main_address_city?: string | null
          address_main_address_country?: string | null
          address_main_address_line_1?: string | null
          address_main_address_line_2?: string | null
          address_main_address_state?: string | null
          address_main_address_zip?: string | null
          address_primary_city?: string | null
          address_primary_country?: string | null
          address_primary_line_1?: string | null
          address_primary_line_2?: string | null
          address_primary_state?: string | null
          address_primary_zip?: string | null
          ama_number?: string | null
          auto_renew?: boolean | null
          birthdate?: string | null
          contact_name?: string | null
          county?: string | null
          created_date?: string | null
          d14_number?: string | null
          discipline?: string | null
          email_primary?: string | null
          email_primary_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone_number?: string | null
          expiration_date?: string | null
          fax?: string | null
          group_name?: string | null
          join_date?: string | null
          key_contact?: string | null
          last_login_date?: string | null
          last_modified_date?: string | null
          last_renewal_date?: string | null
          link_to_organization_id?: string | null
          member_number?: string | null
          member_status?: string | null
          member_type?: string | null
          name_first?: string | null
          name_last?: string | null
          name_middle?: string | null
          name_prefix?: string | null
          name_suffix?: string | null
          organization?: string | null
          organization_address_city?: string | null
          organization_address_country?: string | null
          organization_address_line_1?: string | null
          organization_address_line_2?: string | null
          organization_address_state?: string | null
          organization_address_zip?: string | null
          organization_email?: string | null
          organization_id?: string | null
          organization_phone?: string | null
          phone_cell_phone?: string | null
          phone_home_phone?: string | null
          phone_primary?: string | null
          profile_id?: string | null
          profile_notes?: string | null
          promoter_id?: string | null
          renewal_status?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          address_main_address_city?: string | null
          address_main_address_country?: string | null
          address_main_address_line_1?: string | null
          address_main_address_line_2?: string | null
          address_main_address_state?: string | null
          address_main_address_zip?: string | null
          address_primary_city?: string | null
          address_primary_country?: string | null
          address_primary_line_1?: string | null
          address_primary_line_2?: string | null
          address_primary_state?: string | null
          address_primary_zip?: string | null
          ama_number?: string | null
          auto_renew?: boolean | null
          birthdate?: string | null
          contact_name?: string | null
          county?: string | null
          created_date?: string | null
          d14_number?: string | null
          discipline?: string | null
          email_primary?: string | null
          email_primary_email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone_number?: string | null
          expiration_date?: string | null
          fax?: string | null
          group_name?: string | null
          join_date?: string | null
          key_contact?: string | null
          last_login_date?: string | null
          last_modified_date?: string | null
          last_renewal_date?: string | null
          link_to_organization_id?: string | null
          member_number?: string | null
          member_status?: string | null
          member_type?: string | null
          name_first?: string | null
          name_last?: string | null
          name_middle?: string | null
          name_prefix?: string | null
          name_suffix?: string | null
          organization?: string | null
          organization_address_city?: string | null
          organization_address_country?: string | null
          organization_address_line_1?: string | null
          organization_address_line_2?: string | null
          organization_address_state?: string | null
          organization_address_zip?: string | null
          organization_email?: string | null
          organization_id?: string | null
          organization_phone?: string | null
          phone_cell_phone?: string | null
          phone_home_phone?: string | null
          phone_primary?: string | null
          profile_id?: string | null
          profile_notes?: string | null
          promoter_id?: string | null
          renewal_status?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          address: string | null
          ama_number: number | null
          city: string | null
          country: string | null
          email: string | null
          id: number
          name: string | null
          organization_user_id: string | null
          phone: string | null
          president_address: string | null
          president_city: string | null
          president_country: string | null
          president_d14: string | null
          president_email: string | null
          president_name: string | null
          president_phone: string | null
          president_state: string | null
          president_zip: string | null
          primary_contact_address: string | null
          primary_contact_city: string | null
          primary_contact_country: string | null
          primary_contact_d14: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_state: string | null
          primary_contact_zip: string | null
          referee_address: string | null
          referee_city: string | null
          referee_country: string | null
          referee_d14: string | null
          referee_email: string | null
          referee_name: string | null
          referee_phone: string | null
          referee_state: string | null
          referee_zip: string | null
          state: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          ama_number?: number | null
          city?: string | null
          country?: string | null
          email?: string | null
          id?: number
          name?: string | null
          organization_user_id?: string | null
          phone?: string | null
          president_address?: string | null
          president_city?: string | null
          president_country?: string | null
          president_d14?: string | null
          president_email?: string | null
          president_name?: string | null
          president_phone?: string | null
          president_state?: string | null
          president_zip?: string | null
          primary_contact_address?: string | null
          primary_contact_city?: string | null
          primary_contact_country?: string | null
          primary_contact_d14?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_state?: string | null
          primary_contact_zip?: string | null
          referee_address?: string | null
          referee_city?: string | null
          referee_country?: string | null
          referee_d14?: string | null
          referee_email?: string | null
          referee_name?: string | null
          referee_phone?: string | null
          referee_state?: string | null
          referee_zip?: string | null
          state?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          ama_number?: number | null
          city?: string | null
          country?: string | null
          email?: string | null
          id?: number
          name?: string | null
          organization_user_id?: string | null
          phone?: string | null
          president_address?: string | null
          president_city?: string | null
          president_country?: string | null
          president_d14?: string | null
          president_email?: string | null
          president_name?: string | null
          president_phone?: string | null
          president_state?: string | null
          president_zip?: string | null
          primary_contact_address?: string | null
          primary_contact_city?: string | null
          primary_contact_country?: string | null
          primary_contact_d14?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_state?: string | null
          primary_contact_zip?: string | null
          referee_address?: string | null
          referee_city?: string | null
          referee_country?: string | null
          referee_d14?: string | null
          referee_email?: string | null
          referee_name?: string | null
          referee_phone?: string | null
          referee_state?: string | null
          referee_zip?: string | null
          state?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_primary_contact_id_fkey"
            columns: ["organization_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          ama_number: string | null
          birthdate: string | null
          card_status: boolean | null
          cell_phone: string | null
          city: string | null
          country: string | null
          d14_number: number | null
          date_signed: string | null
          disciplines: string[] | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          home_phone: string | null
          id: string
          last_modified: string | null
          last_name: string | null
          member_type: string | null
          membership_option: string | null
          middle_initial: string | null
          organization_id: number | null
          parent_id: string | null
          profile_picture: string | null
          role: string | null
          signature: string | null
          state: string | null
          suffix: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          ama_number?: string | null
          birthdate?: string | null
          card_status?: boolean | null
          cell_phone?: string | null
          city?: string | null
          country?: string | null
          d14_number?: number | null
          date_signed?: string | null
          disciplines?: string[] | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          home_phone?: string | null
          id: string
          last_modified?: string | null
          last_name?: string | null
          member_type?: string | null
          membership_option?: string | null
          middle_initial?: string | null
          organization_id?: number | null
          parent_id?: string | null
          profile_picture?: string | null
          role?: string | null
          signature?: string | null
          state?: string | null
          suffix?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          ama_number?: string | null
          birthdate?: string | null
          card_status?: boolean | null
          cell_phone?: string | null
          city?: string | null
          country?: string | null
          d14_number?: number | null
          date_signed?: string | null
          disciplines?: string[] | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          home_phone?: string | null
          id?: string
          last_modified?: string | null
          last_name?: string | null
          member_type?: string | null
          membership_option?: string | null
          middle_initial?: string | null
          organization_id?: number | null
          parent_id?: string | null
          profile_picture?: string | null
          role?: string | null
          signature?: string | null
          state?: string | null
          suffix?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_backup: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          ama_number: string | null
          birthdate: string | null
          cell_phone: string | null
          city: string | null
          country: string | null
          date_signed: string | null
          disciplines: string[] | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          home_phone: string | null
          id: string | null
          last_name: string | null
          member_type: string | null
          membership_option: string | null
          middle_initial: string | null
          profile_picture: string | null
          role: string | null
          signature: string | null
          state: string | null
          suffix: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          ama_number?: string | null
          birthdate?: string | null
          cell_phone?: string | null
          city?: string | null
          country?: string | null
          date_signed?: string | null
          disciplines?: string[] | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          home_phone?: string | null
          id?: string | null
          last_name?: string | null
          member_type?: string | null
          membership_option?: string | null
          middle_initial?: string | null
          profile_picture?: string | null
          role?: string | null
          signature?: string | null
          state?: string | null
          suffix?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          ama_number?: string | null
          birthdate?: string | null
          cell_phone?: string | null
          city?: string | null
          country?: string | null
          date_signed?: string | null
          disciplines?: string[] | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          home_phone?: string | null
          id?: string | null
          last_name?: string | null
          member_type?: string | null
          membership_option?: string | null
          middle_initial?: string | null
          profile_picture?: string | null
          role?: string | null
          signature?: string | null
          state?: string | null
          suffix?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      renewals: {
        Row: {
          id: string
          parent_id: string | null
        }
        Insert: {
          id?: string
          parent_id?: string | null
        }
        Update: {
          id?: string
          parent_id?: string | null
        }
        Relationships: []
      }
      rules: {
        Row: {
          content: string
          division_id: number | null
          id: number
          name: string | null
        }
        Insert: {
          content: string
          division_id?: number | null
          id?: number
          name?: string | null
        }
        Update: {
          content?: string
          division_id?: number | null
          id?: number
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rules_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      temp_membership_form_data: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          ama_number: string | null
          birthdate: string | null
          card_status: boolean | null
          cell_phone: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_signed: string | null
          disciplines: string[] | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string | null
          home_phone: string | null
          id: number
          last_name: string | null
          member_type: string | null
          membership_option: string | null
          middle_initial: string | null
          parent_id: string | null
          signature: string | null
          state: string | null
          suffix: string | null
          user_id: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          ama_number?: string | null
          birthdate?: string | null
          card_status?: boolean | null
          cell_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_signed?: string | null
          disciplines?: string[] | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          home_phone?: string | null
          id?: number
          last_name?: string | null
          member_type?: string | null
          membership_option?: string | null
          middle_initial?: string | null
          parent_id?: string | null
          signature?: string | null
          state?: string | null
          suffix?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          ama_number?: string | null
          birthdate?: string | null
          card_status?: boolean | null
          cell_phone?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_signed?: string | null
          disciplines?: string[] | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string | null
          home_phone?: string | null
          id?: number
          last_name?: string | null
          member_type?: string | null
          membership_option?: string | null
          middle_initial?: string | null
          parent_id?: string | null
          signature?: string | null
          state?: string | null
          suffix?: string | null
          user_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_profile_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temp_membership_form_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_temp_membership_forms: { Args: never; Returns: undefined }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
