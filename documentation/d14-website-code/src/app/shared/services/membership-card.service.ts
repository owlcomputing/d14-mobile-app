import { Injectable } from '@angular/core';
import { profileMembership } from '../../features/profile/profile.component';
import { MembershipNote } from '../../features/admin/models/models';

@Injectable({
  providedIn: 'root',
})
export class MembershipCardService {
  constructor() {}

  printMembershipCard(
    profile: profileMembership,
    logoDataUrl: string,
    onCardNotes: MembershipNote[] = []
  ) {
    const printWindow = window.open('', '_blank');

    if (!printWindow || !profile || !profile.membership || !logoDataUrl) {
      console.error('Unable to open print window or missing data');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Membership Card</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .card { 
                width: 3.375in; 
                height: 2.25in;
                border: 1px solid #ccc; 
                border-radius: 0.125in;
                padding: 0.25in; 
                margin: 0 auto; 
                background-color: white; 
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 0.5in;
            }
            .logo { 
                width: 1.5in; 
                height: auto;
            }
            .info { 
                text-align: right; 
                font-size: 10pt; 
                line-height: 1.2;
            }
            .details {
                font-size: 10pt;
                line-height: 1.75;
            }
            .id-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .notes { 
                font-size: 10pt;
                margin-top: 0.2in;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
                <img src="${logoDataUrl}" alt="D14 District Logo" class="logo">
                <div class="info">
                    <div>${profile.profile.first_name} ${
      profile.profile.last_name
    }</div>
                    <div>${profile.profile.address_line1}</div>
                    <div>${profile.profile.city}, ${profile.profile.state} ${
      profile.profile.zip
    }</div>
                </div>
            </div>
            <div class="details">
                <div>D.O.B. ${this.formatDate(profile.profile.birthdate)}</div>
                <div class="id-line">
                    <span>D14# ${profile.profile.d14_number}</span>
                    <span>EXP ${this.formatDate(
                      profile.membership.expiration
                    )}</span>
                </div>
            </div>
            ${
              onCardNotes.length > 0
                ? `
            <div class="notes">
                ${onCardNotes
                  .filter((note) => note.on_card)
                  .map((note) => `<div>${note.note_content}</div>`)
                  .join('')}
            </div>`
                : ''
            }
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';

    // Handle different date formats more reliably
    let date: Date;

    // If it's already an ISO string, parse it directly
    if (dateString.includes('T') || dateString.includes('Z')) {
      date = new Date(dateString);
    } else {
      // For date-only strings, split and create date manually to avoid timezone issues
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Format: YYYY-MM-DD
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      } else {
        // Fallback to standard parsing
        date = new Date(dateString);
      }
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return '';
    }

    // Format as MM/DD/YYYY
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${month}/${day}/${year}`;
  }
}
