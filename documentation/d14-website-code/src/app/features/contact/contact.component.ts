import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { PhoneFormatPipe } from './phone-format.pipe';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { environment } from '../../../environments/environment';

interface Contact {
  name: string;
  email: string;
  title: string;
  phone: string;
  address: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneFormatPipe],
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  name: string = '';
  email: string = '';
  subject: string = '';
  message: string = '';

  officers: Contact[] = [];

  divisionContacts: Contact[] = [];

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    const { data: officerData, error: officerError } =
      await this.supabaseService.supabase
        .from('contacts')
        .select('*')
        .eq('type', 'officer');

    if (officerError) {
      console.error('Error fetching officers:', officerError);
      return;
    }

    this.officers = (officerData as Contact[]) || [];

    const { data: divisionContactData, error: divisionContactError } =
      await this.supabaseService.supabase
        .from('contacts')
        .select('*')
        .eq('type', 'contact');

    if (divisionContactError) {
      console.error('Error fetching division contacts:', divisionContactError);
      return;
    }

    this.divisionContacts = (divisionContactData as Contact[]) || [];
  }

  sendEmail() {
    const emailData = {
      to: [this.email],
      subject: this.subject,
      text: this.message,
      html: `
        <table style="border: 1px solid #dddddd; border-collapse: collapse; width: 100%;">
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #dddddd; padding: 8px; text-align: left;">Field</th>
            <th style="border: 1px solid #dddddd; padding: 8px; text-align: left;">Details</th>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px;">Name</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">${this.name}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px;">Email</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">${this.email}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px;">Subject</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">${this.subject}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #dddddd; padding: 8px;">Message</td>
            <td style="border: 1px solid #dddddd; padding: 8px;">${this.message}</td>
          </tr>
        </table>
      `,
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    this.http
      .post(`${environment.supabaseUrl}/functions/v1/emails`, emailData, {
        headers,
      })
      .subscribe(
        (response: any) => {
          this.toastr.success('Message sent successfully', 'Success');
          this.clearForm();
        },
        (error) => {
          this.toastr.error('Failed to send message', 'Error');
          console.error('Error sending email:', error);
        }
      );
  }

  clearForm() {
    this.name = '';
    this.email = '';
    this.subject = '';
    this.message = '';
  }
}
