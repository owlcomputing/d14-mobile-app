import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { SupabaseService } from '../../../../core/supabase/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/auth/auth.service';
@Component({
  selector: 'app-rules-cms',
  standalone: true,
  imports: [CommonModule, QuillModule, FormsModule, UpperCasePipe],
  styleUrls: ['./rules-cms.component.scss'],
  templateUrl: './rules-cms.component.html',
})
export class RulesComponent implements OnInit {
  chairman: boolean = false;
  activeRule: any = null;
  newContent: string = '';
  ruleName = 'Test Rule';
  modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'], // toggled buttons
      ['blockquote', 'code-block'],
      [{ header: 1 }, { header: 2 }], // custom button values
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
      [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
      [{ direction: 'rtl' }], // text direction
      [{ size: ['small', false, 'large', 'huge'] }], // custom dropdown
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }], // dropdown with defaults from theme
      [{ font: [] }],
      [{ align: [] }],
      ['clean'], // remove formatting button
      ['link', 'image'], // link and image, video
    ],
  };

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    await this.fetchProfile();
    await this.getContent();
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
      this.chairman = true;
    }
  }

  async getContent() {
    const ruleId = this.route.snapshot.paramMap.get('id') as string;
    const { data, error } = await this.supabase.supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (error) {
      console.error(error);
      this.toastr.error('Failed to fetch rule', 'Error');
      return;
    }

    this.activeRule = data;
    if (this.activeRule?.content) {
      this.newContent = this.activeRule.content;
    }
  }

  async updateContent() {
    if (!this.activeRule?.id) throw new Error('No selected rule');

    const { error } = await this.supabase.supabase
      .from('rules')
      .update({
        content: this.newContent,
      })
      .eq('id', this.activeRule.id)
      .single();

    if (error) {
      console.error(error);
      this.toastr.error('Failed to update content', 'Error');
    } else {
      this.newContent = '';
      this.toastr.success('Content updated successfully', 'Success');
      this.getContent();
      this.cdr.detectChanges();
    }
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
