import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'phoneFormat',
  standalone: true
})
export class PhoneFormatPipe implements PipeTransform {
  transform(phoneNumber: string | null): string {
    if (!phoneNumber) return '';

    // Remove non-numeric characters
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');

    // Check if the input is a 10-digit phone number
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

    // check for 11 digit phone number
    const match11 = cleaned.match(/^(\d{1})(\d{3})(\d{3})(\d{4})$/);

    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    else if (match11) {
      return `+${match11[1]} (${match11[2]}) ${match11[3]}-${match11[4]}`;
    }

    // If it's not a valid phone number, return the input as is
    return phoneNumber;
  }
}