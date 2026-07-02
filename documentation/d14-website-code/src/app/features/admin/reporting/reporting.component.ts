import {
  Component,
  AfterViewInit,
  OnInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import flatpickr from 'flatpickr';
import moment from 'moment';
import { ToastrService } from 'ngx-toastr';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import {
  Chart,
  registerables,
  BarController,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { NgZone } from '@angular/core';

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Title,
  Tooltip,
  Legend
);

@Component({
  selector: 'app-reporting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporting.component.html',
})
export class ReportingComponent implements AfterViewInit, OnInit {
  // Pagination properties
  currentPage: number = 1;
  totalPages: number = 1;
  itemsPerPage: number = 15;
  paginatedTransactions: any[] = [];

  // Other existing properties
  startDate: string = '';
  endDate: string = '';
  transactions: any[] = [];
  selectedFilter: string = '';
  viewMode: 'table' | 'moneyChart' = 'table';
  totalRevenue: number = 0;
  totalTransactions: number = 0;

  @ViewChild('moneyChartCanvas')
  moneyChartCanvas!: ElementRef<HTMLCanvasElement>;
  moneyChart: Chart | null = null;

  constructor(
    private toastr: ToastrService,
    private supabase: SupabaseService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initializeDatePickers();
  }

  // Calculate the paginated transactions based on current page and items per page
  updatePaginatedTransactions(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.paginatedTransactions = this.transactions.slice(start, end);

    this.totalPages = Math.ceil(this.transactions.length / this.itemsPerPage);
  }

  // Navigate to a specific page
  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePaginatedTransactions();
  }

  // Navigate to the next page
  nextPage(): void {
    if (this.currentPage * this.itemsPerPage < this.transactions.length) {
      this.currentPage++;
      this.updatePaginatedTransactions();
    }
  }

  // Navigate to the previous page
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedTransactions();
    }
  }

  // Initialize flatpickr for date selection
  initializeDatePickers(): void {
    flatpickr('#startDate', {
      enableTime: false,
      dateFormat: 'Y-m-d',
      onChange: (_, dateStr) =>
        this.ngZone.run(() => (this.startDate = dateStr)),
    });

    flatpickr('#endDate', {
      enableTime: false,
      dateFormat: 'Y-m-d',
      onChange: (_, dateStr) => this.ngZone.run(() => (this.endDate = dateStr)),
    });
  }

  // Apply filter based on predefined options
  applyPredefinedFilter(filter: string) {
    const today = moment();
    switch (filter) {
      case 'lastWeek':
        this.startDate = today
          .clone()
          .subtract(1, 'weeks')
          .format('YYYY-MM-DD');
        this.endDate = today.format('YYYY-MM-DD');
        break;
      case 'last2Weeks':
        this.startDate = today
          .clone()
          .subtract(2, 'weeks')
          .format('YYYY-MM-DD');
        this.endDate = today.format('YYYY-MM-DD');
        break;
      case 'lastMonth':
        this.startDate = today
          .clone()
          .subtract(1, 'months')
          .format('YYYY-MM-DD');
        this.endDate = today.format('YYYY-MM-DD');
        break;
      case 'allTime':
        this.startDate = today
          .clone()
          .subtract(5, 'years')
          .format('YYYY-MM-DD');
        this.endDate = today.format('YYYY-MM-DD');
        break;
    }
  }

  // Utility function to set start and end dates in the desired format
  setDateRange(start: moment.Moment, end: moment.Moment): void {
    this.startDate = start.format('YYYY-MM-DD');
    this.endDate = end.format('YYYY-MM-DD');
  }

  // Fetch data from Supabase and process transactions
  // Uses chunked queries to handle large numbers of profile IDs
  async fetchReport(event: Event): Promise<void> {
    event.preventDefault();
    if (this.selectedFilter) {
      this.applyPredefinedFilter(this.selectedFilter);
    }

    try {
      const startDate = moment(this.startDate)
        .startOf('day')
        .format('YYYY-MM-DD HH:mm:ss');
      const endDate = moment(this.endDate)
        .endOf('day')
        .format('YYYY-MM-DD HH:mm:ss');

      // Fetch receipts based on date range
      const receipts = await this.fetchReceipts(startDate, endDate);

      if (receipts && receipts.length < 1) {
        this.toastr.info(
          'No transactions found within the selected date range.'
        );
        return;
      }

      // Extract unique profile IDs from the receipts
      const profileIds = [...new Set(receipts.map((r) => r.profile_id))].filter(
        (id) => id != null
      ) as string[];

      // Fetch profiles and memberships in chunks to avoid query parameter limits
      const [profiles, memberships] = await Promise.all([
        this.fetchProfilesInChunks(profileIds),
        this.fetchMembershipsInChunks(profileIds),
      ]);

      // Calculate total revenue and transaction count
      this.totalRevenue = receipts.reduce((sum, r) => sum + r.amount_paid, 0);
      this.totalTransactions = receipts.length;
      this.cdr.detectChanges();

      // Process the transactions with the fetched data
      this.processTransactions(receipts, memberships, profiles);
      this.updateChart();
      this.toastr.success('Report fetched successfully!');
    } catch (error) {
      console.error('Error fetching report:', error);
      this.toastr.error('Failed to fetch report.');
    }
  }

  // Fetch receipts with pagination
  private async fetchReceipts(
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const batchSize = 1000;
    let offset = 0;
    let allReceipts: any[] = [];
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase.supabase
        .from('membership_receipts')
        .select('*')
        .gte('date_created', startDate)
        .lte('date_created', endDate)
        .range(offset, offset + batchSize - 1);

      if (error) {
        throw new Error(`Error fetching receipts: ${error.message}`);
      }

      if (data && data.length > 0) {
        allReceipts = allReceipts.concat(data);
        offset += batchSize;

        if (data.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return allReceipts;
  }

  // Fetch profiles in chunks with controlled concurrency
  private async fetchProfilesInChunks(profileIds: string[]): Promise<any[]> {
    const chunkSize = 200;
    const concurrency = 3; // Process 3 chunks at a time
    const allResults: any[] = [];

    for (let i = 0; i < profileIds.length; i += chunkSize * concurrency) {
      // Take up to 'concurrency' chunks at a time
      const batch = [];
      for (let j = 0; j < concurrency && i + j * chunkSize < profileIds.length; j++) {
        const start = i + j * chunkSize;
        const end = Math.min(start + chunkSize, profileIds.length);
        const chunk = profileIds.slice(start, end);

        batch.push(
          this.supabase.supabase
            .from('profiles')
            .select('id, first_name, last_name')
            .in('id', chunk)
        );
      }

      const results = await Promise.all(batch);

      for (const result of results) {
        if (result.error) {
          throw new Error(`Error fetching profiles: ${result.error.message}`);
        }
        if (result.data) {
          allResults.push(...result.data);
        }
      }
    }

    return allResults;
  }

  // Fetch memberships in chunks with controlled concurrency
  private async fetchMembershipsInChunks(profileIds: string[]): Promise<any[]> {
    const chunkSize = 200;
    const concurrency = 3; // Process 3 chunks at a time
    const allResults: any[] = [];

    for (let i = 0; i < profileIds.length; i += chunkSize * concurrency) {
      // Take up to 'concurrency' chunks at a time
      const batch = [];
      for (let j = 0; j < concurrency && i + j * chunkSize < profileIds.length; j++) {
        const start = i + j * chunkSize;
        const end = Math.min(start + chunkSize, profileIds.length);
        const chunk = profileIds.slice(start, end);

        batch.push(
          this.supabase.supabase
            .from('memberships')
            .select('*')
            .in('profile_id', chunk)
        );
      }

      const results = await Promise.all(batch);

      for (const result of results) {
        if (result.error) {
          throw new Error(`Error fetching memberships: ${result.error.message}`);
        }
        if (result.data) {
          allResults.push(...result.data);
        }
      }
    }

    return allResults;
  }

  // Modified fetchData to accept optional profileIds for filtering
  // Implements pagination to fetch all results beyond Supabase's 1000-row limit
  private async fetchData(
    table:
      | 'membership_receipts'
      | 'memberships'
      | 'profiles'
      | 'division_cms_content'
      | 'divisions'
      | 'emails'
      | 'events'
      | 'magazine_issues'
      | 'membership_notes'
      | 'profile_roles'
      | 'temp_membership_form_data'
      | 'renewals'
      | 'rules',
    startDate?: string,
    endDate?: string,
    columns: string = '*',
    profileIds?: string[]
  ): Promise<any[]> {
    const batchSize = 1000;
    let offset = 0;
    let allData: any[] = [];
    let hasMore = true;

    while (hasMore) {
      let query = this.supabase.supabase.from(table).select(columns);

      if (profileIds && profileIds.length > 0) {
        if (table === 'memberships') {
          query = query.in('profile_id', profileIds);
        } else {
          query = query.in('id', profileIds);
        }
      } else {
        if (startDate) {
          if (table === 'memberships') {
            query = query.gte('last_modified', startDate);
          } else {
            query = query.gte('date_created', startDate);
          }
        }
        if (endDate) {
          if (table === 'memberships') {
            query = query.lte('last_modified', endDate);
          } else {
            query = query.lte('date_created', endDate);
          }
        }
      }

      query = query.range(offset, offset + batchSize - 1);

      const { data, error } = await query;
      if (error) throw new Error(`Error fetching ${table}: ${error.message}`);

      if (data && data.length > 0) {
        allData = allData.concat(data);
        offset += batchSize;

        // If we received fewer rows than the batch size, we've fetched everything
        if (data.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return allData;
  }

  // Process transactions, setting expiration to "family sign up" when no membership is found
  private processTransactions(
    receipts: any[],
    memberships: any[],
    profiles: any[]
  ): void {
    // Create maps for quick access by profile_id
    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile])
    );
    const membershipMap = new Map(
      memberships.map((membership) => [membership.profile_id, membership])
    );

    // Map receipts to complete transaction objects
    this.transactions = receipts.map((receipt) => {
      const profile = profileMap.get(receipt.profile_id);
      const membership = membershipMap.get(receipt.profile_id);

      return {
        id: receipt.id,
        amount_paid: receipt.amount_paid,
        date_created: receipt.date_created,
        profile_id: receipt.profile_id,
        profile_name: profile
          ? `${profile.first_name} ${profile.last_name}`
          : 'Unknown',
        expiration: membership ? membership.expiration : '',
        transaction_id: receipt.stripe_transaction_id,
      };
    });

    this.updatePaginatedTransactions();
  }

  // Initialize or update the chart
  initializeChart(): void {
    if (this.moneyChart) {
      this.moneyChart.destroy();
    }

    this.ngZone.runOutsideAngular(() => {
      this.moneyChart = new Chart(this.moneyChartCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Total Amount Paid',
              data: [],
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: { title: { display: true, text: 'Date' } },
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Amount Paid' },
            },
          },
        },
      });
    });
  }

  // Update chart with new data
  updateChart(): void {
    if (!this.transactions.length) return;

    const startDate = moment(this.startDate);
    const endDate = moment(this.endDate);
    const dateLabels: string[] = [];
    const current = startDate.clone();

    while (current.isSameOrBefore(endDate)) {
      dateLabels.push(current.format('YYYY-MM-DD'));
      current.add(1, 'days');
    }

    const moneyData = dateLabels.map((date) =>
      this.transactions
        .filter((t) => moment(t.date_created).format('YYYY-MM-DD') === date)
        .reduce((sum, t) => sum + t.amount_paid, 0)
    );

    this.ngZone.runOutsideAngular(() => {
      if (this.moneyChart) {
        this.moneyChart.data.labels = dateLabels;
        this.moneyChart.data.datasets[0].data = moneyData;
        this.moneyChart.update();
      }
    });
  }

  // Switch view mode between table and chart
  setViewMode(mode: 'table' | 'moneyChart'): void {
    this.viewMode = mode;
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.viewMode === 'moneyChart') {
        this.initializeChart();
        this.updateChart();
      }
    }, 0);
  }

  disablePreset() {
    this.selectedFilter = '';
  }
}
