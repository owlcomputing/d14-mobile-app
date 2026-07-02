import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from 'date-fns';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent implements OnInit {
  viewDate: Date = new Date();
  daysInMonth: Date[] = [];
  events: DistrictEvent[] = [];
  divisions: any[] = [];
  selectedDivisions: number[] = [];
  divisionColors: any = {};
  days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Days of the week

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private toast: ToastrService
  ) {}

  ngOnInit() {
    this.fetchDivisions();
    this.fetchEvents();
    this.generateDaysInMonth(this.viewDate);
  }

  async fetchDivisions() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('divisions')
        .select('id, name');

      if (error) {
        console.error('Error fetching divisions:', error.message);
      } else {
        this.divisions = data;
        this.selectedDivisions = data.map((division) => division.id);
        this.generateDivisionColors();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  generateDivisionColors() {
    const colors = [
      '#FF5733',
      '#33FF57',
      '#3357FF',
      '#FF33A1',
      '#A133FF',
      '#33FFA1',
      '#FF8C33',
      '#8C33FF',
      '#33FF8C',
      '#FF3333',
      '#33FF33',
      '#3333FF',
      '#FF33FF',
      '#33FFFF',
      '#FFFF33',
      '#FF6633',
      '#6633FF',
      '#33FF66',
      '#FF3366',
      '#66FF33',
    ];

    this.divisions.forEach((division, index) => {
      this.divisionColors[division.id] = colors[index % colors.length];
    });
  }

  getContrastColor(hex: string): string {
    return parseInt(hex.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff';
  }

  toggleDivision(division_id: number) {
    if (this.isDivisionSelected(division_id)) {
      this.selectedDivisions = this.selectedDivisions.filter(
        (id) => id !== division_id
      );
    } else {
      this.selectedDivisions.push(division_id);
    }
  }

  isDivisionSelected(division_id: number): boolean {
    return this.selectedDivisions.includes(division_id);
  }

  async fetchEvents() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('events')
        .select('date, end_date, name, division_id, id');

      if (error) {
        console.error('Error fetching events:', error.message);
      } else {
        this.events = data;
        this.generateDaysInMonth(this.viewDate);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  navigateToEvent(event: DistrictEvent) {
    this.router.navigate([`/secure/event/${event.id}`]);
  }

  generateDaysInMonth(date: Date) {
    const start = startOfWeek(startOfMonth(date));
    const end = endOfWeek(endOfMonth(date));
    this.daysInMonth = eachDayOfInterval({ start, end });
  }

  prevMonth() {
    this.viewDate = subMonths(this.viewDate, 1);
    this.generateDaysInMonth(this.viewDate);
  }

  nextMonth() {
    this.viewDate = addMonths(this.viewDate, 1);
    this.generateDaysInMonth(this.viewDate);
  }

  getDayClass(day: Date) {
    return isSameMonth(day, this.viewDate) ? '' : 'text-gray-400';
  }

  isCurrentDay(day: Date): boolean {
    return format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  }

  getEventsForDay(day: Date): any[] {
    return this.events.filter((event) => {
      const startDate = new Date(event.date);
      const endDate = event.end_date ? new Date(event.end_date) : startDate;

      // Check if the event's division is selected
      const isDivisionSelected =
        event.division_id !== null &&
        this.selectedDivisions.includes(event.division_id);

      // Only return events for the selected divisions and within the current day range
      return isDivisionSelected && day >= startDate && day <= endDate;
    });
  }

  getEventDotColor(day: Date): string[] {
    const events = this.getEventsForDay(day);
    return events.map((event) => this.divisionColors[event.division_id]);
  }

  // function to export entire calendar of selected events to Google calendar
  downloadCalendar() {
    if (!this.events.length) {
      return;
    }
    if (!this.selectedDivisions.length) {
      this.toast.error('Please select at least one division to export.');
      return;
    }
    const selectedEvents = this.events.filter(
      (event) =>
        event.division_id !== null &&
        this.selectedDivisions.includes(event.division_id)
    );
    const cal = this.createCal(selectedEvents);
    const calStr = cal.toString();
    const uri = encodeURI('data:text/calendar;charset=utf8,' + calStr);
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', 'calendar.ics');
    document.body.appendChild(link);
    link.click();
  }

  // Method to create calendar data in Eastern Time
  createCal(events: DistrictEvent[]): any {
    const timeZone = 'America/New_York';
    const cal = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//District 14//District 14 Calendar//EN',
    ];

    events.forEach((event) => {
      const startDate = format(new Date(event.date), "yyyyMMdd'T'HHmmss'Z'");
      const endDate = event.end_date
        ? format(new Date(event.end_date), "yyyyMMdd'T'HHmmss'Z'")
        : startDate;
      cal.push(
        'BEGIN:VEVENT',
        `UID:${event.id}`,
        `SUMMARY:${event.name}`,
        `DTSTART;TZID=${timeZone}:${startDate}`,
        `DTEND;TZID=${timeZone}:${endDate}`,
        'END:VEVENT'
      );
    });

    cal.push('END:VCALENDAR');
    return {
      toString: () => cal.join('\n'),
    };
  }
}

interface DistrictEvent {
  id: number;
  division_id: number | null;
  name: string | null;
  date: string;
  end_date: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}
