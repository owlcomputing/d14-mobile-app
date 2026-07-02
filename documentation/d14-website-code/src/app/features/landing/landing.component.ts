import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  AfterViewInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { AuthService } from '../../core/auth/auth.service';
import { Profile } from '../admin/models/models';
import moment from 'moment';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
  activeAccordion: number | null = null;
  isMember: boolean = false;
  events: any[] = [];
  currentIndex: number = 0;
  cycleInterval: any;
  countdown: { days: number; hours: number; minutes: number } = {
    days: 0,
    hours: 0,
    minutes: 0,
  };

  faqItems = [
    {
      question: 'WHAT IS DISTRICT 14?',
      answer: `Michigan and District 14 Racing has something for everyone! We offer many options in off-road racing: Motocross, Hare Scrambles, Enduros (and an affiliate, the Family Enduros), Sprint Enduros, Flat Track, Hillclimb, and Ice Racing! We work tirelessly with the State of Michigan to preserve our 3600 miles of State O.R.V. trails for off-road recreational riding as well!`,
      isOpen: false,
    },
    {
      question: 'BENEFITS OF MEMBERSHIP',
      answer: `Sanctioned rides give the opportunity to ride and meet new people and visit new areas. There is consistency of Rules/Standards/Safety. We provide a series with points-paying events. We provide one calendar location for all the events of all the divisions. You will be part of the nation's largest lobbying group for motorcyclists. For a $15 Annual Fee and you can ride over 150 events and choose between MX, Hare Scramble, Enduro, Flat Track, TT, Hill Climb, Ice, ATV and Road. No other competition series offers this amount of opportunity in 1 year for less than 5 gals of gas!!`,
      isOpen: false,
    },
    {
      question: 'O.R.V. PRESERVATION',
      answer: `Whether using the 3600 miles of State O.R.V. Trails, coming here for a National race or supporting your favorite local Motocross track, Half Mile or Hare Scrambles or Enduro course, Michigan and District 14 has something for everyone.`,
      isOpen: false,
    },
  ];

  constructor(
    private supabase: SupabaseService,
    public authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.fetchEvents();
    this.authService.profile$.pipe(take(1)).subscribe(async (profile) => {
      if (profile) {
        try {
          const { data, error } = await this.supabase.supabase
            .from('profiles')
            .select('*')
            .eq('id', profile.id);

          if (error) {
            console.error('Error fetching member:', error);
            return;
          }

          if (data) {
            const profile = data[0] as Profile;
            this.isMember = profile.member_type != null;
          } else {
            this.isMember = false;
          }
        } catch (err) {
          console.error('Unexpected error fetching profile:', err);
        }
      }
    });

    this.currentIndex = 0;
  }

  ngOnDestroy() {}

  ngAfterViewInit(): void {
    this.cycleInterval = setInterval(() => {
      this.updateCurrentIndex(1);
      this.cdr.detectChanges();
    }, 15000);
  }

  async fetchEvents() {
    const { data, error } = await this.supabase.supabase
      .from('events')
      .select('*')
      .gte('date', moment().toISOString())
      .lte('date', moment().add(10, 'days').toISOString())
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    this.events = data ?? [];

    console.log(this.events);
    this.updateCountdownForCurrentEvent();
  }

  updateCurrentIndex(change: number): void {
    this.currentIndex =
      (this.currentIndex + change + this.events.length) % this.events.length;
    // Update countdown for the new current event
    this.updateCountdownForCurrentEvent();
  }

  // This function ensures the countdown is calculated for the currently displayed event
  private updateCountdownForCurrentEvent(): void {
    const event = this.events[this.currentIndex];
    if (event) {
      const now = moment();
      const eventDate = moment(event.date);
      const diff = eventDate.diff(now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      this.countdown = { days, hours, minutes };
    }
  }

  toggleAccordion(index: number): void {
    this.faqItems[index].isOpen = !this.faqItems[index].isOpen;
    this.faqItems.forEach((item, i) => {
      if (i !== index) item.isOpen = false;
    });
  }

  navigateTo(path: string): void {
    this.router.navigateByUrl(path);
  }

  goToEvent(eventId: number): void {
    this.router.navigate([`/secure/event/${eventId}`]);
  }
}
