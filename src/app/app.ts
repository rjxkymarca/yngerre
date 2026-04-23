import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

type TrackType = 'Progetto lungo' | 'Mashup / fan edit';

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
  type: TrackType | 'Singolo / brano';
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

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          width?: string | number;
          height?: string | number;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayer = {
  cueVideoById: (videoId: string) => void;
  loadVideoById: (videoId: string) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  setSize: (width: number, height: number) => void;
  destroy: () => void;
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
  private youtubePlayer: YouTubePlayer | null = null;
  private pendingVideoId: string | null = null;
  private frameResizeObserver: ResizeObserver | null = null;
  private queueAutoScrollFrame: number | null = null;
  private queueAutoScrollStep = 0;
  private readonly handleWindowResize = () => {
    this.syncYoutubePlayerSize();
  };
  @ViewChild('queueList')
  private queueListRef?: ElementRef<HTMLDivElement>;

  protected readonly artistName = 'YNG ERRE';
  protected readonly channelUrl = 'https://www.youtube.com/channel/UC6kUWPUTwPd92a1xc9ubSfg';
  protected readonly appleMusicArtistUrl = 'https://music.apple.com/it/artist/yng-erre/1615633683';
  protected readonly instagramUrl = 'https://www.instagram.com/yngerreproductions/';
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

  protected readonly filters: Array<'Tutti' | TrackType> = [
    'Tutti',
    'Progetto lungo',
    'Mashup / fan edit'
  ];

  protected readonly tracks = signal<Track[]>([]);
  protected readonly playbackQueue = signal<Track[]>([]);
  protected readonly selectedYoutubeTrack = signal<Track | null>(null);
  protected readonly selectedAppleRelease = signal<AppleRelease>(this.appleReleases[0]);
  protected readonly activeFilter = signal<'Tutti' | TrackType>('Tutti');
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly lastUpdatedLabel = signal('');
  protected readonly isYoutubePlayerReady = signal(false);
  protected readonly isYoutubePlaying = signal(false);
  protected readonly draggedTrackId = signal<string | null>(null);
  protected readonly dragTargetTrackId = signal<string | null>(null);
  protected readonly dragTargetPosition = signal<'before' | 'after' | null>(null);

  protected readonly filteredYoutubeTracks = computed(() => {
    const filter = this.activeFilter();
    const queue = this.playbackQueue();
    return filter === 'Tutti' ? queue : queue.filter((track) => track.type === filter);
  });

  protected readonly youtubeMashups = computed(() =>
    this.tracks().filter((track) => track.type === 'Mashup / fan edit')
  );

  protected readonly collections = computed<Collection[]>(() => {
    const allTracks = this.tracks();
    const mashupCount = this.youtubeMashups().length;

    return [
      {
        title: 'Universo YouTube',
        meta: `${allTracks.length} video`,
        detail: 'Qui convivono mashup, singoli e progetti lunghi in un unico percorso di ascolto e visione.'
      },
      {
        title: 'Release ufficiali',
        meta: `${this.appleReleases.length} uscite`,
        detail: 'Album, singoli e profilo artista trovano spazio in una sezione Apple Music separata.'
      },
      {
        title: 'Mashup e fan edit',
        meta: `${mashupCount} video`,
        detail: 'Mashup, fan edit e singoli YouTube condividono lo stesso spazio, distinti dalle uscite ufficiali su Apple Music.'
      }
    ];
  });

  protected readonly applePlayerUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.selectedAppleRelease().embedUrl)
  );

  ngOnInit(): void {
    void this.loadVideos();
    void this.initializeYouTubeApi();
    window.addEventListener('resize', this.handleWindowResize);
    this.refreshIntervalId = setInterval(() => {
      void this.loadVideos();
    }, 15 * 60 * 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
    }

    if (this.youtubePlayer) {
      this.youtubePlayer.destroy();
      this.youtubePlayer = null;
    }

    if (this.frameResizeObserver) {
      this.frameResizeObserver.disconnect();
      this.frameResizeObserver = null;
    }

    this.stopQueueAutoScroll();
    window.removeEventListener('resize', this.handleWindowResize);
  }

  protected async refreshVideos(): Promise<void> {
    await this.loadVideos();
  }

  protected selectYoutubeTrack(track: Track): void {
    this.selectedYoutubeTrack.set(track);
    this.loadAndPlayTrack(track);
  }

  protected setFilter(filter: 'Tutti' | TrackType): void {
    this.activeFilter.set(filter);

    const visibleTracks =
      filter === 'Tutti'
        ? this.playbackQueue()
        : this.playbackQueue().filter((track) => track.type === filter);

    const currentTrack = this.selectedYoutubeTrack();
    if (!currentTrack || !visibleTracks.some((track) => track.videoId === currentTrack.videoId)) {
      const nextTrack = visibleTracks[0] ?? null;
      this.selectedYoutubeTrack.set(nextTrack);
      if (nextTrack) {
        this.loadAndPlayTrack(nextTrack);
      }
    }
  }

  protected selectAppleRelease(release: AppleRelease): void {
    this.selectedAppleRelease.set(release);
  }

  protected playPreviousTrack(): void {
    const previousTrack = this.getRelativeQueueTrack(-1);
    if (previousTrack) {
      this.selectedYoutubeTrack.set(previousTrack);
      this.loadAndPlayTrack(previousTrack);
    }
  }

  protected playNextTrack(): void {
    const nextTrack = this.getRelativeQueueTrack(1);
    if (nextTrack) {
      this.selectedYoutubeTrack.set(nextTrack);
      this.loadAndPlayTrack(nextTrack);
    } else {
      this.isYoutubePlaying.set(false);
    }
  }

  protected pauseYoutubePlayback(): void {
    if (!this.youtubePlayer) {
      return;
    }

    this.youtubePlayer.pauseVideo();
    this.isYoutubePlaying.set(false);
  }

  protected resumeYoutubePlayback(): void {
    const currentTrack = this.selectedYoutubeTrack();
    if (!currentTrack) {
      return;
    }

    if (!this.youtubePlayer) {
      this.loadAndPlayTrack(currentTrack);
      return;
    }

    this.youtubePlayer.playVideo();
    this.isYoutubePlaying.set(true);
  }

  protected moveQueueItem(videoId: string, direction: -1 | 1): void {
    const queue = [...this.playbackQueue()];
    const currentIndex = queue.findIndex((track) => track.videoId === videoId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= queue.length) {
      return;
    }

    [queue[currentIndex], queue[nextIndex]] = [queue[nextIndex], queue[currentIndex]];
    this.playbackQueue.set(queue);
  }

  protected canMoveQueueItem(videoId: string, direction: -1 | 1): boolean {
    const queue = this.playbackQueue();
    const currentIndex = queue.findIndex((track) => track.videoId === videoId);
    const nextIndex = currentIndex + direction;
    return currentIndex >= 0 && nextIndex >= 0 && nextIndex < queue.length;
  }

  protected handleQueueDragStart(event: DragEvent, videoId: string): void {
    this.draggedTrackId.set(videoId);
    this.dragTargetTrackId.set(null);
    this.dragTargetPosition.set(null);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', videoId);
    }
  }

  protected handleQueueDragOver(event: DragEvent, targetVideoId: string): void {
    const draggedVideoId = this.draggedTrackId();
    if (!draggedVideoId) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const target = event.currentTarget as HTMLElement | null;
    const position = this.getDragPosition(event, target);

    this.dragTargetTrackId.set(targetVideoId);
    this.dragTargetPosition.set(draggedVideoId === targetVideoId ? null : position);
    this.updateQueueAutoScroll(event.clientY);
  }

  protected handleQueueDrop(event: DragEvent, targetVideoId: string): void {
    const draggedVideoId = this.draggedTrackId();
    if (!draggedVideoId) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget as HTMLElement | null;
    const position = this.getDragPosition(event, target);
    this.reorderQueueItem(draggedVideoId, targetVideoId, position);
    this.resetDragState();
  }

  protected handleQueueDragEnd(): void {
    this.resetDragState();
  }

  protected handleQueueListDragOver(event: DragEvent): void {
    if (!this.draggedTrackId()) {
      return;
    }

    event.preventDefault();
    this.updateQueueAutoScroll(event.clientY);
  }

  protected hasQueueToShuffle(): boolean {
    return this.playbackQueue().length > 1;
  }

  protected shuffleQueue(): void {
    const queue = this.playbackQueue();
    if (queue.length < 2) {
      return;
    }

    const currentTrack = this.selectedYoutubeTrack();
    if (!currentTrack) {
      const shuffledQueue = this.shuffleTracks(queue);
      this.playbackQueue.set(shuffledQueue);
      this.selectedYoutubeTrack.set(shuffledQueue[0] ?? null);
      return;
    }

    const remainingTracks = queue.filter((track) => track.videoId !== currentTrack.videoId);
    const shuffledQueue = [currentTrack, ...this.shuffleTracks(remainingTracks)];
    this.playbackQueue.set(shuffledQueue);
  }

  protected hasPreviousTrack(): boolean {
    return this.getRelativeQueueTrack(-1) !== null;
  }

  protected hasNextTrack(): boolean {
    return this.getRelativeQueueTrack(1) !== null;
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
      const items = Array.isArray(payload.items) ? payload.items.map((track) => this.normalizeTrack(track)) : [];
      const mergedQueue = this.mergeQueueWithFreshTracks(this.playbackQueue(), items);

      this.tracks.set(items);
      this.playbackQueue.set(mergedQueue);

      const currentTrack = this.selectedYoutubeTrack();
      if (!currentTrack || !mergedQueue.some((track) => track.videoId === currentTrack.videoId)) {
        const nextTrack = mergedQueue[0] ?? null;
        this.selectedYoutubeTrack.set(nextTrack);
        if (nextTrack) {
          this.loadAndPlayTrack(nextTrack, false);
        }
      }

      if (typeof payload.fetchedAt === 'string') {
        this.lastUpdatedLabel.set(this.formatFetchedAt(payload.fetchedAt));
      }
    } catch (error) {
      console.error(error);
      this.errorMessage.set('In questo momento non riesco a caricare i contenuti YouTube. Riprova tra poco.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private async initializeYouTubeApi(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.YT?.Player) {
      this.createYoutubePlayer();
      return;
    }

    await new Promise<void>((resolve) => {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existingScript) {
        window.onYouTubeIframeAPIReady = () => resolve();
        return;
      }

      window.onYouTubeIframeAPIReady = () => resolve();
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.body.appendChild(script);
    });

    this.createYoutubePlayer();
  }

  private createYoutubePlayer(): void {
    if (!window.YT?.Player || this.youtubePlayer) {
      return;
    }

    const initialVideoId = this.selectedYoutubeTrack()?.videoId ?? '';
    this.youtubePlayer = new window.YT.Player('youtube-player-host', {
      width: '100%',
      height: '100%',
      videoId: initialVideoId,
      playerVars: {
        autoplay: 1,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1
      },
      events: {
        onReady: () => {
          this.isYoutubePlayerReady.set(true);
          this.observeVideoFrame();
          this.syncYoutubePlayerSize();

          const trackToLoad = this.selectedYoutubeTrack();
          if (trackToLoad) {
            this.loadAndPlayTrack(trackToLoad);
          } else if (this.pendingVideoId) {
            this.youtubePlayer?.loadVideoById(this.pendingVideoId);
          }
        },
        onStateChange: (event) => {
          const playerState = window.YT?.PlayerState;
          if (!playerState) {
            return;
          }

          if (event.data === playerState.PLAYING) {
            this.isYoutubePlaying.set(true);
          } else if (event.data === playerState.PAUSED || event.data === playerState.CUED) {
            this.isYoutubePlaying.set(false);
          } else if (event.data === playerState.ENDED) {
            this.isYoutubePlaying.set(false);
            this.playNextTrack();
          }
        }
      }
    });
  }

  private loadAndPlayTrack(track: Track, autoplay = true): void {
    this.pendingVideoId = track.videoId;

    if (!this.youtubePlayer || !this.isYoutubePlayerReady()) {
      return;
    }

    if (autoplay) {
      this.youtubePlayer.loadVideoById(track.videoId);
      this.isYoutubePlaying.set(true);
      return;
    }

    this.youtubePlayer.cueVideoById(track.videoId);
    this.isYoutubePlaying.set(false);
  }

  private syncYoutubePlayerSize(): void {
    if (!this.youtubePlayer) {
      return;
    }

    const frame = document.querySelector('.video-frame') as HTMLElement | null;
    if (!frame) {
      return;
    }

    const width = Math.max(Math.round(frame.clientWidth), 200);
    const height = Math.max(Math.round(frame.clientHeight), 200);
    this.youtubePlayer.setSize(width, height);
  }

  private observeVideoFrame(): void {
    if (typeof ResizeObserver === 'undefined' || this.frameResizeObserver) {
      return;
    }

    const frame = document.querySelector('.video-frame') as HTMLElement | null;
    if (!frame) {
      return;
    }

    this.frameResizeObserver = new ResizeObserver(() => {
      this.syncYoutubePlayerSize();
    });
    this.frameResizeObserver.observe(frame);
  }

  private getRelativeQueueTrack(offset: -1 | 1): Track | null {
    const currentTrack = this.selectedYoutubeTrack();
    if (!currentTrack) {
      return null;
    }

    const queue = this.playbackQueue();
    const currentIndex = queue.findIndex((track) => track.videoId === currentTrack.videoId);
    const nextIndex = currentIndex + offset;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= queue.length) {
      return null;
    }

    return queue[nextIndex];
  }

  private mergeQueueWithFreshTracks(existingQueue: Track[], freshTracks: Track[]): Track[] {
    const freshById = new Map(freshTracks.map((track) => [track.videoId, track] as const));
    const preservedOrder = existingQueue
      .map((track) => freshById.get(track.videoId))
      .filter((track): track is Track => Boolean(track));
    const preservedIds = new Set(preservedOrder.map((track) => track.videoId));
    const appendedTracks = freshTracks.filter((track) => !preservedIds.has(track.videoId));

    return [...preservedOrder, ...appendedTracks];
  }

  private normalizeTrack(track: ApiTrack): Track {
    return {
      ...track,
      type: track.type === 'Singolo / brano' ? 'Mashup / fan edit' : track.type
    };
  }

  private shuffleTracks(tracks: Track[]): Track[] {
    const shuffledTracks = [...tracks];

    for (let index = shuffledTracks.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffledTracks[index], shuffledTracks[swapIndex]] = [shuffledTracks[swapIndex], shuffledTracks[index]];
    }

    return shuffledTracks;
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

  private reorderQueueItem(
    draggedVideoId: string,
    targetVideoId: string,
    position: 'before' | 'after'
  ): void {
    if (draggedVideoId === targetVideoId) {
      return;
    }

    const queue = [...this.playbackQueue()];
    const draggedIndex = queue.findIndex((track) => track.videoId === draggedVideoId);
    const targetIndex = queue.findIndex((track) => track.videoId === targetVideoId);

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    const [draggedTrack] = queue.splice(draggedIndex, 1);
    const nextTargetIndex = queue.findIndex((track) => track.videoId === targetVideoId);
    const insertIndex = position === 'before' ? nextTargetIndex : nextTargetIndex + 1;

    queue.splice(insertIndex, 0, draggedTrack);
    this.playbackQueue.set(queue);
  }

  private getDragPosition(event: DragEvent, element: HTMLElement | null): 'before' | 'after' {
    if (!element) {
      return 'after';
    }

    const bounds = element.getBoundingClientRect();
    const midpoint = bounds.top + bounds.height / 2;
    return event.clientY < midpoint ? 'before' : 'after';
  }

  private updateQueueAutoScroll(pointerY: number): void {
    const queueList = this.queueListRef?.nativeElement;
    if (!queueList) {
      return;
    }

    const bounds = queueList.getBoundingClientRect();
    const edgeThreshold = 72;
    let nextStep = 0;

    if (pointerY < bounds.top + edgeThreshold) {
      nextStep = -Math.min(20, Math.ceil((bounds.top + edgeThreshold - pointerY) / 6));
    } else if (pointerY > bounds.bottom - edgeThreshold) {
      nextStep = Math.min(20, Math.ceil((pointerY - (bounds.bottom - edgeThreshold)) / 6));
    }

    this.queueAutoScrollStep = nextStep;

    if (nextStep === 0) {
      this.stopQueueAutoScroll();
      return;
    }

    if (this.queueAutoScrollFrame === null) {
      this.queueAutoScrollFrame = requestAnimationFrame(() => this.runQueueAutoScroll());
    }
  }

  private runQueueAutoScroll(): void {
    const queueList = this.queueListRef?.nativeElement;
    if (!queueList || this.queueAutoScrollStep === 0) {
      this.stopQueueAutoScroll();
      return;
    }

    queueList.scrollTop += this.queueAutoScrollStep;
    this.queueAutoScrollFrame = requestAnimationFrame(() => this.runQueueAutoScroll());
  }

  private stopQueueAutoScroll(): void {
    this.queueAutoScrollStep = 0;

    if (this.queueAutoScrollFrame !== null) {
      cancelAnimationFrame(this.queueAutoScrollFrame);
      this.queueAutoScrollFrame = null;
    }
  }

  private resetDragState(): void {
    this.draggedTrackId.set(null);
    this.dragTargetTrackId.set(null);
    this.dragTargetPosition.set(null);
    this.stopQueueAutoScroll();
  }
}
