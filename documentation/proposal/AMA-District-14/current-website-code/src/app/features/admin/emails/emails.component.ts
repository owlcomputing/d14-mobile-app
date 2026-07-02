import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { EmailsService } from './emails.service';
import { ToastrService } from 'ngx-toastr';
import { Profile } from '../models/models';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-emails',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule, MatTooltipModule],
  styleUrls: ['./emails.component.scss'],
  templateUrl: './emails.component.html',
})
export class EmailsComponent implements OnInit {
  newContent: string = '';
  subject: string = '';
  members: Profile[] = [];
  filteredMembers: EmailProfile[] = [];
  selectedMembers: EmailProfile[] = [];
  divisions: any[] = [];
  selectedDivisions: string[] = [];
  isLoading: boolean = false;
  searchName: string = '';
  searchString: string = '';
  charterSelected: boolean = false;
  isSendingEmail: boolean = false;

  // Batch sending properties
  private readonly BATCH_SIZE = 1000;
  currentBatch: number = 0;
  totalBatches: number = 0;
  batchError: string = '';

  modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ header: 1 }, { header: 2 }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ direction: 'rtl' }],
      [{ size: ['small', false, 'large', 'huge'] }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ['clean'],
      ['link', 'image'],
    ],
    formats: [
      'header',
      'font',
      'size',
      'bold',
      'italic',
      'underline',
      'strike',
      'blockquote',
      'list',
      'bullet',
      'indent',
      'link',
      'image',
      'video',
      'color',
      'code-block',
    ],
  };

  constructor(
    private supabase: SupabaseService,
    private toastr: ToastrService,
    private emailsService: EmailsService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    await this.fetchDivisions();
    this.isLoading = false;
  }

  async searchMembers() {
    try {
      if (this.searchString.length < 3) {
        this.filteredMembers = [];
        this.toastr.info(
          'Please enter at least 3 characters to search.',
          'Info'
        );
        return;
      }

      // Fetch profiles with memberships in a single query
      let profileQuery = this.supabase.supabase
        .from('profiles')
        .select('id, first_name, last_name, email, member_type, memberships(*)') // Use the relationship defined for memberships
        .limit(10);

      // Apply filters
      if (this.searchString) {
        const searchArray = this.searchString
          .split(' ')
          .map((term) => term.trim())
          .filter((term) => term.length > 0);

        let searchConditions = [];

        if (searchArray.length > 1) {
          // If there are two search terms, we need both conditions to apply with AND logic
          searchConditions.push(
            `and(first_name.ilike.%${searchArray[0]}%, last_name.ilike.%${searchArray[1]}%)`
          );
        } else if (searchArray.length === 1) {
          // If only one search term, match on first name, last name, or email with OR logic
          searchConditions.push(
            `first_name.ilike.%${searchArray[0]}%`,
            `last_name.ilike.%${searchArray[0]}%`,
            `email.ilike.%${searchArray[0]}%`
          );
        }

        // Apply the OR condition for all the search fields, or combined AND for first/last names
        profileQuery = profileQuery.or(searchConditions.join(','));
      }

      profileQuery = profileQuery.not(
        'memberships.expiration',
        'lt',
        new Date().toISOString()
      );
      profileQuery = profileQuery.not('memberships', 'is', null);

      // Execute the query
      const { data: profileData, error: profileError } = await profileQuery;

      if (profileError) {
        console.error('Error fetching profiles:', profileError.message);
        return;
      }

      // profile data contains first name, last name, email, and memberships - remove memberships
      profileData.forEach((profile: any) => {
        delete profile.memberships;
      });

      this.filteredMembers = (profileData as unknown as EmailProfile[]) || [];
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  async fetchDivisions() {
    const { data, error } = await this.supabase.supabase
      .from('divisions')
      .select('*');

    if (error) {
      console.error('Error fetching divisions:', error);
      this.toastr.error('Failed to fetch divisions.', 'Error');
    } else {
      this.divisions = data || [];
    }
  }

  isChild(email: string) {
    return email.includes('+child');
  }

  toggleDivisionSelection(event: any, division: any) {
    if (event.target.checked) {
      if (!this.selectedDivisions.includes(division.name)) {
        this.selectedDivisions.push(division.name);
      }
    } else {
      this.selectedDivisions = this.selectedDivisions.filter(
        (selectedDivision) => selectedDivision !== division.name
      );
    }
  }

  toggleCharterSelection() {
    this.charterSelected = !this.charterSelected;
    if (this.charterSelected) {
      this.selectedDivisions.push('Charter');
    } else {
      this.selectedDivisions = this.selectedDivisions.filter(
        (selectedDivision) => selectedDivision !== 'Charter'
      );
    }
  }

  toggleMemberSelection(event: any, member: EmailProfile) {
    if (event.target.checked) {
      if (
        !this.selectedMembers.some(
          (selectedMember) => selectedMember.id === member.id
        )
      ) {
        this.selectedMembers.push(member);
      }
    } else {
      this.selectedMembers = this.selectedMembers.filter(
        (selectedMember) => selectedMember.id !== member.id
      );
    }
  }

  sanitizeContent(html: string): string {
    let sanitized = html;
    const replacements = [
      {
        from: /<p class="ql-size-huge">/g,
        to: '<p style="font-size: 32px; font-weight: bold; line-height: 36px; margin: 0 0 16px;">',
      },
      {
        from: /<p class="ql-size-large">/g,
        to: '<p style="font-size: 24px; font-weight: bold; line-height: 28px; margin: 0 0 14px;">',
      },
      {
        from: /<p class="ql-size-small">/g,
        to: '<p style="font-size: 12px; line-height: 16px; margin: 0 0 8px;">',
      },
      {
        from: /<span class="ql-size-huge">/g,
        to: '<span style="font-size: 32px; font-weight: bold; line-height: 36px;">',
      },
      {
        from: /<span class="ql-size-large">/g,
        to: '<span style="font-size: 24px; font-weight: bold; line-height: 28px;">',
      },
      {
        from: /<span class="ql-size-small">/g,
        to: '<span style="font-size: 12px; line-height: 16px;">',
      },
      {
        from: /<p class="ql-align-center">/g,
        to: '<p style="text-align: center;">',
      },
      {
        from: /<p class="ql-align-right">/g,
        to: '<p style="text-align: right;">',
      },
      {
        from: /<p class="ql-align-justify">/g,
        to: '<p style="text-align: justify;">',
      },
      {
        from: /<li class="ql-indent-1">/g,
        to: '<li style="padding-left: 20px;">',
      },
      {
        from: /<li class="ql-indent-2">/g,
        to: '<li style="padding-left: 40px;">',
      },
      {
        from: /<li class="ql-indent-3">/g,
        to: '<li style="padding-left: 60px;">',
      },
      {
        from: /<span class="ql-font-serif">/g,
        to: '<span style="font-family: serif;">',
      },
      {
        from: /<span class="ql-font-monospace">/g,
        to: '<span style="font-family: monospace;">',
      },
      { from: / class="ql-[^"]*"/g, to: '' },
    ];

    replacements.forEach(({ from, to }) => {
      sanitized = sanitized.replace(from, to);
    });

    return sanitized;
  }

  clearAllRecipients() {
    this.selectedMembers = [];
    this.selectedDivisions = [];
    this.charterSelected = false;
    this.cdr.detectChanges();
  }

  async sendEmail() {
    if (
      (this.selectedMembers.length < 1 && this.selectedDivisions.length < 1) ||
      !this.newContent ||
      !this.subject.trim()
    ) {
      this.toastr.error(
        'Please select at least one member, enter a subject, and provide email content.',
        'Error'
      );
      return;
    }

    this.isSendingEmail = true;
    this.batchError = '';
    this.currentBatch = 0;
    this.totalBatches = 0;

    try {
      let selectedMemberEmails = this.selectedMembers
        .map((member) => member.email)
        .filter((email): email is string => email !== null);

      // Handle charter members separately
      if (this.charterSelected) {
        const { data: organizations, error: orgError } =
          await this.supabase.supabase.from('organizations').select('*');

        if (orgError) {
          throw new Error(`Error fetching organizations: ${orgError.message}`);
        }

        const charterEmails = organizations
          .map((org) => {
            // First try to get primary contact email
            let email = org.primary_contact_email;

            // If primary contact email is null or invalid, use organization email
            if (!email || !this.isValidEmail(email)) {
              email = org.email;
            }

            // Log the organization and which email was chosen
            console.log(`Organization: ${org.name}`);
            console.log(`Primary Contact Email: ${org.primary_contact_email}`);
            console.log(`Organization Email: ${org.email}`);
            console.log(`Selected Email: ${email}`);
            console.log('-------------------');

            return email;
          })
          .filter(
            (email): email is string =>
              email !== null && this.isValidEmail(email)
          );

        // Add charter emails to the list
        selectedMemberEmails = [
          ...new Set([...selectedMemberEmails, ...charterEmails]),
        ];
      }

      // Get all members in the selected Divisions (excluding 'Charter' division)
      if (this.selectedDivisions.length > 0) {
        const nonCharterDivisions = this.selectedDivisions.filter(
          (div) => div !== 'Charter'
        );
        if (nonCharterDivisions.length > 0) {
          let allDivisionEmails: string[] = [];
          let start = 0;
          const batchSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const {
              data: divisionData,
              error: divisionError,
              count,
            } = await this.supabase.supabase
              .from('profiles')
              .select('email', { count: 'exact' })
              .overlaps('disciplines', nonCharterDivisions)
              .range(start, start + batchSize - 1);

            if (divisionError) {
              throw new Error(
                `Error fetching division members: ${divisionError.message}`
              );
            }

            const divisionEmails = divisionData
              .map((profile: any) => profile.email)
              .filter(
                (email): email is string =>
                  email !== null && this.isValidEmail(email)
              );

            allDivisionEmails = [...allDivisionEmails, ...divisionEmails];

            start += batchSize;
            hasMore = count !== null && start < count;
          }

          selectedMemberEmails = [
            ...new Set([...selectedMemberEmails, ...allDivisionEmails]),
          ];
        }
      }

      if (selectedMemberEmails.length === 0) {
        this.toastr.error('No valid email addresses found');
        this.isSendingEmail = false;
        return;
      }

      // Log final list of email addresses
      console.log('Final Email List:');
      console.log(selectedMemberEmails);
      console.log(`Total Emails: ${selectedMemberEmails.length}`);

      // Format the email content with the D14 template
      const formattedHtml = `
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <header style="text-align: center; margin-bottom: 20px;">
          <img src="https://ama-d14.web.app/assets/images/d14_logo.png" alt="D14 Logo" style="max-width: 200px; height: auto;">
        </header>
        <main style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #ddd;">
          <div style="padding: 20px; background-color: #fff; border-radius: 8px; border: 1px solid #ccc;">
            ${this.newContent}
          </div>
        </main>
        <footer style="margin-top: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>
            D14 remains on top of ORV and land-use issues, both environmentally and legislatively, by having members on several Michigan boards and in constant contact with the Michigan State Legislature.
          </p>
          <p>
            As a membership-driven organization, D14 strives to bring the finest events to our members - both the riders and the clubs/organizers.
          </p>
          <p>
            See you at the races!
          </p>
        </footer>
      </body>
    `;

      // Split into batches and send sequentially
      const batches = this.createBatches(selectedMemberEmails);
      this.totalBatches = batches.length;

      for (let i = 0; i < batches.length; i++) {
        this.currentBatch = i + 1;
        this.cdr.detectChanges();

        const result = await this.sendSingleBatch(
          batches[i],
          this.subject,
          formattedHtml
        );

        if (!result.success) {
          this.batchError = `Failed on batch ${i + 1} of ${batches.length}: ${result.error}`;
          this.toastr.error(this.batchError, 'Error');
          return;
        }

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this.delay(1000);
        }
      }

      this.toastr.success(
        `Email sent successfully to ${selectedMemberEmails.length} recipients`
      );
      this.resetForm();
    } catch (error) {
      console.error('Error preparing email list:', error);
      this.toastr.error('Failed to prepare email list', 'Error');
    } finally {
      this.isSendingEmail = false;
      this.currentBatch = 0;
      this.totalBatches = 0;
    }
  }

  private createBatches(emails: string[]): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < emails.length; i += this.BATCH_SIZE) {
      batches.push(emails.slice(i, i + this.BATCH_SIZE));
    }
    return batches;
  }

  private async sendSingleBatch(
    emails: string[],
    subject: string,
    html: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${environment.supabaseUrl}/functions/v1/emails`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emails,
            subject: subject,
            html: html,
          }),
        }
      );

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Failed to send batch',
        };
      }
    } catch (error) {
      console.error('Error sending batch:', error);
      return { success: false, error: 'Network error sending batch' };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  resetForm() {
    this.newContent = '';
    this.subject = '';
    this.selectedMembers = [];
    this.selectedDivisions = [];
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

interface EmailProfile {
  id: string;
  first_name: string;
  last_name: string;
  member_type: string;
  email: string;
}
function lastValueFrom(arg0: Observable<any>) {
  throw new Error('Function not implemented.');
}
