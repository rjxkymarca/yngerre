import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type TrackType = 'Progetto lungo' | 'Mashup / fan edit' | 'Singolo / brano';

type Track = {
  title: string;
  type: TrackType;
  duration: string;
  publishedLabel: string;
  videoId: string;
  viewCountText: string;
};

type ApiTrack = {
  title: string;
  type: TrackType;
  duration: string;
  publishedLabel: string;
  videoId: string;
  viewCountText: string;
};

type Collection = {
  title: string;
  meta: string;
  detail: string;
};

type AppleRelease = {
  title: string;
  meta: string;
  detail: string;
  appleMusicUrl: string;
  embedUrl: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  protected readonly artistName = 'YNG ERRE';
  protected readonly channelUrl = 'https://www.youtube.com/channel/UC6kUWPUTwPd92a1xc9ubSfg';
  protected readonly appleMusicArtistUrl = 'https://music.apple.com/it/artist/yng-erre/1615633683';
  protected readonly linkBioUrl = 'https://lnk.bio/yngerre';

  protected readonly appleReleases: AppleRelease[] = [
    {
      title: 'INTROVERT. (Deluxe)',
      meta: 'Album · 12 brani · 2023',
      detail: 'Release ufficiale principale disponibile su Apple Music.',
      appleMusicUrl: 'https://music.apple.com/it/album/introvert-deluxe/1681465591',
      embedUrl: 'https://embed.music.apple.com/it/album/introvert-deluxe/1681465591'
    },
    {
      title: 'Stand By Me. - Single',
      meta: 'Singolo · 1 brano · 2023',
      detail: 'Singolo ufficiale presente nella sezione Singoli e EP di Apple Music.',
      appleMusicUrl: 'https://music.apple.com/it/album/stand-by-me-single/1700777962',
      embedUrl: 'https://embed.music.apple.com/it/album/stand-by-me-single/1700777962'
    },
    {
      title: 'Profilo artista Apple Music',
      meta: 'Top brani, album, singoli e EP',
      detail: 'Vista completa del catalogo ufficiale Yng Erre su Apple Music.',
      appleMusicUrl: 'https://music.apple.com/it/artist/yng-erre/1615633683',
      embedUrl: 'https://music.apple.com/it/artist/embed/1615633683'
    }
  ];

  protected readonly tracks = signal<Track[]>([]);
  protected readonly selectedYoutubeTrack = signal<Track | null>(null);
  protected readonly selectedAppleRelease = signal<AppleRelease>(this.appleReleases[0]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly lastUpdatedLabel = signal('');

  protected readonly youtubeMashups = computed(() =>
    this.tracks().filter((track) => track.type === 'Mashup / fan edit')
  );

  protected readonly collections = computed<Collection[]>(() => {
    const allTracks = this.tracks();
    const mashupCount = this.youtubeMashups().length;

    return [
      {
        title: 'YouTube mashup',
        meta: `${mashupCount} video`,
        detail: 'La sezione YouTube mostra solo mashup e fan edit caricati sul canale.'
      },
      {
        title: 'Release ufficiali',
        meta: `${this.appleReleases.length} riferimenti Apple Music`,
        detail: 'Le uscite ufficiali sono separate in una sezione dedicata con player Apple Music.'
      },
      {
        title: 'Catalogo video totale',
        meta: `${allTracks.length} video pubblici`,
        detail: 'Il catalogo YouTube viene caricato live e continua ad aggiornarsi automaticamente.'
      }
    ];
  });

  protected readonly youtubePlayerUrl = computed<SafeResourceUrl | null>(() => {
    const track = this.selectedYoutubeTrack();
    return track
      ? this.sanitizer.bypassSecurityTrustResourceUrl(this.buildYoutubeEmbedUrl(track.videoId))
      : null;
  });

  protected readonly applePlayerUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.selectedAppleRelease().embedUrl)
  );

  ngOnInit(): void {
    void this.loadVideos();
    this.refreshIntervalId = setInterval(() => {
      void this.loadVideos();
    }, 15 * 60 * 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }
  }

  protected async refreshVideos(): Promise<void> {
    await this.loadVideos();
  }

  protected selectYoutubeTrack(track: Track): void {
    this.selectedYoutubeTrack.set(track);
  }

  protected selectAppleRelease(release: AppleRelease): void {
    this.selectedAppleRelease.set(release);
  }

  private async loadVideos(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const response = await fetch('/api/youtube-videos', {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Catalog request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { fetchedAt?: string; items?: ApiTrack[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      const mashups = items.filter((track) => track.type === 'Mashup / fan edit');

      this.tracks.set(items);

      const currentTrack = this.selectedYoutubeTrack();
      if (!currentTrack || !mashups.some((track) => track.videoId === currentTrack.videoId)) {
        this.selectedYoutubeTrack.set(mashups[0] ?? null);
      }

      if (typeof payload.fetchedAt === 'string') {
        this.lastUpdatedLabel.set(this.formatFetchedAt(payload.fetchedAt));
      }
    } catch (error) {
      console.error(error);
      this.errorMessage.set(
        'Non sono riuscito a caricare il catalogo live da YouTube. In sviluppo locale usa `vercel dev` per testare anche la route API.'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private formatFetchedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return `Aggiornato ${new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)}`;
  }

  private buildYoutubeEmbedUrl(videoId: string): string {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&controls=1&modestbranding=1&rel=0`;
  }
}
