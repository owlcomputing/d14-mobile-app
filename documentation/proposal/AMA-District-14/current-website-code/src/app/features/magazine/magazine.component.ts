import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-magazine',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './magazine.component.html'
})
export class MagazineComponent {
  currentIssues = [
    { month: 'January', year: 2024, link: 'https://online.flippingbook.com/view/59305815/' },
    { month: 'February', year: 2024, link: 'https://online.flippingbook.com/view/627429942/' },
    { month: 'March', year: 2024, link: 'https://online.flippingbook.com/view/567529744/' },
    // Add more issues for 2024
  ];

  previousIssues = [
    { month: 'February', year: 2023, link: 'https://heyzip.com/flip-book/164643d5c8.html' },
    { month: 'March', year: 2023, link: 'https://heyzip.com/flip-book/291970516.html' },
    { month: 'April', year: 2023, link: 'https://heyzip.com/flip-book/abc1234.html' },
    // Add more previous issues here
  ];

  archivedIssues = [
    { month: 'January', year: 2021, link: 'https://heyzip.com/flip-book/old-issue1.html' },
    { month: 'February', year: 2021, link: 'https://heyzip.com/flip-book/old-issue2.html' },
    { month: 'March', year: 2021, link: 'https://heyzip.com/flip-book/old-issue3.html' },
    // Add more archived issues here
  ];
}
