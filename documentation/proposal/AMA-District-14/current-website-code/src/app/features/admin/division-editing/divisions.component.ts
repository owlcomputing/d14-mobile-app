import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-division-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './divisions.component.html',
})
export class DivisionEditor implements OnInit {
  divisions: Division[] = [];
  newDivisionName: string = '';
  selectedDivisionId: number | null = null;

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.fetchDivisions();
  }

  async fetchDivisions() {
    try {
      const { data: divisionsData, error: divisionsError } = await this.supabase.supabase
        .from('divisions')
        .select('*, division_cms_content(*)');
      
      if (divisionsError) {
        this.toastr.error('Failed to fetch divisions', 'Error');
        throw new Error('Could not fetch divisions');
      }

      // Fetch media for each division
      const divisionsWithMedia = await Promise.all(
        divisionsData.map(async (division) => {
          const { data: mediaData, error: mediaError } = await this.supabase.supabase
            .from('division_media')
            .select('*')
            .eq('division_id', division.id);

          if (mediaError) {
            console.error('Error fetching media for division:', division.id, mediaError);
          }

          return {
            ...division,
            media: mediaData || []
          };
        })
      );

      this.divisions = divisionsWithMedia as any[];
    } catch (error) {
      this.toastr.error('Failed to fetch divisions', 'Error');
    }
  }

  async addDivision() {
    if (!this.newDivisionName) {
      return;
    }
    try {
      const { data, error } = await this.supabase.supabase
        .from('divisions')
        .insert([{ name: this.newDivisionName }])
        .select();
      if (error) {
        console.error('Error adding division', error);
        this.toastr.error('Failed to add division', 'Error');
        return;
      }
      // Assuming data returns the newly created division with its id
      const newDivision: Division = {
        id: data[0].id,
        name: data[0].name,
        division_cms_content: null,
      };
      this.divisions.push(newDivision);
      this.cdr.detectChanges(); // Manually trigger change detection

      // Create a rules page for the new division
      const rulesName = `${this.newDivisionName} Rules`;
      const { error: rulesError } = await this.supabase.supabase
        .from('rules')
        .insert([
          { division_id: newDivision.id, name: rulesName, content: '' },
        ]);
      if (rulesError) {
        console.error('Error adding rules for division', rulesError);
        // Optionally, you can remove the division if adding rules failed
        this.divisions = this.divisions.filter(
          (division) => division.id !== newDivision.id
        );
        this.cdr.detectChanges(); // Manually trigger change detection
        this.toastr.error('Failed to add rules for the new division', 'Error');
        return;
      }

      this.newDivisionName = '';
      this.cdr.detectChanges(); // Manually trigger change detection
      this.toastr.success('Division added successfully', 'Success');
    } catch (error) {
      this.toastr.error('Failed to add division', 'Error');
    }
  }

  async deleteDivision() {
    if (!this.selectedDivisionId) {
      return;
    }
    const id = this.selectedDivisionId;
    try {
      // Delete related division_cms_content entries first
      const { error: contentError } = await this.supabase.supabase
        .from('division_cms_content')
        .delete()
        .eq('division_id', id);
      if (contentError) {
        console.error('Error deleting related CMS content', contentError);
        this.toastr.error('Failed to delete related CMS content', 'Error');
        return;
      }

      // Delete related rules entries
      const { error: rulesError } = await this.supabase.supabase
        .from('rules')
        .delete()
        .eq('division_id', id);
      if (rulesError) {
        console.error('Error deleting related rules', rulesError);
        this.toastr.error('Failed to delete related rules', 'Error');
        return;
      }

      // Delete the division
      const { error: divisionError } = await this.supabase.supabase
        .from('divisions')
        .delete()
        .eq('id', id);
      if (divisionError) {
        console.error('Error deleting division', divisionError);
        this.toastr.error('Failed to delete division', 'Error');
        return;
      }

      // Remove the deleted division from the local array
      this.divisions = this.divisions.filter((division) => division.id !== id);
      this.cdr.detectChanges(); // Manually trigger change detection
      this.toastr.error('Division deleted successfully', 'Success');
      this.closeDeleteConfirmModal();
    } catch (error) {
      console.error('Error deleting division and related content', error);
      this.toastr.error(
        'Failed to delete division and related content',
        'Error'
      );
    }
  }

  async editDivision(id: number) {
    this.router.navigate(['/secure/admin/cms', id]);
  }

  openDeleteConfirmModal(divisionId: number) {
    this.selectedDivisionId = divisionId;
    const modal = document.getElementById(
      'deleteDivisionModal'
    ) as HTMLDialogElement;
    if (modal) {
      modal.show();
    }
  }

  closeDeleteConfirmModal() {
    const modal = document.getElementById(
      'deleteDivisionModal'
    ) as HTMLDialogElement;
    if (modal) {
      modal.close();
    }
    this.selectedDivisionId = null;
  }

  trackById(index: number, division: Division): number {
    return division.id;
  }
}

export interface Division {
  id: number;
  name: string | null;
  chairman_id?: string | null;
  results_link?: string | null;
  points_link?: string | null;
  logo?: string | null;
  main_img?: string | null;
  division_cms_content?: {
    id: number;
    content: string | null;
    division_id: number | null;
    last_updated: string | null;
  } | null;
  media?: {
    id: number;
    division_id: number;
    display_name: string;
    file_link: string;
  }[];
}
