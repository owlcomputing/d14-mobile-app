import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from 'ngx-toastr';
import flatpickr from 'flatpickr';

@Component({
  selector: 'app-calendar-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-editor.component.html',
  styleUrls: ['./calendar-editor.component.scss'],
})
export class CalendarEditorComponent implements OnInit, AfterViewInit {
  @ViewChild('addressInput') addressInput!: ElementRef;

  divisions: Division[] = [];
  events: DistrictEvent[] = [];
  selectedDivisionId: number | null = null;
  eventName: string = '';
  startDate: string = '';
  endDate: string = '';
  description: string = '';
  address: string = '';
  latitude: number | null = null;
  longitude: number | null = null;
  editMode: boolean = false;
  editEventId: number | null = null;
  autocomplete: google.maps.places.Autocomplete | undefined;
  currentUserChairmanStatus: boolean = false;
  linkText: string = '';
  linkUrl: string = '';

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private toastr: ToastrService
  ) {}

  async ngOnInit() {
    await this.fetchProfile();
    await this.fetchDivisions();
    await this.fetchEvents();
  }

  ngAfterViewInit() {
    flatpickr('#startDate', {
      enableTime: true,
      dateFormat: 'Y-m-d',
      onChange: (selectedDates, dateStr) => {
        this.startDate = dateStr;
      },
    });
    flatpickr('#endDate', {
      enableTime: true,
      dateFormat: 'Y-m-d',
      onChange: (selectedDates, dateStr) => {
        this.endDate = dateStr;
      },
    });

    // Initialize Google Places Autocomplete
    this.autocomplete = new google.maps.places.Autocomplete(
      this.addressInput.nativeElement,
      {
        types: ['geocode'],
      }
    );

    // Listen for place selection
    this.autocomplete.addListener('place_changed', () => {
      const place = this.autocomplete?.getPlace();
      if (place && place.geometry) {
        this.address = place.formatted_address ?? '';
        this.latitude = place.geometry.location?.lat() ?? null;
        this.longitude = place.geometry.location?.lng() ?? null;
      }
    });
  }

  async fetchProfile() {
    if (!this.auth.session?.user) {
      return;
    }
    const { data, error } = await this.supabase.supabase
      .from('profiles')
      .select('role')
      .eq('id', this.auth.session.user.id);
    if (error) {
      console.error(error);
      return;
    }
    // Check if the user is a chairman
    if (data && data[0]?.role === 'chairman') {
      this.currentUserChairmanStatus = true;
    }
  }

  async fetchDivisions() {
    if (this.currentUserChairmanStatus && this.auth.session?.user) {
      const { data, error } = await this.supabase.supabase
        .from('divisions')
        .select('*')
        .eq('chairman_id', this.auth.session.user.id);
      if (error) {
        console.error(error);
        return;
      }
      this.divisions = data;
      this.selectedDivisionId = this.divisions[0]?.id ?? null;
    } else {
      const { data, error } = await this.supabase.supabase
        .from('divisions')
        .select('*');
      if (error) {
        console.error(error);
        return;
      }
      this.divisions = data ?? [];
    }
  }

  async fetchEvents() {
    const { data, error } = await this.supabase.supabase
      .from('events')
      .select('*')
      .in(
        'division_id',
        this.divisions.map((division) => division.id)
      );
    if (error) {
      console.error(error);
      return;
    }
    // sort the events based on start date
    this.events =
      data?.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ) ?? [];
  }

  async onSubmit() {
    if (this.selectedDivisionId === null) {
      this.toastr.error('Division must be selected', 'Error');
      return;
    }

    if (!this.eventName) {
      this.toastr.error('Event name is required', 'Error');
      return;
    }

    if (!this.startDate) {
      this.toastr.error('Start date is required', 'Error');
      return;
    }

    if (!this.endDate) {
      this.toastr.error('End date is required', 'Error');
      return;
    }

    if (this.editMode) {
      await this.updateEvent();
    } else {
      await this.addEvent();
    }
  }

  async addEvent() {
    if (this.selectedDivisionId === null) {
      this.toastr.error('Division must be selected', 'Error');
      return;
    }

    const { data, error } = await this.supabase.supabase
      .from('events')
      .insert([
        {
          division_id: this.selectedDivisionId,
          name: this.eventName,
          date: this.startDate,
          end_date: this.endDate,
          description: this.description,
          address: this.address,
          latitude: this.latitude,
          longitude: this.longitude,
          link:
            this.linkText && this.linkUrl
              ? { text: this.linkText, url: this.linkUrl }
              : null,
        },
      ])
      .select();
    if (error) {
      console.error(error);
      this.toastr.error('Failed to add event', 'Error');
      return;
    }
    this.events.push(data[0]);
    this.toastr.success('Event added successfully', 'Success');
    this.resetForm();
  }

  async updateEvent() {
    if (this.editEventId === null) {
      this.toastr.error('Event ID is required for update', 'Error');
      return;
    }

    const { data, error } = await this.supabase.supabase
      .from('events')
      .update({
        division_id: this.selectedDivisionId,
        name: this.eventName,
        date: this.startDate,
        end_date: this.endDate,
        description: this.description,
        address: this.address,
        latitude: this.latitude,
        longitude: this.longitude,
        link:
          this.linkText && this.linkUrl
            ? { text: this.linkText, url: this.linkUrl }
            : null,
      })
      .eq('id', this.editEventId)
      .select();
    if (error) {
      console.error(error);
      this.toastr.error('Failed to update event', 'Error');
      return;
    }
    const index = this.events.findIndex(
      (event) => event.id === this.editEventId
    );
    this.events[index] = data[0];
    this.toastr.success('Event updated successfully', 'Success');
    this.resetForm();
  }

  editEvent(event: DistrictEvent) {
    this.selectedDivisionId = event.division_id;
    this.eventName = event.name ?? '';
    this.startDate = event.date ?? '';
    this.endDate = event.end_date ?? '';
    this.description = event.description ?? '';
    this.address = event.address ?? '';
    this.latitude = event.latitude ?? null;
    this.longitude = event.longitude ?? null;
    this.linkUrl = event.link?.url ?? '';
    this.linkText = event.link?.text ?? '';
    this.editMode = true;
    this.editEventId = event.id;
  }

  async deleteEvent(eventId: number) {
    const { error } = await this.supabase.supabase
      .from('events')
      .delete()
      .eq('id', eventId);
    if (error) {
      console.error(error);
      this.toastr.error('Failed to delete event', 'Error');
      return;
    }
    this.events = this.events.filter((event) => event.id !== eventId);
    this.toastr.success('Event deleted successfully', 'Deleted');
  }

  resetForm() {
    this.selectedDivisionId = null;
    this.eventName = '';
    this.startDate = '';
    this.endDate = '';
    this.description = '';
    this.address = '';
    this.latitude = null;
    this.longitude = null;
    this.editMode = false;
    this.editEventId = null;
    this.linkUrl = '';
    this.linkText = '';
  }

  getDivisionName(divisionId: number | null): string {
    if (divisionId === null) {
      return '';
    }
    const division = this.divisions.find(
      (division) => division.id === divisionId
    );
    return division ? division.name ?? '' : '';
  }

  openHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
      helpModal.classList.add('modal-open');
    }
  }

  closeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (helpModal) {
      helpModal.classList.remove('modal-open');
    }
  }
}

interface Division {
  id: number;
  name: string | null;
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
  link?: { text: string; url: string } | null;
}
