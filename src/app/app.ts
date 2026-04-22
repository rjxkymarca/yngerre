import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type Track = {
  title: string;
  tag: string;
  duration: string;
  project: string;
  releaseDate: string;
  mood: string;
  appleMusicUrl: string;
  youtubeSearch: string;
};

type Release = {
  title: string;
  meta: string;
  detail: string;
  appleMusicUrl: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly artistName = 'YNG ERRE';
  protected readonly channelUrl = 'https://www.youtube.com/c/YNGERREPRODUCTIONS';
  protected readonly appleMusicArtistUrl = 'https://music.apple.com/it/artist/yng-erre/1615633683';
  protected readonly linkBioUrl = 'https://lnk.bio/yngerre';

  protected readonly tracks: Track[] = [
    {
      title: 'INTROVERT.',
      tag: 'Opening track',
      duration: '3:57',
      project: 'INTROVERT. (Deluxe)',
      releaseDate: '14 aprile 2023',
      mood: 'Introspettiva, cinematic, notturna.',
      appleMusicUrl: 'https://music.apple.com/it/album/introvert-deluxe/1681465591',
      youtubeSearch: 'YNG ERRE INTROVERT'
    },
    {
      title: 'STAND BY ME.',
      tag: 'Single',
      duration: '5:10',
      project: 'Single',
      releaseDate: '11 agosto 2023',
      mood: 'Melodica, emotiva, sospesa.',
      appleMusicUrl: 'https://music.apple.com/it/album/stand-by-me-single/1700777962',
      youtubeSearch: 'YNG ERRE Stand By Me'
    },
    {
      title: 'NO HEART.',
      tag: 'Finale cut',
      duration: '4:50',
      project: 'INTROVERT. (Deluxe)',
      releaseDate: '14 aprile 2023',
      mood: 'Fredda, intensa, essenziale.',
      appleMusicUrl: 'https://music.apple.com/it/album/introvert-deluxe/1681465591',
      youtubeSearch: 'YNG ERRE NO HEART'
    },
    {
      title: 'FALLING.',
      tag: 'Deep focus',
      duration: '3:51',
      project: 'INTROVERT. (Deluxe)',
      releaseDate: '14 aprile 2023',
      mood: 'Atmosferica, liquida, malinconica.',
      appleMusicUrl: 'https://music.apple.com/it/album/introvert-deluxe/1681465591',
      youtubeSearch: 'YNG ERRE FALLING'
    }
  ];

  protected readonly releases: Release[] = [
    {
      title: 'INTROVERT. (Deluxe)',
      meta: 'Album • 12 brani • 44 min',
      detail: 'Pubblicato il 14 aprile 2023 da YNG ERRE PRODUCTIONS.',
      appleMusicUrl: 'https://music.apple.com/it/album/introvert-deluxe/1681465591'
    },
    {
      title: 'Stand By Me.',
      meta: 'Singolo • 1 brano • 5 min',
      detail: 'Pubblicato l’11 agosto 2023.',
      appleMusicUrl: 'https://music.apple.com/it/album/stand-by-me-single/1700777962'
    },
    {
      title: 'Profilo artista',
      meta: 'Dogliani, CN • Hip-Hop/Rap',
      detail: 'Scheda artista Apple Music per Yng Erre.',
      appleMusicUrl: 'https://music.apple.com/it/artist/yng-erre/1615633683'
    }
  ];

  protected readonly selectedTrack = signal(this.tracks[0]);

  protected readonly playerUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.buildYoutubeEmbedUrl(this.selectedTrack().youtubeSearch))
  );

  protected selectTrack(track: Track): void {
    this.selectedTrack.set(track);
  }

  private buildYoutubeEmbedUrl(searchTerm: string): string {
    const encodedQuery = encodeURIComponent(searchTerm);
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodedQuery}&autoplay=0&controls=1&modestbranding=1&rel=0`;
  }
}
