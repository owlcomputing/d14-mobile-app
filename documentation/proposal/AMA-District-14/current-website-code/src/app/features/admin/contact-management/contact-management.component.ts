import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { SupabaseService } from '../../../core/supabase/supabase.service';

interface Contact {
  id?: number;
  name: string;
  email: string;
  title: string;
  phone: string;
  address: string;
  type: 'officer' | 'contact';
}

@Component({
  selector: 'app-contact-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-management.component.html',
})
export class ContactManagementComponent implements OnInit {
  contacts: Contact[] = [];
  editedContact: Contact = {
    name: '',
    email: '',
    title: '',
    phone: '',
    address: '',
    type: 'contact',
  };
  isEditing = false;
  contactToDelete: Contact | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.fetchContacts();
  }

  async fetchContacts() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('contacts')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      this.contacts = data as Contact[];
    } catch (error) {
      console.error('Error fetching contacts:', error);
      this.toastr.error('Error fetching contacts');
    }
  }

  openAddContactModal() {
    this.isEditing = false;
    this.editedContact = {
      name: '',
      email: '',
      title: '',
      phone: '',
      address: '',
      type: 'contact',
    };
    (document.getElementById('contact_modal') as HTMLDialogElement).show();
  }

  openEditModal(contact: Contact) {
    this.isEditing = true;
    this.editedContact = { ...contact };
    (document.getElementById('contact_modal') as HTMLDialogElement).show();
  }

  closeModal() {
    this.editedContact = {
      id: 0,
      name: '',
      email: '',
      title: '',
      phone: '',
      address: '',
      type: 'contact',
    };
    this.isEditing = false;
    (document.getElementById('contact_modal') as HTMLDialogElement).close();
  }

  async saveContact() {
    try {
      if (this.isEditing && this.editedContact.id) {
        const { error } = await this.supabaseService.supabase
          .from('contacts')
          .update({
            name: this.editedContact.name,
            email: this.editedContact.email,
            title: this.editedContact.title,
            phone: this.editedContact.phone,
            address: this.editedContact.address,
            type: this.editedContact.type,
          })
          .eq('id', this.editedContact.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        this.toastr.success('Contact updated successfully');
      } else {
        const newContact = {
          name: this.editedContact.name,
          email: this.editedContact.email,
          title: this.editedContact.title,
          phone: this.editedContact.phone,
          address: this.editedContact.address,
          type: this.editedContact.type,
        };

        const { error } = await this.supabaseService.supabase
          .from('contacts')
          .insert(newContact);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }
        this.toastr.success('Contact added successfully');
      }

      await this.fetchContacts();
      this.closeModal();
    } catch (error) {
      console.error('Error saving contact:', error);
      this.toastr.error('Error saving contact');
    }
  }

  openDeleteModal(contact: Contact) {
    this.contactToDelete = contact;
    (
      document.getElementById('delete_confirm_modal') as HTMLDialogElement
    ).show();
  }

  closeDeleteModal() {
    this.contactToDelete = null;
    (
      document.getElementById('delete_confirm_modal') as HTMLDialogElement
    ).close();
  }

  async confirmDelete() {
    if (!this.contactToDelete?.id) return;

    try {
      const { error } = await this.supabaseService.supabase
        .from('contacts')
        .delete()
        .eq('id', this.contactToDelete.id);

      if (error) throw error;

      this.toastr.success('Contact deleted successfully');
      await this.fetchContacts();
      this.closeDeleteModal();
    } catch (error) {
      console.error('Error deleting contact:', error);
      this.toastr.error('Error deleting contact');
    }
  }
}
