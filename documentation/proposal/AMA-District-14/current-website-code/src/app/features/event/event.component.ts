import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { GoogleMapsModule } from '@angular/google-maps';

@Component({
  selector: 'app-event',
  templateUrl: './event.component.html',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
})
export class EventComponent implements OnInit {
  event: DistrictEvent | null = null;
  divisions: any[] = [];
  googleCalendarUrl: SafeUrl | null = null;
  center: google.maps.LatLngLiteral = { lat: 41.8781, lng: -87.6298 }; // Default to Chicago coordinates
  zoom = 12;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const eventId = +params['id'];
      this.fetchEvent(eventId);
      this.fetchDivisions();
    });
  }

  async fetchEvent(eventId: number) {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        console.error('Error fetching event:', error.message);
      } else {
        this.event = data;
        this.generateGoogleCalendarUrl();

        // Update the map center if latitude and longitude are available
        if (this.event.latitude && this.event.longitude) {
          this.center = {
            lat: this.event.latitude,
            lng: this.event.longitude,
          };
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  async fetchDivisions() {
    try {
      const { data, error } = await this.supabaseService.supabase
        .from('divisions')
        .select('*');

      if (error) {
        console.error('Error fetching divisions:', error.message);
      } else {
        this.divisions = data;
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }
  }

  getDivisionName(divisionId: number | null | undefined): string {
    if (divisionId === null || divisionId === undefined) {
      return 'Unknown Division';
    }
    const division = this.divisions.find((d) => d.id === divisionId);
    return division ? division.name : 'Unknown Division';
  }

  generateGoogleCalendarUrl() {
    if (this.event) {
      const startDate = new Date(this.event.date);
      const endDate = this.event.end_date
        ? new Date(this.event.end_date)
        : new Date(startDate.getTime() + 86400000); // Add 1 day if no end date

      const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        this.event.name || 'Event'
      )}&dates=${startDate.toISOString().replace(/-|:|\.\d\d\d/g, '')}/${endDate
        .toISOString()
        .replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent(
        this.event.description || ''
      )}&location=${encodeURIComponent(this.event.address || '')}`;

      this.googleCalendarUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    }
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
  link?: { text: string; url: string } | null;
}
