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

type Collection = {
  title: string;
  meta: string;
  detail: string;
};

type ApiTrack = {
  title: string;
  type: TrackType;
  duration: string;
  publishedLabel: string;
  videoId: string;
  viewCountText: string;
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
  protected readonly filters: Array<'Tutti' | TrackType> = [
    'Tutti',
    'Progetto lungo',
    'Mashup / fan edit',
    'Singolo / brano'
  ];

  protected readonly tracks = signal<Track[]>([]);
  protected readonly selectedTrack = signal<Track | null>(null);
  protected readonly activeFilter = signal<'Tutti' | TrackType>('Tutti');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly lastUpdatedLabel = signal('');

  protected readonly filteredTracks = computed(() => {
    const filter = this.activeFilter();
    const allTracks = this.tracks();
    return filter === 'Tutti' ? allTracks : allTracks.filter((track) => track.type === filter);
  });

  protected readonly collections = computed<Collection[]>(() => {
    const allTracks = this.tracks();
    const mashupCount = this.countTracksByType('Mashup / fan edit');
    const longformCount = this.countTracksByType('Progetto lungo');
    const singleCount = this.countTracksByType('Singolo / brano');

    return [
      {
        title: 'Catalogo completo',
        meta: `${allTracks.length} video pubblici`,
        detail: 'La libreria viene caricata a runtime dal canale YouTube e si aggiorna automaticamente.'
      },
      {
        title: 'Mashup e fan edit',
        meta: `${mashupCount} elementi`,
        detail: 'Filtro dedicato per brani compositi, crossover e rework pubblicati sul canale.'
      },
      {
        title: 'Singoli e progetti',
        meta: `${singleCount + longformCount} elementi`,
        detail: 'Sono inclusi sia i brani standalone sia i formati lunghi come EP, visual EP e fan-made album.'
      }
    ];
  });

  protected readonly playerUrl = computed<SafeResourceUrl | null>(() => {
    const track = this.selectedTrack();
    return track
      ? this.sanitizer.bypassSecurityTrustResourceUrl(this.buildYoutubeEmbedUrl(track.videoId))
      : null;
  });

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

  protected selectTrack(track: Track): void {
    this.selectedTrack.set(track);
  }

  protected setFilter(filter: 'Tutti' | TrackType): void {
    this.activeFilter.set(filter);

    const visibleTracks = filter === 'Tutti' ? this.tracks() : this.tracks().filter((track) => track.type === filter);
    const currentTrack = this.selectedTrack();
    if (!currentTrack || !visibleTracks.some((track) => track.videoId === currentTrack.videoId)) {
      this.selectedTrack.set(visibleTracks[0] ?? null);
    }
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

      this.tracks.set(items);

      const currentTrack = this.selectedTrack();
      if (!currentTrack || !items.some((track) => track.videoId === currentTrack.videoId)) {
        this.selectedTrack.set(items[0] ?? null);
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

  private countTracksByType(type: TrackType): number {
    return this.tracks().filter((track) => track.type === type).length;
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
