import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { Division } from '../admin/division-editing/divisions.component';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-divisions',
  standalone: true,
  imports: [DatePipe, CommonModule],
  styleUrls: ['./divisions.component.scss'],
  templateUrl: './divisions.component.html',
})
export class DivisionsComponent implements OnInit, OnDestroy {
  activeDivision: Division | null = null;
  events: DistrictEvent[] | null = null;
  private routeSubscription: Subscription | null = null;
  instagram: string | null = null;
  facebook: string | null = null;
  resultsLink: string | null = null;
  pointsLink: string | null = null;
  shopLink: string | null = null;
  logo: string | null = null;
  mainImg: string | null = null;
  mainImgWidth: number | null = null;
  mainImgHeight: number | null = null;
  safeContent: SafeHtml | null = null;

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  async fetchDivision(divisionId: number | string) {
    const { data, error } = await this.supabase.supabase
      .from('divisions')
      .select('*, division_cms_content(*)')
      .eq('id', divisionId)
      .single();
    if (error) throw new Error(error.message);
    this.activeDivision = data;
    this.instagram = data.division_cms_content?.instagram
      ? data.division_cms_content?.instagram
      : null;
    this.facebook = data.division_cms_content?.facebook
      ? data.division_cms_content?.facebook
      : null;
    this.resultsLink = data.results_link ?? null;
    this.pointsLink = data.points_link ?? null;
    this.shopLink = data.shop_link ?? null;
    await this.getImages();
    this.safeContent = this.sanitizer.bypassSecurityTrustHtml(
      data.division_cms_content?.content ?? ''
    );
    this.cdr.markForCheck(); // Mark for check after updating data
  }

  async fetchEvents(divisionId: number | string) {
    const { data, error } = await this.supabase.supabase
      .from('events')
      .select('*')
      .eq('division_id', divisionId);
    if (error) throw new Error(error.message);
    this.events =
      data?.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ) ?? [];
    this.cdr.markForCheck(); // Mark for check after updating data
  }

  async getImages() {
    if (!this.activeDivision) return;

    try {
      const logoPrefix = `${this.activeDivision.name}-logo`;
      const mainImgPrefix = `${this.activeDivision.name}-main`;

      // List all files with the logo prefix
      const { data: logoFiles } = await this.supabase.supabase.storage
        .from('Images')
        .list('', {
          limit: 1,
          search: logoPrefix,
          sortBy: { column: 'name', order: 'desc' },
        });

      // List all files with the main prefix
      const { data: mainImgFiles } = await this.supabase.supabase.storage
        .from('Images')
        .list('', {
          limit: 1,
          search: mainImgPrefix,
          sortBy: { column: 'name', order: 'desc' },
        });

      // Get the latest logo file
      if (logoFiles && logoFiles.length > 0) {
        const { data: logoData } = this.supabase.supabase.storage
          .from('Images')
          .getPublicUrl(logoFiles[0].name);

        if (logoData) {
          this.logo = logoData.publicUrl;
        }
      }

      // Get the latest main image file
      if (mainImgFiles && mainImgFiles.length > 0) {
        const { data: mainImgData } = this.supabase.supabase.storage
          .from('Images')
          .getPublicUrl(mainImgFiles[0].name);

        if (mainImgData) {
          this.mainImg = mainImgData.publicUrl;
        }
      }

      this.cdr.markForCheck(); // Mark for check after updating data
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  }

  sendToEvent(event_id: number) {
    this.router.navigate(['/secure/event/', event_id]);
  }

  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const divisionId = params.get('id') as string;
      this.fetchDivision(divisionId);
      this.fetchEvents(divisionId);
    });
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  onMainImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    this.mainImgWidth = img.naturalWidth;
    this.mainImgHeight = img.naturalHeight;
    this.cdr.detectChanges();
  }
}

interface DistrictEvent {
  description: any;
  id: number;
  division_id: number | null;
  name: string | null;
  date: string;
  end_date: string | null;
}
