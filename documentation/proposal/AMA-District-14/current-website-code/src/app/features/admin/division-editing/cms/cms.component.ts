import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { SupabaseService } from '../../../../core/supabase/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Division } from '../divisions.component';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-cms',
  standalone: true,
  imports: [CommonModule, QuillModule, FormsModule, UpperCasePipe],
  styleUrls: ['./cms.component.scss'],
  templateUrl: './cms.component.html',
})
export class CmsComponent implements OnInit {
  chairman: boolean = false;
  activeDivision: Division | null = null;
  chairmanID = '';
  chairmanName = '';
  newContent: string = '';
  divisionName = 'Test Division';
  instagramLink: string = '';
  facebookLink: string = '';
  resultsLink: string = '';
  pointsLink: string = '';
  logoFile: File | null = null;
  mainImgFile: File | null = null;

  logo: string | null = null;
  mainImg: string | null = 'google.com/notanimage.jpg';

  modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ header: 1 }, { header: 2 }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ direction: 'rtl' }],
      [{ size: ['small', false, 'large', 'huge'] }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ['clean'],
      ['link', 'image'],
    ],
  };

  divisionMedia: any[] = [];
  newMediaName: string = '';
  selectedFile: File | null = null;
  isUploading: boolean = false;
  isDragging: boolean = false;
  editingMediaId: number | null = null;
  editingMediaName: string = '';
  isDraggingLogo: boolean = false;
  isDraggingMain: boolean = false;

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
    await this.loadDivisionMedia();
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
    const divisionId = this.route.snapshot.paramMap.get('id') as string;
    console.log('Getting content for division ID:', divisionId);
    const { data, error } = await this.supabase.supabase
      .from('divisions')
      .select('*, division_cms_content(*)')
      .eq('id', divisionId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    console.log('Fetched division data:', data);
    this.activeDivision = {
      id: parseInt(divisionId),
      name: data.name,
      chairman_id: data.chairman_id,
      results_link: data.results_link,
      points_link: data.points_link,
      logo: data.logo,
      main_img: data.main_img,
      division_cms_content: data.division_cms_content,
    };

    if (this.activeDivision) {
      this.divisionName = this.activeDivision.name || '';
      this.resultsLink = this.activeDivision.results_link || '';
      this.pointsLink = this.activeDivision.points_link || '';

      if (this.activeDivision.division_cms_content?.content) {
        this.newContent = this.activeDivision.division_cms_content.content;
      }
      if (this.activeDivision.chairman_id) {
        this.chairmanID = this.activeDivision.chairman_id;
        this.chairmanName = await this.getChairmanName();
      }
      if (data?.division_cms_content?.instagram) {
        this.instagramLink = data.division_cms_content.instagram;
      }
      if (data?.division_cms_content?.facebook) {
        this.facebookLink = data.division_cms_content.facebook;
      }
    }
    this.getImages();
    await this.loadDivisionMedia();
  }

  async getImages() {
    if (!this.activeDivision) return;

    try {
      const logoPrefix = `${this.activeDivision.name}-logo`;
      const mainPrefix = `${this.activeDivision.name}-main`;

      // List all files with the logo prefix
      const { data: logoFiles } = await this.supabase.supabase.storage
        .from('Images')
        .list('', {
          limit: 1,
          search: logoPrefix,
          sortBy: { column: 'name', order: 'desc' },
        });

      // List all files with the main prefix
      const { data: mainFiles } = await this.supabase.supabase.storage
        .from('Images')
        .list('', {
          limit: 1,
          search: mainPrefix,
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
      if (mainFiles && mainFiles.length > 0) {
        const { data: mainData } = this.supabase.supabase.storage
          .from('Images')
          .getPublicUrl(mainFiles[0].name);

        if (mainData) {
          this.mainImg = mainData.publicUrl;
        }
      }
    } catch (error) {
      console.error('Error fetching images:', error);
    }
  }

  async updateContent() {
    if (!this.activeDivision?.id) throw new Error('No selected division');

    const divisionUpdate = {
      results_link: this.resultsLink,
      points_link: this.pointsLink,
    };

    const { error: divisionError } = await this.supabase.supabase
      .from('divisions')
      .update(divisionUpdate)
      .eq('id', this.activeDivision.id);

    if (divisionError) {
      console.error(divisionError);
      this.toastr.error('Failed to update division content', 'Error');
      return;
    }

    const contentUpdate = {
      content: this.newContent,
      instagram: this.instagramLink,
      facebook: this.facebookLink,
    };

    if (this.activeDivision.division_cms_content) {
      const { error } = await this.supabase.supabase
        .from('division_cms_content')
        .update(contentUpdate)
        .eq('division_id', this.activeDivision.id);

      if (error) {
        console.error(error);
        this.toastr.error('Failed to update content', 'Error');
      } else {
        this.toastr.success('Content updated successfully', 'Success');
        await this.getContent();
      }
    } else {
      const { error } = await this.supabase.supabase
        .from('division_cms_content')
        .insert({
          division_id: this.activeDivision.id,
          ...contentUpdate,
        });

      if (error) {
        console.error(error);
        this.toastr.error('Failed to add content', 'Error');
      }
    }

    await this.getContent();
  }

  async uploadImage(file: File, name: string) {
    if (name === 'logo' || name === 'main') {
      const timestamp = Date.now();
      const filePath = `${this.activeDivision?.name}-${name}-${timestamp}`; // EXAMPLE: 'Enduro-logo-1234567890'
      const { error: uploadError } = await this.supabase.supabase.storage
        .from('Images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false, // Changed to false since we're using unique filenames
        });

      if (uploadError) {
        console.error(uploadError);
        this.toastr.error(`Failed to upload ${name}`, 'Error');
        return;
      } else {
        // Clean up old images
        const prefix = `${this.activeDivision?.name}-${name}`;
        const { data: existingFiles } = await this.supabase.supabase.storage
          .from('Images')
          .list('', {
            limit: 100,
            search: prefix,
          });

        if (existingFiles) {
          // Filter out the file we just uploaded and delete the rest
          const filesToDelete = existingFiles
            .filter((file) => file.name !== filePath)
            .map((file) => file.name);

          if (filesToDelete.length > 0) {
            await this.supabase.supabase.storage
              .from('Images')
              .remove(filesToDelete);
          }
        }

        this.toastr.success(`${name} updated successfully`, 'Success');
      }

      if (name === 'logo') {
        this.logoFile = null;
      }

      if (name === 'main') {
        this.mainImgFile = null;
      }
    } else {
      const filePath = `${name}`;
      const { error: uploadError } = await this.supabase.supabase.storage
        .from('Images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        this.toastr.error(
          `Failed to upload ${name}: ${uploadError.message}`,
          'Error'
        );
      } else {
        this.toastr.success(`${name} updated successfully`, 'Success');
      }
    }
  }

  async getChairmanName() {
    if (this.activeDivision?.chairman_id) {
      const { data, error } = await this.supabase.supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', this.activeDivision.chairman_id)
        .single();

      if (error) {
        console.error(error);
        return 'No Chairman';
      }

      if (data) {
        this.cdr.detectChanges();
        return `${data.first_name} ${data.last_name}`;
      }
    }

    return 'No Chairman';
  }

  onLogoImageChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.logoFile = file;
      this.uploadImage(file, 'logo');
    }
  }

  onMainImageChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.mainImgFile = file;
      this.uploadImage(file, 'main');
    }
  }

  async onPointsFileUpload(event: any) {
    if (!this.activeDivision) return;
    const file = event.target.files[0];
    if (file) {
      this.pointsLink = file.name;
      try {
        await this.uploadImage(file, file.name);
        const { data: url } = await this.supabase.supabase.storage
          .from('Images')
          .getPublicUrl(file.name);

        this.pointsLink = url.publicUrl;

        const { error } = await this.supabase.supabase
          .from('divisions')
          .update({ points_link: this.pointsLink })
          .eq('id', this.activeDivision?.id);

        if (error) {
          console.error(error);
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  async onResultsFileUpload(event: any) {
    if (!this.activeDivision) return;
    const file = event.target.files[0];
    if (file) {
      this.resultsLink = file.name;
      try {
        await this.uploadImage(file, file.name);
        const { data: url } = await this.supabase.supabase.storage
          .from('Images')
          .getPublicUrl(file.name);

        this.resultsLink = url.publicUrl;

        const { error } = await this.supabase.supabase
          .from('divisions')
          .update({ results_link: this.resultsLink })
          .eq('id', this.activeDivision?.id);

        if (error) {
          console.error(error);
        }
      } catch (error) {
        console.error(error);
      }
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

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  async uploadDivisionMedia() {
    if (!this.selectedFile || !this.newMediaName || !this.activeDivision?.id) {
      this.toastr.error('Please select a file and provide a name', 'Error');
      return;
    }

    this.isUploading = true;

    try {
      // Upload file to storage
      const timestamp = Date.now();
      const filePath = `${this.activeDivision.name}/${this.selectedFile.name}-${timestamp}`;
      const { error: uploadError, data } = await this.supabase.supabase.storage
        .from('media')
        .upload(filePath, this.selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = await this.supabase.supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Create database entry
      const { error: dbError } = await this.supabase.supabase
        .from('division_media')
        .insert({
          division_id: this.activeDivision.id,
          display_name: this.newMediaName,
          file_link: urlData.publicUrl,
        });

      if (dbError) {
        await this.supabase.supabase.storage.from('media').remove([filePath]);
        throw dbError;
      }

      this.toastr.success('Media uploaded successfully', 'Success');
      this.selectedFile = null;
      this.newMediaName = '';
      await this.loadDivisionMedia();
    } catch (error) {
      console.error('Upload error:', error);
      this.toastr.error('Failed to upload media', 'Error');
    } finally {
      this.isUploading = false;
    }
  }

  async loadDivisionMedia() {
    if (!this.activeDivision?.id) {
      console.log('No active division ID');
      return;
    }

    console.log('Loading media for division:', this.activeDivision.id);
    const { data, error } = await this.supabase.supabase
      .from('division_media')
      .select('*')
      .eq('division_id', this.activeDivision.id);

    if (error) {
      console.error('Error loading media:', error);
      return;
    }

    console.log('Loaded division media:', data);
    this.divisionMedia = data;
  }

  async deleteMedia(mediaId: string, fileUrl: string) {
    try {
      // Extract the file path from the URL
      const urlParts = fileUrl.split('/media/');
      if (urlParts.length < 2) {
        throw new Error('Invalid file URL format');
      }
      const rawPath = urlParts[1].split('?')[0].split('#')[0];
      const filePath = decodeURIComponent(rawPath);
      console.log('Deleting file path:', filePath);

      // Delete from storage
      const { error: storageError } = await this.supabase.supabase.storage
        .from('media')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await this.supabase.supabase
        .from('division_media')
        .delete()
        .eq('id', mediaId);

      if (dbError) throw dbError;

      this.toastr.success('Media deleted successfully', 'Success');
      await this.loadDivisionMedia();
    } catch (error) {
      console.error('Delete error:', error);
      this.toastr.error('Failed to delete media', 'Error');
    }
  }

  startEditingMedia(media: any) {
    this.editingMediaId = media.id;
    this.editingMediaName = media.display_name;
  }

  async saveMediaName(mediaId: number) {
    try {
      const { error } = await this.supabase.supabase
        .from('division_media')
        .update({ display_name: this.editingMediaName })
        .eq('id', mediaId);

      if (error) throw error;

      this.toastr.success('File name updated successfully', 'Success');
      this.editingMediaId = null;
      await this.loadDivisionMedia();
    } catch (error) {
      console.error('Error updating media name:', error);
      this.toastr.error('Failed to update file name', 'Error');
    }
  }

  cancelEditingMedia() {
    this.editingMediaId = null;
    this.editingMediaName = '';
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toastr.success('Link copied to clipboard', 'Success');
    } catch (err) {
      this.toastr.error('Failed to copy link', 'Error');
    }
  }

  onLogoImageDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingLogo = true;
  }

  onLogoImageDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingLogo = false;
  }

  onLogoImageDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingLogo = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.logoFile = files[0];
      this.uploadImage(files[0], 'logo');
    }
  }

  onMainImageDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMain = true;
  }

  onMainImageDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMain = false;
  }

  onMainImageDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingMain = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.mainImgFile = files[0];
      this.uploadImage(files[0], 'main');
    }
  }
}
