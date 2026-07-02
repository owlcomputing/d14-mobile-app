import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rules.component.html',
  styleUrls: ['./rules.component.scss'],
})
export class RulesComponent implements OnInit, OnDestroy {
  activeRules: Rules | null = null;
  private routeSubscription: Subscription | null = null;

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef // Inject ChangeDetectorRef
  ) {}

  async fetchRules(divisionId: number | string) {
    try {
      const { data, error } = await this.supabase.supabase
        .from('rules')
        .select('*')
        .eq('division_id', divisionId)
        .single();

      if (error) throw new Error(error.message);

      // Explicitly cast the fetched data to Rules type
      this.activeRules = data as Rules;
      this.cdr.markForCheck(); // Mark for check after updating data
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  }

  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const divisionId = params.get('id') as string;
      this.fetchRules(divisionId);
    });
  }

  ngOnDestroy() {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }
}

interface Rules {
  id: number;
  division_id: number | null;
  name: string | null;
  content: string | null;
}
